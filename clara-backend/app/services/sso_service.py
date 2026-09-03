from __future__ import annotations

import base64
import hashlib
import secrets
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit
from uuid import UUID

import jwt
from sqlalchemy import update
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.sso_authorization_code import SSOAuthorizationCode
from app.models.user import User
from app.services.auth_service import get_user_by_id
from app.services.role_service import normalize_role

PKCE_VALUE_CHARS = frozenset(
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~"
)
SUPPORTED_SCOPES = {"openid", "profile", "email"}


class SSOError(RuntimeError):
    pass


@dataclass(frozen=True)
class SSOClient:
    client_id: str
    client_secret: str
    redirect_uris: frozenset[str]


def get_sso_client() -> SSOClient:
    client_id = (settings.sso_client_id or "").strip()
    client_secret = (settings.sso_client_secret or "").strip()
    redirect_uris = frozenset(settings.sso_redirect_uris_list)
    if not client_id or len(client_secret) < 32 or not redirect_uris:
        raise SSOError("SSO Clara belum dikonfigurasi.")
    return SSOClient(client_id, client_secret, redirect_uris)


def validate_authorization_request(
    *,
    response_type: str,
    client_id: str,
    redirect_uri: str,
    scope: str,
    state: str,
    code_challenge: str,
    code_challenge_method: str,
) -> tuple[SSOClient, str]:
    client = get_sso_client()
    if not secrets.compare_digest(client.client_id, client_id):
        raise SSOError("OAuth client tidak valid.")
    if redirect_uri not in client.redirect_uris or urlsplit(redirect_uri).fragment:
        raise SSOError("Redirect URI tidak valid.")
    if response_type != "code":
        raise SSOError("response_type harus code.")
    requested_scopes = scope.split()
    if set(requested_scopes) != SUPPORTED_SCOPES:
        raise SSOError("Scope SSO tidak valid.")
    if len(state) < 16 or len(state) > 512:
        raise SSOError("state SSO tidak valid.")
    if code_challenge_method != "S256" or not _valid_pkce_value(code_challenge):
        raise SSOError("PKCE S256 wajib digunakan.")
    return client, " ".join(requested_scopes)


def issue_authorization_code(
    db: Session,
    *,
    user: User,
    client_id: str,
    redirect_uri: str,
    scope: str,
    code_challenge: str,
    nonce: str,
) -> str:
    if not user.is_active or user.organization_id is None:
        raise SSOError("User atau organization tidak valid untuk SSO.")
    if normalize_role(user.role) not in settings.sso_allowed_roles_set:
        raise SSOError("Role user tidak diizinkan untuk SSO.")
    if not 16 <= len(nonce) <= 255:
        raise SSOError("nonce SSO tidak valid.")

    code = secrets.token_urlsafe(48)
    db.add(
        SSOAuthorizationCode(
            code_hash=_token_hash(code),
            user_id=user.id,
            client_id=client_id,
            redirect_uri=redirect_uri,
            scope=scope,
            code_challenge=code_challenge,
            nonce=nonce,
            expires_at=datetime.now(UTC)
            + timedelta(seconds=settings.sso_code_expire_seconds),
        )
    )
    db.commit()
    return code


def build_authorization_redirect(redirect_uri: str, *, code: str, state: str) -> str:
    parsed = urlsplit(redirect_uri)
    query = parse_qsl(parsed.query, keep_blank_values=True)
    query.extend((("code", code), ("state", state)))
    return urlunsplit((parsed.scheme, parsed.netloc, parsed.path, urlencode(query), ""))


def exchange_authorization_code(
    db: Session,
    *,
    code: str,
    client_id: str,
    client_secret: str,
    redirect_uri: str,
    code_verifier: str,
) -> tuple[str, str, int, str]:
    client = authenticate_client(client_id, client_secret)
    if redirect_uri not in client.redirect_uris or not _valid_pkce_value(code_verifier):
        raise SSOError("Authorization code tidak valid.")

    now = datetime.now(UTC)
    code_hash = _token_hash(code)
    authorization = db.get(SSOAuthorizationCode, code_hash)
    if (
        authorization is None
        or authorization.client_id != client.client_id
        or authorization.redirect_uri != redirect_uri
        or authorization.used_at is not None
        or _as_utc(authorization.expires_at) <= now
        or not secrets.compare_digest(
            authorization.code_challenge, _pkce_challenge(code_verifier)
        )
    ):
        raise SSOError("Authorization code tidak valid atau sudah digunakan.")

    consumed = db.execute(
        update(SSOAuthorizationCode)
        .where(
            SSOAuthorizationCode.code_hash == code_hash,
            SSOAuthorizationCode.used_at.is_(None),
        )
        .values(used_at=now)
    )
    if consumed.rowcount != 1:
        db.rollback()
        raise SSOError("Authorization code tidak valid atau sudah digunakan.")
    user = get_user_by_id(db, authorization.user_id)
    if user is None or not user.is_active or user.organization_id is None:
        db.rollback()
        raise SSOError("User atau organization tidak valid untuk SSO.")

    access_token, expires_in = _create_sso_token(
        user=user,
        client=client,
        scope=authorization.scope,
        token_use="access",
        signing_secret=settings.sso_signing_secret_value,
    )
    id_token, _ = _create_sso_token(
        user=user,
        client=client,
        scope=authorization.scope,
        token_use="id",
        signing_secret=client.client_secret,
        nonce=authorization.nonce,
    )
    db.commit()
    return access_token, id_token, expires_in, authorization.scope


def authenticate_client(client_id: str, client_secret: str) -> SSOClient:
    client = get_sso_client()
    if not (
        secrets.compare_digest(client.client_id, client_id)
        and secrets.compare_digest(client.client_secret, client_secret)
    ):
        raise SSOError("OAuth client tidak valid.")
    return client


def decode_sso_access_token(token: str) -> dict:
    client = get_sso_client()
    try:
        payload = jwt.decode(
            token,
            settings.sso_signing_secret_value,
            algorithms=["HS256"],
            audience=client.client_id,
            issuer=settings.sso_issuer_normalized,
        )
    except jwt.InvalidTokenError as exc:
        raise SSOError("Access token SSO tidak valid.") from exc
    if payload.get("token_use") != "access":
        raise SSOError("Access token SSO tidak valid.")
    return payload


def get_active_sso_user(db: Session, payload: dict) -> User:
    try:
        user = get_user_by_id(db, UUID(payload["sub"]))
    except (KeyError, ValueError, TypeError) as exc:
        raise SSOError("Access token SSO tidak valid.") from exc
    if user is None or not user.is_active or user.organization_id is None:
        raise SSOError("Access token SSO tidak aktif.")
    return user


def user_identity(user: User) -> dict[str, str | bool | None]:
    return {
        "sub": str(user.id),
        "name": user.name,
        "email": user.email,
        "role": normalize_role(user.role),
        "organizationId": str(user.organization_id),
        "teamId": str(user.team_id) if user.team_id else None,
        "isActive": user.is_active,
    }


def _create_sso_token(
    *,
    user: User,
    client: SSOClient,
    scope: str,
    token_use: str,
    signing_secret: str,
    nonce: str | None = None,
) -> tuple[str, int]:
    now = datetime.now(UTC)
    expires_in = settings.sso_access_token_expire_minutes * 60
    payload = {
        "iss": settings.sso_issuer_normalized,
        "aud": client.client_id,
        "sub": str(user.id),
        "name": user.name,
        "email": user.email,
        "role": normalize_role(user.role),
        "organizationId": str(user.organization_id),
        "teamId": str(user.team_id) if user.team_id else None,
        "isActive": user.is_active,
        "scope": scope,
        "token_use": token_use,
        "iat": now,
        "exp": now + timedelta(seconds=expires_in),
        "jti": secrets.token_urlsafe(16),
    }
    if nonce:
        payload["nonce"] = nonce
    return jwt.encode(payload, signing_secret, algorithm="HS256"), expires_in


def parse_basic_client_credentials(authorization: str | None) -> tuple[str, str] | None:
    if not authorization:
        return None
    scheme, _, encoded = authorization.partition(" ")
    if scheme.casefold() != "basic" or not encoded:
        return None
    try:
        decoded = base64.b64decode(encoded, validate=True).decode("utf-8")
        client_id, separator, client_secret = decoded.partition(":")
    except ValueError, UnicodeDecodeError:
        return None
    return (client_id, client_secret) if separator else None


def _valid_pkce_value(value: str) -> bool:
    return 43 <= len(value) <= 128 and all(char in PKCE_VALUE_CHARS for char in value)


def _pkce_challenge(verifier: str) -> str:
    digest = hashlib.sha256(verifier.encode("ascii")).digest()
    return base64.urlsafe_b64encode(digest).rstrip(b"=").decode("ascii")


def _token_hash(value: str) -> str:
    return hashlib.sha256(value.encode("ascii")).hexdigest()


def _as_utc(value: datetime) -> datetime:
    return value.replace(tzinfo=UTC) if value.tzinfo is None else value.astimezone(UTC)

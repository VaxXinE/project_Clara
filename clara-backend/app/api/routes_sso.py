from urllib.parse import quote

from fastapi import (
    APIRouter,
    Depends,
    Form,
    HTTPException,
    Query,
    Request,
    Response,
    status,
)
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.security import get_current_user
from app.db.session import get_db
from app.models.user import User
from app.schemas.sso_schema import (
    OIDCDiscoveryResponse,
    SSOIntrospectionResponse,
    SSOTokenResponse,
    SSOUserInfoResponse,
)
from app.services.sso_service import (
    SSOError,
    authenticate_client,
    build_authorization_redirect,
    decode_sso_access_token,
    exchange_authorization_code,
    get_active_sso_user,
    issue_authorization_code,
    parse_basic_client_credentials,
    user_identity,
    validate_authorization_request,
)
from app.services.rate_limiter import sso_rate_limiter

router = APIRouter(tags=["sso"])


def _get_optional_current_user(
    request: Request,
    db: Session = Depends(get_db),
) -> User | None:
    try:
        return get_current_user(request, db)
    except HTTPException as exc:
        if exc.status_code == status.HTTP_401_UNAUTHORIZED:
            return None
        raise


def _enforce_rate_limit(request: Request, operation: str) -> None:
    client_ip = request.client.host if request.client else "unknown"
    if not sso_rate_limiter.is_allowed(
        key=f"sso:{operation}:{client_ip}",
        limit=settings.sso_rate_limit_per_minute,
        window_seconds=60,
    ):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail={"error": "slow_down"},
            headers={"Retry-After": "60"},
        )


def _oauth_error(message: str, *, unauthorized: bool = False) -> HTTPException:
    return HTTPException(
        status_code=(
            status.HTTP_401_UNAUTHORIZED
            if unauthorized
            else status.HTTP_400_BAD_REQUEST
        ),
        detail={"error": "invalid_request", "error_description": message},
        headers={"Cache-Control": "no-store", "Pragma": "no-cache"},
    )


def _resolve_client_credentials(
    request: Request,
    client_id: str | None,
    client_secret: str | None,
) -> tuple[str, str]:
    authorization = request.headers.get("Authorization")
    if authorization:
        credentials = parse_basic_client_credentials(authorization)
        if credentials is None:
            raise _oauth_error(
                "OAuth client authentication tidak valid.", unauthorized=True
            )
        return credentials
    return client_id or "", client_secret or ""


@router.get("/.well-known/openid-configuration", response_model=OIDCDiscoveryResponse)
def openid_configuration() -> OIDCDiscoveryResponse:
    issuer = settings.sso_issuer_normalized
    return OIDCDiscoveryResponse(
        issuer=issuer,
        authorization_endpoint=f"{issuer}/oauth/authorize",
        token_endpoint=f"{issuer}/oauth/token",
        userinfo_endpoint=f"{issuer}/oauth/userinfo",
        introspection_endpoint=f"{issuer}/oauth/introspect",
        response_types_supported=["code"],
        grant_types_supported=["authorization_code"],
        subject_types_supported=["public"],
        id_token_signing_alg_values_supported=["HS256"],
        token_endpoint_auth_methods_supported=[
            "client_secret_basic",
            "client_secret_post",
        ],
        scopes_supported=["openid", "profile", "email"],
        code_challenge_methods_supported=["S256"],
        claims_supported=[
            "sub",
            "name",
            "email",
            "role",
            "organizationId",
            "teamId",
            "isActive",
        ],
    )


@router.get("/oauth/authorize")
def authorize(
    request: Request,
    response_type: str = Query(),
    client_id: str = Query(min_length=1, max_length=100),
    redirect_uri: str = Query(min_length=1, max_length=2048),
    scope: str = Query(min_length=1, max_length=255),
    state: str = Query(min_length=16, max_length=512),
    code_challenge: str = Query(min_length=43, max_length=128),
    code_challenge_method: str = Query(),
    nonce: str = Query(min_length=16, max_length=255),
    db: Session = Depends(get_db),
    current_user: User | None = Depends(_get_optional_current_user),
) -> RedirectResponse:
    try:
        client, normalized_scope = validate_authorization_request(
            response_type=response_type,
            client_id=client_id,
            redirect_uri=redirect_uri,
            scope=scope,
            state=state,
            code_challenge=code_challenge,
            code_challenge_method=code_challenge_method,
        )
    except SSOError as exc:
        raise _oauth_error(str(exc)) from exc

    if current_user is None:
        return_to = (
            f"{settings.sso_issuer_normalized}/oauth/authorize?{request.url.query}"
        )
        separator = "&" if "?" in settings.sso_login_url else "?"
        return RedirectResponse(
            f"{settings.sso_login_url}{separator}returnTo={quote(return_to, safe='')}",
            status_code=status.HTTP_302_FOUND,
        )
    try:
        code = issue_authorization_code(
            db,
            user=current_user,
            client_id=client.client_id,
            redirect_uri=redirect_uri,
            scope=normalized_scope,
            code_challenge=code_challenge,
            nonce=nonce,
        )
    except SSOError as exc:
        raise _oauth_error(str(exc)) from exc
    return RedirectResponse(
        build_authorization_redirect(redirect_uri, code=code, state=state),
        status_code=status.HTTP_302_FOUND,
        headers={"Cache-Control": "no-store", "Pragma": "no-cache"},
    )


@router.post("/oauth/token", response_model=SSOTokenResponse)
def token(
    request: Request,
    response: Response,
    grant_type: str = Form(),
    code: str = Form(min_length=32, max_length=512),
    redirect_uri: str = Form(min_length=1, max_length=2048),
    code_verifier: str = Form(min_length=43, max_length=128),
    client_id: str | None = Form(default=None, max_length=100),
    client_secret: str | None = Form(default=None, max_length=512),
    db: Session = Depends(get_db),
) -> SSOTokenResponse:
    response.headers["Cache-Control"] = "no-store"
    response.headers["Pragma"] = "no-cache"
    _enforce_rate_limit(request, "token")
    resolved_client_id, resolved_client_secret = _resolve_client_credentials(
        request,
        client_id,
        client_secret,
    )
    if grant_type != "authorization_code":
        raise _oauth_error("grant_type harus authorization_code.")
    try:
        access_token, id_token, expires_in, scope = exchange_authorization_code(
            db,
            code=code,
            client_id=resolved_client_id,
            client_secret=resolved_client_secret,
            redirect_uri=redirect_uri,
            code_verifier=code_verifier,
        )
    except SSOError as exc:
        raise _oauth_error(str(exc), unauthorized=True) from exc
    return SSOTokenResponse(
        access_token=access_token,
        id_token=id_token,
        expires_in=expires_in,
        scope=scope,
    )


@router.post("/oauth/introspect", response_model=SSOIntrospectionResponse)
def introspect(
    request: Request,
    response: Response,
    token: str = Form(min_length=20, max_length=4096),
    client_id: str | None = Form(default=None, max_length=100),
    client_secret: str | None = Form(default=None, max_length=512),
    db: Session = Depends(get_db),
) -> SSOIntrospectionResponse:
    response.headers["Cache-Control"] = "no-store"
    response.headers["Pragma"] = "no-cache"
    _enforce_rate_limit(request, "introspect")
    resolved_client_id, resolved_client_secret = _resolve_client_credentials(
        request,
        client_id,
        client_secret,
    )
    try:
        authenticate_client(resolved_client_id, resolved_client_secret)
    except SSOError as exc:
        raise _oauth_error(str(exc), unauthorized=True) from exc
    try:
        payload = decode_sso_access_token(token)
        user = get_active_sso_user(db, payload)
    except SSOError:
        return SSOIntrospectionResponse(active=False)
    return SSOIntrospectionResponse(
        active=True,
        client_id=payload["aud"],
        scope=payload["scope"],
        exp=payload["exp"],
        iat=payload["iat"],
        **user_identity(user),
    )


@router.get("/oauth/userinfo", response_model=SSOUserInfoResponse)
def userinfo(
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
) -> SSOUserInfoResponse:
    response.headers["Cache-Control"] = "no-store"
    response.headers["Pragma"] = "no-cache"
    authorization = request.headers.get("Authorization", "")
    scheme, _, token = authorization.partition(" ")
    if scheme.casefold() != "bearer" or not token:
        raise _oauth_error("Bearer access token wajib dikirim.", unauthorized=True)
    try:
        payload = decode_sso_access_token(token)
        user = get_active_sso_user(db, payload)
    except SSOError as exc:
        raise _oauth_error(str(exc), unauthorized=True) from exc
    return SSOUserInfoResponse(**user_identity(user))

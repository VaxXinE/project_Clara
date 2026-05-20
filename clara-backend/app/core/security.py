from collections.abc import Callable
from uuid import UUID

from fastapi import Depends, HTTPException, Request, status
from sqlalchemy.orm import Session
from sqlalchemy.orm.attributes import set_committed_value

from app.core.config import settings
from app.db.session import get_db
from app.models.user import User
from app.services.auth_service import AuthError, decode_access_token, get_user_by_id
from app.services.role_service import is_owner_like, normalize_role

SAFE_HTTP_METHODS = {"GET", "HEAD", "OPTIONS"}


def get_request_auth_token(request: Request) -> tuple[str, str]:
    authorization = request.headers.get("Authorization")

    if authorization:
        scheme, _, token = authorization.partition(" ")

        if scheme.lower() != "bearer" or not token:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid Authorization header.",
            )

        return token, "bearer"

    cookie_token = request.cookies.get(settings.auth_cookie_name)
    if cookie_token:
        validate_csrf_for_cookie_auth(request)
        return cookie_token, "cookie"

    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Missing authentication credentials.",
    )


def validate_csrf_for_cookie_auth(request: Request) -> None:
    if request.method.upper() in SAFE_HTTP_METHODS:
        return

    csrf_cookie = request.cookies.get(settings.csrf_cookie_name)
    csrf_header = request.headers.get("X-CSRF-Token")

    if not csrf_cookie or not csrf_header or csrf_cookie != csrf_header:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="CSRF validation failed.",
        )


def get_current_user(
    request: Request,
    db: Session = Depends(get_db),
) -> User:
    token, _ = get_request_auth_token(request)

    try:
        payload = decode_access_token(token)
        user_id = UUID(payload["sub"])
    except (AuthError, KeyError, ValueError) as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication credentials.",
        ) from exc

    user = get_user_by_id(db=db, user_id=user_id)

    if user is None or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found or inactive.",
        )

    normalized_role = normalize_role(user.role)
    if normalized_role != user.role:
        set_committed_value(user, "role", normalized_role)

    return user


def require_roles(*allowed_roles: str) -> Callable:
    def dependency(current_user: User = Depends(get_current_user)) -> User:
        if is_owner_like(current_user.role):
            return current_user

        normalized_allowed_roles = {normalize_role(role) for role in allowed_roles}

        if normalize_role(current_user.role) not in normalized_allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have permission to access this resource.",
            )

        return current_user

    return dependency


def require_sgcc_integration(request: Request) -> str:
    configured_key = settings.sgcc_integration_api_key

    if not configured_key:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="SGCC integration is not configured.",
        )

    presented_key = request.headers.get("X-Clara-Integration-Key")

    if not presented_key:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing SGCC integration key.",
        )

    if presented_key != configured_key:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid SGCC integration key.",
        )

    return "sgcc"

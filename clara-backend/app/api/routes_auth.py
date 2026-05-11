from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.core.security import get_current_user, require_roles
from app.core.config import settings
from app.db.session import get_db
from app.models.user import User
from app.schemas.auth_schema import (
    CreateUserRequest,
    CurrentUserResponse,
    LoginRequest,
    TokenResponse,
)
from app.services.audit_service import create_audit_log
from app.services.auth_service import (
    AuthError,
    authenticate_user,
    create_access_token,
    create_user,
)
from app.services.rate_limiter import login_rate_limiter

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login", response_model=TokenResponse)
def login(
    payload: LoginRequest,
    request: Request,
    db: Session = Depends(get_db),
):
    ip_address = request.client.host if request.client else "unknown"
    rate_limit_key = f"login:{ip_address}:{payload.email.strip().lower()}"

    if not login_rate_limiter.is_allowed(
        key=rate_limit_key,
        limit=settings.login_rate_limit_per_minute,
        window_seconds=60,
    ):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many login attempts. Please try again later.",
        )
    try:
        user = authenticate_user(
            db=db,
            email=payload.email,
            password=payload.password,
        )
    except AuthError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=str(exc),
        ) from exc

    create_audit_log(
        db=db,
        action="auth.login",
        resource_type="user",
        resource_id=str(user.id),
        current_user=user,
        request=request,
        metadata={"email": user.email},
    )

    return TokenResponse(access_token=create_access_token(user))


@router.get("/me", response_model=CurrentUserResponse)
def get_me(
    current_user: User = Depends(get_current_user),
):
    return current_user


@router.post(
    "/users",
    response_model=CurrentUserResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_user_endpoint(
    payload: CreateUserRequest,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles("admin")),
):
    try:
        return create_user(db=db, payload=payload)
    except AuthError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc

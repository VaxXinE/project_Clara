import secrets
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy.orm import Session

from app.core.security import get_current_user, require_roles
from app.core.config import settings
from app.db.session import get_db
from app.models.user import User
from app.schemas.auth_schema import (
    ChangePasswordRequest,
    CreateUserRequest,
    CurrentUserResponse,
    LoginRequest,
    ResetUserPasswordRequest,
    SessionResponse,
    TokenResponse,
    UpdateUserRequest,
)
from app.services.audit_service import create_audit_log
from app.services.auth_service import (
    AuthError,
    authenticate_user,
    change_user_password,
    create_access_token,
    create_user,
    get_user_by_id,
    list_users,
    set_user_active_status,
    set_user_password,
    update_user,
)
from app.services.rate_limiter import login_rate_limiter

router = APIRouter(prefix="/auth", tags=["auth"])


def build_user_response(user: User) -> CurrentUserResponse:
    return CurrentUserResponse(
        id=user.id,
        name=user.name,
        email=user.email,
        role=user.role,
        is_active=user.is_active,
        created_at=user.created_at,
        organization_id=user.organization_id,
        organization_name=user.organization.name if user.organization else None,
        created_by_user_id=user.created_by_user_id,
        created_by_user_name=user.created_by_user.name if user.created_by_user else None,
    )


def set_auth_cookies(response: Response, access_token: str) -> None:
    max_age = settings.access_token_expire_minutes * 60
    csrf_token = secrets.token_urlsafe(32)

    response.set_cookie(
        key=settings.auth_cookie_name,
        value=access_token,
        httponly=True,
        secure=settings.auth_cookie_secure,
        samesite=settings.auth_cookie_samesite_value,
        domain=settings.auth_cookie_domain,
        max_age=max_age,
        path="/",
    )
    response.set_cookie(
        key=settings.csrf_cookie_name,
        value=csrf_token,
        httponly=False,
        secure=settings.auth_cookie_secure,
        samesite=settings.auth_cookie_samesite_value,
        domain=settings.auth_cookie_domain,
        max_age=max_age,
        path="/",
    )


def clear_auth_cookies(response: Response) -> None:
    response.delete_cookie(
        key=settings.auth_cookie_name,
        domain=settings.auth_cookie_domain,
        path="/",
    )
    response.delete_cookie(
        key=settings.csrf_cookie_name,
        domain=settings.auth_cookie_domain,
        path="/",
    )


@router.post("/login", response_model=SessionResponse)
def login(
    payload: LoginRequest,
    request: Request,
    response: Response,
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

    access_token = create_access_token(user)
    set_auth_cookies(response=response, access_token=access_token)

    return SessionResponse(user=build_user_response(user))


@router.get("/me", response_model=CurrentUserResponse)
def get_me(
    current_user: User = Depends(get_current_user),
):
    return build_user_response(current_user)


@router.post("/access-token", response_model=TokenResponse)
def issue_access_token(
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    create_audit_log(
        db=db,
        action="auth.access_token.issue",
        resource_type="user",
        resource_id=str(current_user.id),
        current_user=current_user,
        request=request,
        metadata={"purpose": "extension_integration"},
    )
    return TokenResponse(access_token=create_access_token(current_user))


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(response: Response) -> Response:
    clear_auth_cookies(response)
    response.status_code = status.HTTP_204_NO_CONTENT
    return response


@router.post("/change-password", response_model=CurrentUserResponse)
def change_password_endpoint(
    payload: ChangePasswordRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        updated_user = change_user_password(
            db=db,
            user=current_user,
            current_password=payload.current_password,
            new_password=payload.new_password,
        )
        create_audit_log(
            db=db,
            action="auth.user.change_password_self",
            resource_type="user",
            resource_id=str(updated_user.id),
            current_user=current_user,
            request=request,
            metadata={"email": updated_user.email},
        )
        return build_user_response(updated_user)
    except AuthError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc


@router.post(
    "/users",
    response_model=CurrentUserResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_user_endpoint(
    request: Request,
    payload: CreateUserRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("admin")),
):
    payload_to_create = payload

    if current_user.role == "admin":
        if payload.role == "owner":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Admin cannot create owner users.",
            )

        if current_user.organization_id is None:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Admin has no organization assigned.",
            )

        requested_organization_id = (
            payload.organization_id or current_user.organization_id
        )

        if requested_organization_id != current_user.organization_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Admin can only create users in their own organization.",
            )

        payload_to_create = payload.model_copy(
            update={"organization_id": current_user.organization_id}
        )

    try:
        user = create_user(
            db=db,
            payload=payload_to_create,
            created_by_user=current_user,
        )
        create_audit_log(
            db=db,
            action="auth.user.create",
            resource_type="user",
            resource_id=str(user.id),
            current_user=current_user,
            request=request,
            metadata={
                "email": user.email,
                "role": user.role,
                "organization_id": str(user.organization_id)
                if user.organization_id
                else None,
            },
        )
        return build_user_response(user)
    except AuthError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc


@router.get("/users", response_model=list[CurrentUserResponse])
def list_users_endpoint(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("admin")),
):
    users = list_users(db=db)

    if current_user.role == "owner":
        return [build_user_response(user) for user in users]

    if current_user.organization_id is None:
        return []

    return [
        build_user_response(user)
        for user in users
        if user.organization_id == current_user.organization_id
    ]


@router.patch("/users/{user_id}", response_model=CurrentUserResponse)
def update_user_endpoint(
    user_id: str,
    payload: UpdateUserRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("admin")),
):
    try:
        target_user = get_user_by_id(db=db, user_id=UUID(user_id))
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid user id.",
        ) from exc

    if target_user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found.",
        )

    if current_user.role == "admin":
        if current_user.organization_id is None:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Admin has no organization assigned.",
            )
        if target_user.organization_id != current_user.organization_id:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found.",
            )
        if payload.role == "owner":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Admin cannot promote users to owner.",
            )

        payload = payload.model_copy(
            update={"organization_id": current_user.organization_id}
        )

    if current_user.id == target_user.id and payload.role is not None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You cannot change your own role.",
        )

    try:
        updated_user = update_user(db=db, user=target_user, payload=payload)
        create_audit_log(
            db=db,
            action="auth.user.update",
            resource_type="user",
            resource_id=str(updated_user.id),
            current_user=current_user,
            request=request,
            metadata={
                "email": updated_user.email,
                "role": updated_user.role,
                "organization_id": str(updated_user.organization_id)
                if updated_user.organization_id
                else None,
            },
        )
        return build_user_response(updated_user)
    except AuthError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc


@router.post("/users/{user_id}/deactivate", response_model=CurrentUserResponse)
def deactivate_user_endpoint(
    user_id: str,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("admin")),
):
    try:
        target_user = get_user_by_id(db=db, user_id=UUID(user_id))
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid user id.",
        ) from exc

    if target_user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found.",
        )

    if current_user.id == target_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You cannot deactivate your own account.",
        )

    if current_user.role == "admin":
        if current_user.organization_id is None:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Admin has no organization assigned.",
            )
        if target_user.organization_id != current_user.organization_id:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found.",
            )
        if target_user.role == "owner":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Admin cannot deactivate owner users.",
            )

    updated_user = set_user_active_status(db=db, user=target_user, is_active=False)
    create_audit_log(
        db=db,
        action="auth.user.deactivate",
        resource_type="user",
        resource_id=str(updated_user.id),
        current_user=current_user,
        request=request,
        metadata={"email": updated_user.email},
    )
    return build_user_response(updated_user)


@router.post("/users/{user_id}/activate", response_model=CurrentUserResponse)
def activate_user_endpoint(
    user_id: str,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("admin")),
):
    try:
        target_user = get_user_by_id(db=db, user_id=UUID(user_id))
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid user id.",
        ) from exc

    if target_user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found.",
        )

    if current_user.role == "admin":
        if current_user.organization_id is None:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Admin has no organization assigned.",
            )
        if target_user.organization_id != current_user.organization_id:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found.",
            )
        if target_user.role == "owner":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Admin cannot activate owner users.",
            )

    updated_user = set_user_active_status(db=db, user=target_user, is_active=True)
    create_audit_log(
        db=db,
        action="auth.user.activate",
        resource_type="user",
        resource_id=str(updated_user.id),
        current_user=current_user,
        request=request,
        metadata={"email": updated_user.email},
    )
    return build_user_response(updated_user)


@router.post("/users/{user_id}/reset-password", response_model=CurrentUserResponse)
def reset_user_password_endpoint(
    user_id: str,
    payload: ResetUserPasswordRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("admin")),
):
    try:
        target_user = get_user_by_id(db=db, user_id=UUID(user_id))
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid user id.",
        ) from exc

    if target_user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found.",
        )

    if current_user.role == "admin":
        if current_user.organization_id is None:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Admin has no organization assigned.",
            )
        if target_user.organization_id != current_user.organization_id:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found.",
            )
        if target_user.created_by_user_id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Admin can only reset passwords for users they created.",
            )

    updated_user = set_user_password(
        db=db,
        user=target_user,
        password=payload.password,
    )
    create_audit_log(
        db=db,
        action="auth.user.reset_password",
        resource_type="user",
        resource_id=str(updated_user.id),
        current_user=current_user,
        request=request,
        metadata={"email": updated_user.email},
    )
    return build_user_response(updated_user)

from datetime import datetime, timedelta, timezone
from uuid import UUID

import jwt
from pwdlib import PasswordHash
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.core.config import settings
from app.models.user import User
from app.schemas.auth_schema import CreateUserRequest, UpdateUserRequest
from app.models.organization import Organization



password_hash = PasswordHash.recommended()


class AuthError(RuntimeError):
    pass


ALLOWED_ROLES = {"owner", "admin", "marketing"}


def hash_password(password: str) -> str:
    return password_hash.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return password_hash.verify(plain_password, hashed_password)


def get_user_by_email(db: Session, email: str) -> User | None:
    normalized_email = email.strip().lower()
    statement = select(User).where(User.email == normalized_email)
    return db.scalars(statement).first()


def get_user_by_id(db: Session, user_id: UUID) -> User | None:
    return db.get(User, user_id)


def create_access_token(user: User) -> str:
    expires_at = datetime.now(timezone.utc) + timedelta(
        minutes=settings.access_token_expire_minutes
    )

    payload = {
        "sub": str(user.id),
        "email": user.email,
        "role": user.role,
        "organization_id": (
            str(user.organization_id) if user.organization_id is not None else None
        ),
        "exp": expires_at,
        "iat": datetime.now(timezone.utc),
    }

    return jwt.encode(
        payload,
        settings.jwt_secret_key,
        algorithm=settings.jwt_algorithm,
    )


def decode_access_token(token: str) -> dict:
    try:
        return jwt.decode(
            token,
            settings.jwt_secret_key,
            algorithms=[settings.jwt_algorithm],
        )
    except jwt.ExpiredSignatureError as exc:
        raise AuthError("Token expired.") from exc
    except jwt.InvalidTokenError as exc:
        raise AuthError("Invalid token.") from exc


def authenticate_user(db: Session, email: str, password: str) -> User:
    user = get_user_by_email(db=db, email=email)

    if user is None:
        raise AuthError("Invalid email or password.")

    if not user.is_active:
        raise AuthError("User is inactive.")

    if not verify_password(password, user.hashed_password):
        raise AuthError("Invalid email or password.")

    return user

def create_user(
    db: Session,
    payload: CreateUserRequest,
    created_by_user: User | None = None,
) -> User:
    normalized_email = payload.email.strip().lower()

    if payload.role not in ALLOWED_ROLES:
        raise AuthError(f"Invalid role. Allowed roles: {', '.join(sorted(ALLOWED_ROLES))}")

    existing_user = get_user_by_email(db=db, email=normalized_email)

    if existing_user is not None:
        raise AuthError("User with this email already exists.")

    if payload.organization_id is not None:
        organization = db.get(Organization, payload.organization_id)

        if organization is None:
            raise AuthError("Organization not found.")

    user = User(
        organization_id=payload.organization_id,
        created_by_user_id=created_by_user.id if created_by_user is not None else None,
        name=payload.name.strip(),
        email=normalized_email,
        hashed_password=hash_password(payload.password),
        role=payload.role,
        is_active=True,
    )

    db.add(user)
    db.commit()
    db.refresh(user)

    return user


def list_users(db: Session) -> list[User]:
    return list(
        db.scalars(
            select(User)
            .options(selectinload(User.created_by_user))
            .order_by(User.created_at.desc())
        ).all()
    )


def update_user(
    db: Session,
    user: User,
    payload: UpdateUserRequest,
) -> User:
    if payload.role is not None and payload.role not in ALLOWED_ROLES:
        raise AuthError(f"Invalid role. Allowed roles: {', '.join(sorted(ALLOWED_ROLES))}")

    if payload.email is not None:
        normalized_email = payload.email.strip().lower()
        existing_user = get_user_by_email(db=db, email=normalized_email)
        if existing_user is not None and existing_user.id != user.id:
            raise AuthError("User with this email already exists.")
        user.email = normalized_email

    if payload.name is not None:
        user.name = payload.name.strip()

    if payload.role is not None:
        user.role = payload.role

    if payload.organization_id is not None:
        organization = db.get(Organization, payload.organization_id)
        if organization is None:
            raise AuthError("Organization not found.")
        user.organization_id = payload.organization_id

    db.add(user)
    db.commit()
    db.refresh(user)

    return user


def set_user_active_status(
    db: Session,
    user: User,
    *,
    is_active: bool,
) -> User:
    user.is_active = is_active
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def set_user_password(
    db: Session,
    user: User,
    *,
    password: str,
) -> User:
    user.hashed_password = hash_password(password)
    db.add(user)
    db.commit()
    db.refresh(user)
    return user

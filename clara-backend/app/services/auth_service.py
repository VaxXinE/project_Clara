from datetime import datetime, timedelta, timezone
from uuid import UUID

import jwt
from pwdlib import PasswordHash
from sqlalchemy.exc import IntegrityError
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.core.config import settings
from app.models.user import User
from app.schemas.auth_schema import CreateUserRequest, UpdateUserRequest
from app.models.organization import Organization
from app.models.sales_team import SalesTeam
from app.services.role_service import normalize_role


password_hash = PasswordHash.recommended()


class AuthError(RuntimeError):
    pass


ALLOWED_ROLES = {"superadmin", "head", "manager", "sales"}


def hash_password(password: str) -> str:
    return password_hash.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return password_hash.verify(plain_password, hashed_password)


def get_user_by_email(db: Session, email: str) -> User | None:
    normalized_email = email.strip().lower()
    statement = (
        select(User)
        .options(
            selectinload(User.organization),
            selectinload(User.created_by_user),
            selectinload(User.sales_team).selectinload(SalesTeam.unit),
        )
        .where(User.email == normalized_email)
    )
    return db.scalars(statement).first()


def get_user_by_id(db: Session, user_id: UUID) -> User | None:
    statement = (
        select(User)
        .options(
            selectinload(User.organization),
            selectinload(User.created_by_user),
            selectinload(User.sales_team).selectinload(SalesTeam.unit),
        )
        .where(User.id == user_id)
    )
    return db.scalars(statement).first()


def create_access_token(user: User) -> str:
    expires_at = datetime.now(timezone.utc) + timedelta(
        minutes=settings.access_token_expire_minutes
    )

    payload = {
        "sub": str(user.id),
        "email": user.email,
        "role": normalize_role(user.role),
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
        raise AuthError("User dengan email ini belum terdaftar.")

    if not user.is_active:
        raise AuthError("Akun user ini sedang nonaktif.")

    if not verify_password(password, user.hashed_password):
        raise AuthError("Password yang Anda masukkan salah.")

    return user

def create_user(
    db: Session,
    payload: CreateUserRequest,
    created_by_user: User | None = None,
) -> User:
    normalized_email = payload.email.strip().lower()
    normalized_role = normalize_role(payload.role)

    if normalized_role not in ALLOWED_ROLES:
        raise AuthError(f"Invalid role. Allowed roles: {', '.join(sorted(ALLOWED_ROLES))}")

    existing_user = get_user_by_email(db=db, email=normalized_email)

    if existing_user is not None:
        raise AuthError("User with this email already exists.")

    if payload.organization_id is not None:
        organization = db.get(Organization, payload.organization_id)

        if organization is None:
            raise AuthError("Organization not found.")
    if payload.team_id is not None:
        team = db.get(SalesTeam, payload.team_id)
        if team is None:
            raise AuthError("Sales team not found.")
        if payload.organization_id is not None and team.organization_id != payload.organization_id:
            raise AuthError("Sales team does not belong to the selected organization.")

    user = User(
        organization_id=payload.organization_id,
        team_id=payload.team_id,
        created_by_user_id=created_by_user.id if created_by_user is not None else None,
        name=payload.name.strip(),
        email=normalized_email,
        hashed_password=hash_password(payload.password),
        role=normalized_role,
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
            .options(
                selectinload(User.organization),
                selectinload(User.created_by_user),
                selectinload(User.sales_team).selectinload(SalesTeam.unit),
            )
            .order_by(User.created_at.desc())
        ).all()
    )


def update_user(
    db: Session,
    user: User,
    payload: UpdateUserRequest,
) -> User:
    normalized_role = normalize_role(payload.role) if payload.role is not None else None

    if normalized_role is not None and normalized_role not in ALLOWED_ROLES:
        raise AuthError(f"Invalid role. Allowed roles: {', '.join(sorted(ALLOWED_ROLES))}")

    if payload.email is not None:
        normalized_email = payload.email.strip().lower()
        existing_user = get_user_by_email(db=db, email=normalized_email)
        if existing_user is not None and existing_user.id != user.id:
            raise AuthError("User with this email already exists.")
        user.email = normalized_email

    if payload.name is not None:
        user.name = payload.name.strip()

    if normalized_role is not None:
        user.role = normalized_role

    if payload.organization_id is not None:
        organization = db.get(Organization, payload.organization_id)
        if organization is None:
            raise AuthError("Organization not found.")
        user.organization_id = payload.organization_id

    if payload.team_id is not None:
        team = db.get(SalesTeam, payload.team_id)
        if team is None:
            raise AuthError("Sales team not found.")
        organization_id = payload.organization_id if payload.organization_id is not None else user.organization_id
        if organization_id is None or team.organization_id != organization_id:
            raise AuthError("Sales team does not belong to the selected organization.")
        user.team_id = payload.team_id
    elif payload.team_id is None and "team_id" in payload.model_fields_set:
        user.team_id = None

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


def delete_user(
    db: Session,
    user: User,
) -> None:
    try:
        db.delete(user)
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise AuthError(
            "User tidak bisa dihapus karena masih dipakai oleh data lain."
        ) from exc


def change_user_password(
    db: Session,
    user: User,
    *,
    current_password: str,
    new_password: str,
) -> User:
    if not verify_password(current_password, user.hashed_password):
        raise AuthError("Current password is incorrect.")

    if current_password == new_password:
        raise AuthError("New password must be different from the current password.")

    return set_user_password(db=db, user=user, password=new_password)

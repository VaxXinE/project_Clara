import os
import sys
from dataclasses import dataclass
from pathlib import Path

from sqlalchemy import select

# Add parent directory to path to resolve app module
sys.path.insert(0, str(Path(__file__).parent.parent))

from app.db.session import SessionLocal
from app.models.organization import Organization
from app.models.user import User
from app.schemas.auth_schema import CreateUserRequest
from app.schemas.organization_schema import CreateOrganizationRequest
from app.services.auth_service import AuthError, create_user
from app.services.organization_service import OrganizationError, create_organization


ENV_KEYS = (
    "BOOTSTRAP_OWNER_NAME",
    "BOOTSTRAP_OWNER_EMAIL",
    "BOOTSTRAP_OWNER_PASSWORD",
    "BOOTSTRAP_ORGANIZATION_NAME",
    "BOOTSTRAP_ORGANIZATION_SLUG",
)


@dataclass(frozen=True)
class BootstrapConfig:
    owner_name: str
    owner_email: str
    owner_password: str
    organization_name: str
    organization_slug: str


class BootstrapError(RuntimeError):
    pass


def load_config() -> BootstrapConfig | None:
    values = {key: os.getenv(key, "").strip() for key in ENV_KEYS}

    if not any(values.values()):
        return None

    missing = [key for key, value in values.items() if not value]
    if missing:
        raise BootstrapError(
            "Bootstrap env belum lengkap. Tambahkan: " + ", ".join(missing)
        )

    return BootstrapConfig(
        owner_name=values["BOOTSTRAP_OWNER_NAME"],
        owner_email=values["BOOTSTRAP_OWNER_EMAIL"].lower(),
        owner_password=values["BOOTSTRAP_OWNER_PASSWORD"],
        organization_name=values["BOOTSTRAP_ORGANIZATION_NAME"],
        organization_slug=values["BOOTSTRAP_ORGANIZATION_SLUG"].lower(),
    )


def get_organization_by_slug(db, slug: str) -> Organization | None:
    return db.scalars(
        select(Organization).where(Organization.slug == slug.strip().lower())
    ).first()


def get_user_by_email(db, email: str) -> User | None:
    return db.scalars(
        select(User).where(User.email == email.strip().lower())
    ).first()


def ensure_owner_bootstrap(db, config: BootstrapConfig) -> tuple[str, Organization | None, User | None]:
    existing_user = get_user_by_email(db=db, email=config.owner_email)
    existing_org = get_organization_by_slug(db=db, slug=config.organization_slug)

    if existing_user is not None:
        if existing_user.role != "owner":
            raise BootstrapError(
                f"User {existing_user.email} sudah ada tapi rolenya {existing_user.role}, bukan owner."
            )

        if existing_org is not None and existing_user.organization_id != existing_org.id:
            raise BootstrapError(
                "Owner dengan email yang sama sudah ada, tapi organization-nya tidak cocok "
                "dengan BOOTSTRAP_ORGANIZATION_SLUG."
            )

        return ("owner_exists", existing_org, existing_user)

    organization = existing_org
    if organization is None:
        organization = create_organization(
            db=db,
            payload=CreateOrganizationRequest(
                name=config.organization_name,
                slug=config.organization_slug,
            ),
        )

    owner = create_user(
        db=db,
        payload=CreateUserRequest(
            name=config.owner_name,
            email=config.owner_email,
            password=config.owner_password,
            role="owner",
            organization_id=organization.id,
        ),
    )

    return ("created", organization, owner)


def main() -> int:
    try:
        config = load_config()
    except BootstrapError as exc:
        print(f"Bootstrap gagal: {exc}")
        return 1

    if config is None:
        print(
            "Bootstrap owner di-skip. Isi env BOOTSTRAP_* kalau ingin membuat organization + owner awal."
        )
        return 0

    db = SessionLocal()

    try:
        status, organization, owner = ensure_owner_bootstrap(db=db, config=config)
    except (BootstrapError, AuthError, OrganizationError) as exc:
        print(f"Bootstrap gagal: {exc}")
        return 1
    finally:
        db.close()

    if status == "owner_exists" and owner is not None:
        print(
            "Bootstrap owner di-skip. "
            f"User owner {owner.email} sudah ada."
        )
        return 0

    if organization is not None and owner is not None:
        print(
            "Bootstrap owner berhasil. "
            f"Organization={organization.name} ({organization.slug}), "
            f"Owner={owner.email}"
        )

    return 0


if __name__ == "__main__":
    raise SystemExit(main())

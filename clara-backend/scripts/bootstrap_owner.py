import os
import sys
from dataclasses import dataclass
from pathlib import Path

from pwdlib import PasswordHash
from sqlalchemy import select
from sqlalchemy.orm import Session

# Add parent directory to path to resolve app module.
sys.path.insert(0, str(Path(__file__).parent.parent))

import app.models  # noqa: F401
from app.core.config import settings
from app.db.session import SessionLocal
from app.models.organization import Organization
from app.models.user import User


password_hash = PasswordHash.recommended()


@dataclass(frozen=True)
class BootstrapConfig:
    owner_name: str
    owner_email: str
    owner_password: str
    organization_name: str
    organization_slug: str


@dataclass(frozen=True)
class BootstrapRunResult:
    changed: bool
    message: str


class BootstrapError(RuntimeError):
    pass


def load_config() -> BootstrapConfig | None:
    values = {
        "BOOTSTRAP_OWNER_NAME": (
            os.getenv("BOOTSTRAP_OWNER_NAME")
            or settings.bootstrap_owner_name
            or ""
        ).strip(),
        "BOOTSTRAP_OWNER_EMAIL": (
            os.getenv("BOOTSTRAP_OWNER_EMAIL")
            or settings.bootstrap_owner_email
            or ""
        ).strip(),
        "BOOTSTRAP_OWNER_PASSWORD": (
            os.getenv("BOOTSTRAP_OWNER_PASSWORD")
            or settings.bootstrap_owner_password
            or ""
        ).strip(),
        "BOOTSTRAP_ORGANIZATION_NAME": (
            os.getenv("BOOTSTRAP_ORGANIZATION_NAME")
            or settings.bootstrap_organization_name
            or ""
        ).strip(),
        "BOOTSTRAP_ORGANIZATION_SLUG": (
            os.getenv("BOOTSTRAP_ORGANIZATION_SLUG")
            or settings.bootstrap_organization_slug
            or ""
        ).strip(),
    }

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


def get_organization_by_slug(db: Session, slug: str) -> Organization | None:
    return db.scalars(
        select(Organization).where(Organization.slug == slug.strip().lower())
    ).first()


def get_user_by_email(db: Session, email: str) -> User | None:
    return db.scalars(
        select(User).where(User.email == email.strip().lower())
    ).first()


def ensure_owner_bootstrap(
    db: Session,
    config: BootstrapConfig,
) -> tuple[str, Organization | None, User | None]:
    existing_user = get_user_by_email(db=db, email=config.owner_email)
    existing_org = get_organization_by_slug(db=db, slug=config.organization_slug)

    if existing_user is not None:
        if existing_user.role != "superadmin":
            raise BootstrapError(
                f"User {existing_user.email} sudah ada tapi rolenya {existing_user.role}, bukan superadmin."
            )

        if existing_org is not None and existing_user.organization_id != existing_org.id:
            raise BootstrapError(
                "Superadmin dengan email yang sama sudah ada, tapi organization-nya tidak cocok "
                "dengan BOOTSTRAP_ORGANIZATION_SLUG."
            )

        return ("superadmin_exists", existing_org, existing_user)

    organization = existing_org
    if organization is None:
        organization = Organization(
            name=config.organization_name,
            slug=config.organization_slug,
        )
        db.add(organization)
        db.flush()

    owner = User(
        organization_id=organization.id,
        name=config.owner_name,
        email=config.owner_email,
        hashed_password=password_hash.hash(config.owner_password),
        role="superadmin",
        is_active=True,
    )
    db.add(owner)
    db.commit()
    db.refresh(owner)
    db.refresh(organization)

    return ("created", organization, owner)


def run_bootstrap(db: Session | None = None) -> BootstrapRunResult:
    try:
        config = load_config()
    except BootstrapError:
        raise

    if config is None:
        return BootstrapRunResult(
            changed=False,
            message=(
                "Bootstrap superadmin di-skip. Isi env BOOTSTRAP_* kalau ingin "
                "membuat organization + superadmin awal."
            ),
        )

    owns_session = db is None
    session = db or SessionLocal()

    try:
        status, organization, owner = ensure_owner_bootstrap(db=session, config=config)
        if status == "superadmin_exists" and owner is not None:
            return BootstrapRunResult(
                changed=False,
                message=(
                    "Bootstrap superadmin di-skip. "
                    f"User superadmin {owner.email} sudah ada."
                ),
            )

        if organization is not None and owner is not None:
            return BootstrapRunResult(
                changed=True,
                message=(
                    "Bootstrap superadmin berhasil. "
                    f"Organization={organization.name} ({organization.slug}), "
                    f"Superadmin={owner.email}"
                ),
            )

        raise BootstrapError("Bootstrap selesai tanpa hasil yang jelas.")
    except BootstrapError:
        session.rollback()
        raise
    finally:
        if owns_session:
            session.close()


def main() -> int:
    try:
        result = run_bootstrap()
    except BootstrapError as exc:
        print(f"Bootstrap gagal: {exc}")
        return 1

    print(result.message)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

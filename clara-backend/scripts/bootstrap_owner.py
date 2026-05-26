import os
import sys
from dataclasses import dataclass
from pathlib import Path

from sqlalchemy import select

# Add parent directory to path to resolve app module
sys.path.insert(0, str(Path(__file__).parent.parent))

from app.db.session import SessionLocal
from app.core.config import settings
from app.models.ai_extraction import AIExtraction  # noqa: F401
from app.models.approval_log import ApprovalLog  # noqa: F401
from app.models.conversation import Conversation  # noqa: F401
from app.models.lead import Lead  # noqa: F401
from app.models.message import Message  # noqa: F401
from app.models.organization import Organization
from app.models.product_knowledge import ProductKnowledge  # noqa: F401
from app.models.reply_suggestion import ReplySuggestion  # noqa: F401
from app.models.sent_message import SentMessage  # noqa: F401
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
            role="superadmin",
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
            "Bootstrap superadmin di-skip. Isi env BOOTSTRAP_* kalau ingin membuat organization + superadmin awal."
        )
        return 0

    db = SessionLocal()
    result_message: str | None = None

    try:
        status, organization, owner = ensure_owner_bootstrap(db=db, config=config)
        if status == "superadmin_exists" and owner is not None:
            result_message = (
                "Bootstrap superadmin di-skip. "
                f"User superadmin {owner.email} sudah ada."
            )
        elif organization is not None and owner is not None:
            result_message = (
                "Bootstrap superadmin berhasil. "
                f"Organization={organization.name} ({organization.slug}), "
                f"Superadmin={owner.email}"
            )
    except (BootstrapError, AuthError, OrganizationError) as exc:
        print(f"Bootstrap gagal: {exc}")
        return 1
    finally:
        db.close()

    if result_message:
        print(result_message)

    return 0


if __name__ == "__main__":
    raise SystemExit(main())

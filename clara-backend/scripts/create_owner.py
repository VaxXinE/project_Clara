import getpass
import sys
from pathlib import Path

# Add parent directory to path to resolve app module
sys.path.insert(0, str(Path(__file__).parent.parent))

from app.db.session import SessionLocal
from app.schemas.auth_schema import CreateUserRequest
from app.schemas.organization_schema import CreateOrganizationRequest
from app.services.auth_service import AuthError, create_user
from app.services.organization_service import OrganizationError, create_organization


def main() -> None:
    print("Create Clara organization + owner user")

    organization_name = input("Organization name: ").strip()
    organization_slug = input("Organization slug (example: clara-demo): ").strip().lower()

    name = input("Owner name: ").strip()
    email = input("Owner email: ").strip().lower()
    password = getpass.getpass("Owner password: ")

    db = SessionLocal()

    try:
        organization = create_organization(
            db=db,
            payload=CreateOrganizationRequest(
                name=organization_name,
                slug=organization_slug,
            ),
        )

        user = create_user(
            db=db,
            payload=CreateUserRequest(
                name=name,
                email=email,
                password=password,
                role="owner",
                organization_id=organization.id,
            ),
        )

        print(f"Organization created: {organization.name} ({organization.slug})")
        print(f"Owner created: {user.email} ({user.role})")
    except (AuthError, OrganizationError) as exc:
        print(f"Failed: {exc}")
    finally:
        db.close()


if __name__ == "__main__":
    main()
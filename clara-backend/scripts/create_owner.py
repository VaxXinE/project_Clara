import getpass

from app.db.session import SessionLocal
from app.schemas.auth_schema import CreateUserRequest
from app.services.auth_service import AuthError, create_user


def main() -> None:
    print("Create Clara owner user")
    name = input("Name: ").strip()
    email = input("Email: ").strip().lower()
    password = getpass.getpass("Password: ")

    payload = CreateUserRequest(
        name=name,
        email=email,
        password=password,
        role="owner",
    )

    db = SessionLocal()

    try:
        user = create_user(db=db, payload=payload)
        print(f"Owner created: {user.email} ({user.role})")
    except AuthError as exc:
        print(f"Failed: {exc}")
    finally:
        db.close()


if __name__ == "__main__":
    main()
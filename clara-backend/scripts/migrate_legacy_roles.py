import sys
from pathlib import Path

from sqlalchemy import select

sys.path.insert(0, str(Path(__file__).parent.parent))

from app.db.session import SessionLocal
from app.models.user import User
from app.services.role_service import normalize_role


def main() -> None:
    db = SessionLocal()

    try:
        users = db.scalars(select(User)).all()
        updated_count = 0

        for user in users:
            normalized_role = normalize_role(user.role)
            if user.role == normalized_role:
                continue

            print(
                f"Update {user.email}: {user.role} -> {normalized_role}"
            )
            user.role = normalized_role
            updated_count += 1

        if updated_count == 0:
            print("Tidak ada legacy role yang perlu dinormalisasi.")
            db.rollback()
            return

        db.commit()
        print(f"Selesai. {updated_count} user diperbarui ke hierarchy baru.")
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    main()

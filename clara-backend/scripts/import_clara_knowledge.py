import os
import sys
from dataclasses import dataclass
from pathlib import Path

from sqlalchemy import select

# Add parent directory to path to resolve app module
sys.path.insert(0, str(Path(__file__).parent.parent))

from app.db.session import SessionLocal
# Import related models so SQLAlchemy relationship registry is fully configured.
from app.models.ai_extraction import AIExtraction  # noqa: F401
from app.models.approval_log import ApprovalLog  # noqa: F401
from app.models.conversation import Conversation  # noqa: F401
from app.models.lead import Lead  # noqa: F401
from app.models.message import Message  # noqa: F401
from app.models.organization import Organization  # noqa: F401
from app.models.product_knowledge import ProductKnowledge
from app.models.reply_suggestion import ReplySuggestion  # noqa: F401
from app.models.sent_message import SentMessage  # noqa: F401
from app.models.user import User


@dataclass(frozen=True)
class KnowledgeImportItem:
    filename: str
    title: str
    category: str


KNOWLEDGE_IMPORT_ITEMS = (
    KnowledgeImportItem(
        filename="SALES_KNOWLEDGE_BRIDGE_MINI.md",
        title="Sales Knowledge Bridge Mini",
        category="product_facts",
    ),
    KnowledgeImportItem(
        filename="POSITIONING.md",
        title="Solid Prime Positioning",
        category="positioning",
    ),
    KnowledgeImportItem(
        filename="OBJECTION.md",
        title="Objection Handling",
        category="objection_handling",
    ),
    KnowledgeImportItem(
        filename="OBJECTION_EXTREME.md",
        title="Extreme Objection Handling",
        category="objection_handling",
    ),
)


class KnowledgeImportError(RuntimeError):
    pass


def get_repo_root() -> Path:
    return Path(__file__).resolve().parents[2]


def get_knowledge_dir() -> Path:
    custom_dir = os.getenv("CLARA_KNOWLEDGE_DIR", "").strip()
    if custom_dir:
        return Path(custom_dir).expanduser().resolve()

    return get_repo_root() / "clara_knowledge"


def get_owner_by_email(db, email: str) -> User | None:
    normalized_email = email.strip().lower()
    return db.scalars(select(User).where(User.email == normalized_email)).first()


def get_existing_entry(db, title: str) -> ProductKnowledge | None:
    return db.scalars(
        select(ProductKnowledge).where(
            ProductKnowledge.title == title,
            ProductKnowledge.organization_id.is_(None),
            ProductKnowledge.source_type == "markdown_import",
        )
    ).first()


def load_file_content(knowledge_dir: Path, filename: str) -> str:
    file_path = knowledge_dir / filename

    if not file_path.exists():
        raise KnowledgeImportError(f"File knowledge tidak ditemukan: {file_path}")

    content = file_path.read_text(encoding="utf-8").strip()
    if not content:
        raise KnowledgeImportError(f"File knowledge kosong: {file_path}")

    return content


def upsert_knowledge_entry(
    db,
    *,
    item: KnowledgeImportItem,
    content: str,
    created_by_user_id,
) -> str:
    existing_entry = get_existing_entry(db=db, title=item.title)

    if existing_entry is None:
        entry = ProductKnowledge(
            organization_id=None,
            created_by_user_id=created_by_user_id,
            title=item.title,
            category=item.category,
            content=content,
            source_type="markdown_import",
            is_active=True,
        )
        db.add(entry)
        return f"created: {item.title}"

    existing_entry.category = item.category
    existing_entry.content = content
    existing_entry.is_active = True
    if created_by_user_id is not None:
        existing_entry.created_by_user_id = created_by_user_id
    db.add(existing_entry)
    return f"updated: {item.title}"


def main() -> int:
    knowledge_dir = get_knowledge_dir()

    if not knowledge_dir.exists():
        print(f"Import gagal: folder knowledge tidak ditemukan di {knowledge_dir}")
        return 1

    owner_email = os.getenv("CLARA_KNOWLEDGE_OWNER_EMAIL", "").strip()
    created_by_user_id = None

    db = SessionLocal()

    try:
        if owner_email:
            owner = get_owner_by_email(db=db, email=owner_email)

            if owner is None:
                raise KnowledgeImportError(
                    f"Owner untuk import knowledge tidak ditemukan: {owner_email}"
                )

            if owner.role != "owner":
                raise KnowledgeImportError(
                    f"User {owner.email} ditemukan, tapi rolenya {owner.role}, bukan owner."
                )

            created_by_user_id = owner.id

        results: list[str] = []
        for item in KNOWLEDGE_IMPORT_ITEMS:
            content = load_file_content(knowledge_dir=knowledge_dir, filename=item.filename)
            results.append(
                upsert_knowledge_entry(
                    db=db,
                    item=item,
                    content=content,
                    created_by_user_id=created_by_user_id,
                )
            )

        db.commit()

        print("Import Clara knowledge selesai:")
        for result in results:
            print(f"- {result}")
        return 0
    except KnowledgeImportError as exc:
        db.rollback()
        print(f"Import gagal: {exc}")
        return 1
    finally:
        db.close()


if __name__ == "__main__":
    raise SystemExit(main())

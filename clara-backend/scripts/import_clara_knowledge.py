import os
import sys
from dataclasses import dataclass
from pathlib import Path

from sqlalchemy import select, update
from sqlalchemy.orm import Session

# Add parent directory to path to resolve app module.
sys.path.insert(0, str(Path(__file__).parent.parent))

import app.models  # noqa: F401
from app.core.config import settings
from app.db.session import SessionLocal
from app.models.product_knowledge import ProductKnowledge
from app.models.user import User


VARIANT_DIRECTORIES = {
    "mini": "clara_knowledge_mini",
    "regular": "clara_knowledge_regular",
}

FILENAME_ORDER = (
    "INSTRUCTION.md",
    "GUARDRAIL.md",
    "FLOW.md",
    "PERSONALITY_MODE.md",
    "AUTO_ADAPT.md",
    "POSITIONING.md",
    "OBJECTION.md",
    "OBJECTION_EXTREME.md",
    "CLOSING_ENGINE.md",
    "CONVERSION_BEHAVIOR_ENGINE.md",
    "CONVERSION_LAYER.md",
    "KB_ADDON_BULLETPROOF_SOLID_PRIME.md",
    "KB_ADDON_BULLETPROOF_SOLID_REGULAR.md",
    "SALES_KNOWLEDGE_BRIDGE_MINI.md",
    "SALES_KNOWLEDGE_BRIDGE_REGULAR.md",
)


@dataclass(frozen=True)
class KnowledgeImportItem:
    variant: str
    filename: str
    title: str
    category: str
    source_type: str


@dataclass(frozen=True)
class KnowledgeImportResult:
    changed: bool
    message_lines: list[str]


class KnowledgeImportError(RuntimeError):
    pass


def get_repo_root() -> Path:
    return Path(__file__).resolve().parents[2]


def get_knowledge_root() -> Path:
    custom_dir = (
        os.getenv("CLARA_KNOWLEDGE_DIR")
        or settings.clara_knowledge_dir
        or ""
    ).strip()
    if custom_dir:
        return Path(custom_dir).expanduser().resolve()

    return get_repo_root() / "clara_knowledge"


def get_variant_dir(root_dir: Path, variant: str) -> Path:
    directory_name = VARIANT_DIRECTORIES[variant]
    candidate_dir = root_dir / directory_name
    if candidate_dir.exists():
        return candidate_dir

    if root_dir.name == directory_name:
        return root_dir

    raise KnowledgeImportError(
        f"Folder knowledge varian {variant} tidak ditemukan di {candidate_dir}"
    )


def get_owner_by_email(db: Session, email: str) -> User | None:
    normalized_email = email.strip().lower()
    return db.scalars(select(User).where(User.email == normalized_email)).first()


def load_file_content(file_path: Path) -> str:
    if not file_path.exists():
        raise KnowledgeImportError(f"File knowledge tidak ditemukan: {file_path}")

    content = file_path.read_text(encoding="utf-8").strip()
    if not content:
        raise KnowledgeImportError(f"File knowledge kosong: {file_path}")

    return content


def derive_category(filename: str) -> str:
    stem = filename.removesuffix(".md").upper()
    if "OBJECTION" in stem:
        return "objection_handling"
    if "POSITIONING" in stem:
        return "positioning"
    if "GUARDRAIL" in stem:
        return "guardrail"
    if "FLOW" in stem:
        return "workflow"
    if "PERSONALITY" in stem:
        return "personality_mode"
    if "CLOSING" in stem:
        return "closing_engine"
    if "CONVERSION" in stem:
        return "conversion_engine"
    if "KB_ADDON" in stem or "SALES_KNOWLEDGE_BRIDGE" in stem:
        return "product_facts"
    if "AUTO_ADAPT" in stem:
        return "auto_adapt"
    if "INSTRUCTION" in stem:
        return "instruction"
    return "general"


def humanize_filename(filename: str) -> str:
    stem = filename.removesuffix(".md").replace("_", " ").strip().title()
    return stem.replace("Kb ", "KB ").replace("Ai ", "AI ")


def build_import_items(knowledge_root: Path) -> list[tuple[KnowledgeImportItem, Path]]:
    items: list[tuple[KnowledgeImportItem, Path]] = []
    for variant in ("mini", "regular"):
        variant_dir = get_variant_dir(knowledge_root, variant)
        filenames = {path.name for path in variant_dir.glob("*.md")}
        ordered = [name for name in FILENAME_ORDER if name in filenames]
        remaining = sorted(filenames - set(ordered))

        for filename in [*ordered, *remaining]:
            source_type = f"markdown_import_{variant}"
            item = KnowledgeImportItem(
                variant=variant,
                filename=filename,
                title=f"{variant.title()} | {humanize_filename(filename)}",
                category=derive_category(filename),
                source_type=source_type,
            )
            items.append((item, variant_dir / filename))

    return items


def deactivate_legacy_imports(db: Session) -> int:
    result = db.execute(
        update(ProductKnowledge)
        .where(
            ProductKnowledge.organization_id.is_(None),
            ProductKnowledge.source_type == "markdown_import",
            ProductKnowledge.is_active.is_(True),
        )
        .values(is_active=False)
    )
    return int(result.rowcount or 0)


def get_existing_entries(
    db: Session,
    items: list[tuple[KnowledgeImportItem, Path]],
) -> dict[tuple[str, str], ProductKnowledge]:
    if not items:
        return {}

    titles = [item.title for item, _ in items]
    source_types = sorted({item.source_type for item, _ in items})
    entries = db.scalars(
        select(ProductKnowledge).where(
            ProductKnowledge.organization_id.is_(None),
            ProductKnowledge.title.in_(titles),
            ProductKnowledge.source_type.in_(source_types),
        )
    ).all()
    return {
        (entry.title, entry.source_type): entry
        for entry in entries
    }


def upsert_knowledge_entries(
    db: Session,
    *,
    items: list[tuple[KnowledgeImportItem, Path]],
    created_by_user_id,
) -> list[str]:
    existing_entries = get_existing_entries(db=db, items=items)
    results: list[str] = []

    for item, file_path in items:
        content = load_file_content(file_path)
        existing_entry = existing_entries.get((item.title, item.source_type))

        if existing_entry is None:
            db.add(
                ProductKnowledge(
                    organization_id=None,
                    created_by_user_id=created_by_user_id,
                    title=item.title,
                    category=item.category,
                    content=content,
                    source_type=item.source_type,
                    is_active=True,
                )
            )
            results.append(f"created: {item.title}")
            continue

        existing_entry.category = item.category
        existing_entry.content = content
        existing_entry.is_active = True
        if created_by_user_id is not None:
            existing_entry.created_by_user_id = created_by_user_id
        db.add(existing_entry)
        results.append(f"updated: {item.title}")

    return results


def run_import(db: Session | None = None) -> KnowledgeImportResult:
    knowledge_root = get_knowledge_root()

    if not knowledge_root.exists():
        raise KnowledgeImportError(
            f"Folder knowledge tidak ditemukan di {knowledge_root}"
        )

    owner_email = (
        os.getenv("CLARA_KNOWLEDGE_OWNER_EMAIL")
        or settings.clara_knowledge_owner_email
        or ""
    ).strip()
    created_by_user_id = None
    owns_session = db is None
    session = db or SessionLocal()

    try:
        if owner_email:
            owner = get_owner_by_email(db=session, email=owner_email)

            if owner is None:
                raise KnowledgeImportError(
                    f"Superadmin untuk import knowledge tidak ditemukan: {owner_email}"
                )

            if owner.role != "superadmin":
                raise KnowledgeImportError(
                    f"User {owner.email} ditemukan, tapi rolenya {owner.role}, bukan superadmin."
                )

            created_by_user_id = owner.id

        imported_items = build_import_items(knowledge_root)
        legacy_deactivated_count = deactivate_legacy_imports(session)
        results = upsert_knowledge_entries(
            session,
            items=imported_items,
            created_by_user_id=created_by_user_id,
        )
        session.commit()

        message_lines = ["Import Clara knowledge selesai:"]
        if legacy_deactivated_count:
            message_lines.append(
                f"- legacy markdown_import dinonaktifkan: {legacy_deactivated_count}"
            )
        message_lines.extend(f"- {result}" for result in results)

        return KnowledgeImportResult(
            changed=bool(legacy_deactivated_count or results),
            message_lines=message_lines,
        )
    except KnowledgeImportError:
        session.rollback()
        raise
    finally:
        if owns_session:
            session.close()


def main() -> int:
    try:
        result = run_import()
    except KnowledgeImportError as exc:
        print(f"Import gagal: {exc}")
        return 1

    for line in result.message_lines:
        print(line)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

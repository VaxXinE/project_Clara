from functools import lru_cache
from pathlib import Path

from app.services.business_segmentation_service import normalize_account_category

PLAYBOOK_FILES = (
    "INSTRUCTION.md",
    "GUARDRAIL.md",
    "FLOW.md",
    "PERSONALITY_MODE.md",
    "AUTO_ADAPT.md",
    "CLOSING_ENGINE.md",
    "POSITIONING.md",
    "OBJECTION.md",
    "OBJECTION_EXTREME.md",
    "CONVERSION_BEHAVIOR_ENGINE.md",
    "CONVERSION_LAYER.md",
    "KB_ADDON_BULLETPROOF_SOLID_PRIME.md",
    "KB_ADDON_BULLETPROOF_SOLID_REGULAR.md",
    "SALES_KNOWLEDGE_BRIDGE_MINI.md",
    "SALES_KNOWLEDGE_BRIDGE_REGULAR.md",
)


def get_clara_knowledge_root_dir() -> Path:
    return Path(__file__).resolve().parents[3] / "clara_knowledge"


def get_clara_knowledge_variant_dir(account_category: str | None) -> Path:
    normalized_category = normalize_account_category(account_category)
    root_dir = get_clara_knowledge_root_dir()

    if normalized_category == "mini":
        return root_dir / "clara_knowledge_mini"

    return root_dir / "clara_knowledge_regular"


def read_markdown_file(path: Path) -> str:
    if not path.exists():
        return ""

    return path.read_text(encoding="utf-8").strip()


@lru_cache(maxsize=4)
def load_clara_response_playbook(account_category: str | None = None) -> str:
    knowledge_dir = get_clara_knowledge_variant_dir(account_category)
    sections: list[str] = []

    ordered_files = []
    available_filenames = {path.name for path in knowledge_dir.glob("*.md")}
    for filename in PLAYBOOK_FILES:
        if filename in available_filenames:
            ordered_files.append(filename)

    remaining_files = sorted(available_filenames - set(ordered_files))

    for filename in [*ordered_files, *remaining_files]:
        file_path = knowledge_dir / filename
        content = read_markdown_file(file_path)

        if not content:
            continue

        sections.append(f"## {filename}\n{content}")

    return "\n\n".join(sections).strip()

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

CORE_PLAYBOOK_FILES = (
    "INSTRUCTION.md",
    "GUARDRAIL.md",
    "FLOW.md",
    "PERSONALITY_MODE.md",
    "AUTO_ADAPT.md",
)

FAST_CORE_PLAYBOOK_FILES = (
    "INSTRUCTION.md",
    "GUARDRAIL.md",
    "FLOW.md",
)

ULTRA_FAST_CORE_PLAYBOOK_FILES = (
    "INSTRUCTION.md",
    "GUARDRAIL.md",
)

INTENT_PLAYBOOK_FILES: dict[str, tuple[str, ...]] = {
    "product_options": (
        "POSITIONING.md",
        "SALES_KNOWLEDGE_BRIDGE_MINI.md",
        "SALES_KNOWLEDGE_BRIDGE_REGULAR.md",
        "KB_ADDON_BULLETPROOF_SOLID_PRIME.md",
        "KB_ADDON_BULLETPROOF_SOLID_REGULAR.md",
    ),
    "legality": (
        "OBJECTION.md",
        "OBJECTION_EXTREME.md",
        "KB_ADDON_BULLETPROOF_SOLID_PRIME.md",
        "KB_ADDON_BULLETPROOF_SOLID_REGULAR.md",
    ),
    "safety": (
        "OBJECTION.md",
        "OBJECTION_EXTREME.md",
        "CONVERSION_BEHAVIOR_ENGINE.md",
    ),
    "minimum_capital": (
        "POSITIONING.md",
        "SALES_KNOWLEDGE_BRIDGE_MINI.md",
        "SALES_KNOWLEDGE_BRIDGE_REGULAR.md",
    ),
    "next_step": (
        "FLOW.md",
        "CONVERSION_LAYER.md",
        "CLOSING_ENGINE.md",
    ),
    "setup_scalping": (
        "FLOW.md",
        "OBJECTION.md",
    ),
    "mechanism": (
        "FLOW.md",
        "POSITIONING.md",
    ),
    "beginner": (
        "POSITIONING.md",
        "AUTO_ADAPT.md",
        "SALES_KNOWLEDGE_BRIDGE_MINI.md",
    ),
}


def get_clara_knowledge_root_dir() -> Path:
    return Path(__file__).resolve().parents[3] / "clara_knowledge"


def get_clara_knowledge_variant_dir(account_category: str | None) -> Path:
    normalized_category = normalize_account_category(account_category)
    root_dir = get_clara_knowledge_root_dir()

    if normalized_category == "mini":
        return root_dir / "clara_knowledge_mini"

    return root_dir / "clara_knowledge_regular"


def get_clara_knowledge_variant_dirs(
    account_category: str | None,
    *,
    include_all_variants: bool = False,
) -> list[Path]:
    root_dir = get_clara_knowledge_root_dir()
    normalized_category = normalize_account_category(account_category)

    if include_all_variants or normalized_category == "unknown":
        return [
            root_dir / "clara_knowledge_mini",
            root_dir / "clara_knowledge_regular",
        ]

    return [get_clara_knowledge_variant_dir(account_category)]


@lru_cache(maxsize=128)
def read_markdown_file(path: Path) -> str:
    if not path.exists():
        return ""

    return path.read_text(encoding="utf-8").strip()


@lru_cache(maxsize=32)
def get_selected_playbook_filenames(
    *,
    latest_customer_intent: str | None = None,
    desired_count: int = 3,
    latency_profile: str = "standard",
) -> tuple[str, ...]:
    if desired_count != 1:
        return PLAYBOOK_FILES

    if latency_profile == "ultra_fast":
        ultra_fast_map = {
            "product_options": ("POSITIONING.md",),
            "legality": ("OBJECTION.md",),
            "safety": ("OBJECTION.md",),
            "minimum_capital": ("POSITIONING.md",),
            "beginner": ("POSITIONING.md",),
            "mechanism": ("FLOW.md",),
        }
        extra_files = ultra_fast_map.get(
            latest_customer_intent or "",
            ("POSITIONING.md",),
        )
        ordered = list(
            dict.fromkeys([*ULTRA_FAST_CORE_PLAYBOOK_FILES, *extra_files])
        )
        return tuple(ordered)

    if latency_profile == "fast":
        extra_files = INTENT_PLAYBOOK_FILES.get(
            latest_customer_intent or "",
            ("POSITIONING.md",),
        )
        ordered = list(dict.fromkeys([*FAST_CORE_PLAYBOOK_FILES, *extra_files]))
        return tuple(ordered)

    extra_files = INTENT_PLAYBOOK_FILES.get(
        latest_customer_intent or "",
        ("POSITIONING.md", "OBJECTION.md"),
    )
    ordered = list(dict.fromkeys([*CORE_PLAYBOOK_FILES, *extra_files]))
    return tuple(ordered)


@lru_cache(maxsize=8)
def load_clara_response_playbook(
    account_category: str | None = None,
    include_all_variants: bool = False,
    latest_customer_intent: str | None = None,
    desired_count: int = 3,
    latency_profile: str = "standard",
) -> str:
    sections: list[str] = []
    knowledge_dirs = get_clara_knowledge_variant_dirs(
        account_category,
        include_all_variants=include_all_variants,
    )
    selected_filenames = get_selected_playbook_filenames(
        latest_customer_intent=latest_customer_intent,
        desired_count=desired_count,
        latency_profile=latency_profile,
    )

    for knowledge_dir in knowledge_dirs:
        ordered_files = []
        available_filenames = {path.name for path in knowledge_dir.glob("*.md")}
        for filename in selected_filenames:
            if filename in available_filenames:
                ordered_files.append(filename)

        remaining_files = (
            sorted(available_filenames - set(ordered_files))
            if desired_count != 1
            else []
        )

        for filename in [*ordered_files, *remaining_files]:
            file_path = knowledge_dir / filename
            content = read_markdown_file(file_path)

            if not content:
                continue

            sections.append(
                f"## {knowledge_dir.name}/{filename}\n{content}"
            )

    return "\n\n".join(sections).strip()

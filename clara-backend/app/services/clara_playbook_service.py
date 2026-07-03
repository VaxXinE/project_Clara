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
    "01_solid_prime_chatbox_system_prompt.md",
    "02_solid_prime_faq_answer_library.md",
    "03_solid_prime_compliance_guardrail_escalation.md",
    "04_solid_prime_product_contract_reference_kb.md",
    "05_solid_prime_website_official_source_kb.md",
    "06_solid_prime_lead_qualification_handoff_kb.md",
    "07_solid_prime_conversation_examples_training_dataset_kb.md",
)

SYSTEM_PLAYBOOK_FILES = (
    "INSTRUCTION.md",
    "GUARDRAIL.md",
    "FLOW.md",
    "PERSONALITY_MODE.md",
    "AUTO_ADAPT.md",
)

SUPPORTING_PLAYBOOK_FILES = tuple(
    filename
    for filename in PLAYBOOK_FILES
    if filename not in SYSTEM_PLAYBOOK_FILES
)

INTENT_PLAYBOOK_FILES: dict[str, tuple[str, ...]] = {
    "product_options": (
        "POSITIONING.md",
        "SALES_KNOWLEDGE_BRIDGE_MINI.md",
        "SALES_KNOWLEDGE_BRIDGE_REGULAR.md",
        "KB_ADDON_BULLETPROOF_SOLID_PRIME.md",
        "KB_ADDON_BULLETPROOF_SOLID_REGULAR.md",
        "02_solid_prime_faq_answer_library.md",
        "04_solid_prime_product_contract_reference_kb.md",
    ),
    "legality": (
        "OBJECTION.md",
        "OBJECTION_EXTREME.md",
        "KB_ADDON_BULLETPROOF_SOLID_PRIME.md",
        "KB_ADDON_BULLETPROOF_SOLID_REGULAR.md",
        "03_solid_prime_compliance_guardrail_escalation.md",
        "05_solid_prime_website_official_source_kb.md",
    ),
    "safety": (
        "OBJECTION.md",
        "OBJECTION_EXTREME.md",
        "CONVERSION_BEHAVIOR_ENGINE.md",
        "03_solid_prime_compliance_guardrail_escalation.md",
    ),
    "minimum_capital": (
        "POSITIONING.md",
        "SALES_KNOWLEDGE_BRIDGE_MINI.md",
        "SALES_KNOWLEDGE_BRIDGE_REGULAR.md",
        "02_solid_prime_faq_answer_library.md",
        "04_solid_prime_product_contract_reference_kb.md",
        "05_solid_prime_website_official_source_kb.md",
    ),
    "next_step": (
        "CONVERSION_LAYER.md",
        "CLOSING_ENGINE.md",
        "06_solid_prime_lead_qualification_handoff_kb.md",
    ),
    "setup_scalping": (
        "OBJECTION.md",
        "03_solid_prime_compliance_guardrail_escalation.md",
    ),
    "mechanism": (
        "POSITIONING.md",
        "02_solid_prime_faq_answer_library.md",
        "04_solid_prime_product_contract_reference_kb.md",
    ),
    "beginner": (
        "POSITIONING.md",
        "SALES_KNOWLEDGE_BRIDGE_MINI.md",
        "02_solid_prime_faq_answer_library.md",
        "06_solid_prime_lead_qualification_handoff_kb.md",
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
def get_selected_supporting_playbook_filenames(
    *,
    latest_customer_intent: str | None = None,
    desired_count: int = 3,
    latency_profile: str = "standard",
) -> tuple[str, ...]:
    if desired_count != 1:
        return SUPPORTING_PLAYBOOK_FILES

    if latency_profile == "ultra_fast":
        ultra_fast_map = {
            "product_options": (
                "POSITIONING.md",
                "SALES_KNOWLEDGE_BRIDGE_MINI.md",
                "SALES_KNOWLEDGE_BRIDGE_REGULAR.md",
                "04_solid_prime_product_contract_reference_kb.md",
            ),
            "legality": (
                "OBJECTION.md",
                "05_solid_prime_website_official_source_kb.md",
            ),
            "safety": (
                "OBJECTION.md",
                "03_solid_prime_compliance_guardrail_escalation.md",
            ),
            "minimum_capital": (
                "POSITIONING.md",
                "05_solid_prime_website_official_source_kb.md",
            ),
            "beginner": (
                "POSITIONING.md",
                "06_solid_prime_lead_qualification_handoff_kb.md",
            ),
            "mechanism": (
                "POSITIONING.md",
                "04_solid_prime_product_contract_reference_kb.md",
            ),
        }
        return ultra_fast_map.get(
            latest_customer_intent or "",
            ("POSITIONING.md",),
        )

    if latency_profile == "fast":
        extra_files = INTENT_PLAYBOOK_FILES.get(
            latest_customer_intent or "",
            ("POSITIONING.md",),
        )
        return tuple(dict.fromkeys(extra_files))

    extra_files = INTENT_PLAYBOOK_FILES.get(
        latest_customer_intent or "",
        ("POSITIONING.md", "OBJECTION.md"),
    )
    return tuple(dict.fromkeys(extra_files))


@lru_cache(maxsize=32)
def get_selected_playbook_filenames(
    *,
    latest_customer_intent: str | None = None,
    desired_count: int = 3,
    latency_profile: str = "standard",
) -> tuple[str, ...]:
    return get_selected_supporting_playbook_filenames(
        latest_customer_intent=latest_customer_intent,
        desired_count=desired_count,
        latency_profile=latency_profile,
    )


def _load_playbook_sections(
    knowledge_dirs: list[Path],
    selected_filenames: tuple[str, ...],
    *,
    include_remaining_files: bool,
) -> str:
    sections: list[str] = []

    for knowledge_dir in knowledge_dirs:
        ordered_files = []
        available_filenames = {path.name for path in knowledge_dir.glob("*.md")}
        for filename in selected_filenames:
            if filename in available_filenames:
                ordered_files.append(filename)

        remaining_files = (
            sorted(available_filenames - set(ordered_files))
            if include_remaining_files
            else []
        )

        for filename in [*ordered_files, *remaining_files]:
            file_path = knowledge_dir / filename
            content = read_markdown_file(file_path)

            if not content:
                continue

            sections.append(f"## {knowledge_dir.name}/{filename}\n{content}")

    return "\n\n".join(sections).strip()


@lru_cache(maxsize=8)
def load_clara_system_instruction_playbook(
    account_category: str | None = None,
    *,
    include_all_variants: bool = False,
) -> str:
    knowledge_dirs = get_clara_knowledge_variant_dirs(
        account_category,
        include_all_variants=include_all_variants,
    )
    return _load_playbook_sections(
        knowledge_dirs,
        SYSTEM_PLAYBOOK_FILES,
        include_remaining_files=False,
    )


@lru_cache(maxsize=8)
def load_clara_response_playbook(
    account_category: str | None = None,
    include_all_variants: bool = False,
    latest_customer_intent: str | None = None,
    desired_count: int = 3,
    latency_profile: str = "standard",
) -> str:
    knowledge_dirs = get_clara_knowledge_variant_dirs(
        account_category,
        include_all_variants=include_all_variants,
    )
    selected_filenames = get_selected_supporting_playbook_filenames(
        latest_customer_intent=latest_customer_intent,
        desired_count=desired_count,
        latency_profile=latency_profile,
    )
    return _load_playbook_sections(
        knowledge_dirs,
        selected_filenames,
        include_remaining_files=desired_count != 1,
    )

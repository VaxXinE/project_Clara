from dataclasses import dataclass
from datetime import datetime, timezone
from functools import lru_cache
from hashlib import sha256
import logging
from pathlib import Path

from sqlalchemy import select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.core.clara_runtime_contract import (
    CLARA_RUNTIME_CONTRACT_VERSION,
    LEGACY_BEHAVIOR_OVERLAY,
    PersonaAuthorityMode,
    PromptSectionSource,
    RUNTIME_AUTHORITY_ORDER,
    SYSTEM_PLAYBOOK_SECTION_ORDER,
)
from app.models.ai_persona_config_version import AIPersonaConfigVersion
from app.services.business_segmentation_service import normalize_account_category

playbook_logger = logging.getLogger("clara.playbook")

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

SYSTEM_PLAYBOOK_FILES = tuple(
    f"{section.name}.md" for section in SYSTEM_PLAYBOOK_SECTION_ORDER
)

SYSTEM_SECTION_KEYS = {
    "INSTRUCTION.md": "instruction",
    "GUARDRAIL.md": "guardrail",
    "FLOW.md": "flow",
    "PERSONALITY_MODE.md": "personality_mode",
    "AUTO_ADAPT.md": "auto_adapt",
}


@dataclass(frozen=True)
class EffectivePersonaSection:
    content: str
    section_key: str
    source: str
    variant: str
    version_id: str | None = None
    version_number: int | None = None


@dataclass(frozen=True)
class PromptSectionProvenance:
    section_name: str
    effective_source: PromptSectionSource
    source_identifier: str | None
    version: int | None
    publication_timestamp: str | None
    content_hash: str
    load_timestamp: str
    fallback_reason: str | None

    def as_debug_dict(self) -> dict:
        return {
            "section_name": self.section_name,
            "effective_source": self.effective_source.value,
            "source_identifier": self.source_identifier,
            "version": self.version,
            "publication_timestamp": self.publication_timestamp,
            "content_hash": self.content_hash,
            "load_timestamp": self.load_timestamp,
            "fallback_reason": self.fallback_reason,
        }


@dataclass(frozen=True)
class EffectiveSystemSection:
    content: str
    filename: str
    section_key: str
    variant: str
    provenance: PromptSectionProvenance


@dataclass(frozen=True)
class ClaraPlaybookComposition:
    system_playbook: str
    supporting_playbook: str
    system_sections: tuple[EffectiveSystemSection, ...]
    supporting_knowledge_count: int
    response_example_count: int

    def combined_playbook(self) -> str:
        return "\n\n".join(
            part for part in (self.system_playbook, self.supporting_playbook) if part
        )

    def debug_metadata(
        self,
        persona_authority_mode: PersonaAuthorityMode = PersonaAuthorityMode.LEGACY,
    ) -> dict:
        return {
            "runtime_contract_version": CLARA_RUNTIME_CONTRACT_VERSION,
            "authority_order": [layer.value for layer in RUNTIME_AUTHORITY_ORDER],
            "active_system_sections": [
                section.provenance.as_debug_dict()
                for section in self.system_sections
                if section.provenance.effective_source != PromptSectionSource.MISSING
            ],
            "legacy_overlay_present": (
                persona_authority_mode == PersonaAuthorityMode.LEGACY
            ),
            "legacy_overlay_name": LEGACY_BEHAVIOR_OVERLAY,
            "supporting_knowledge_count": self.supporting_knowledge_count,
            "response_example_count": self.response_example_count,
            "missing_required_sections": [
                f"{section.variant}:{section.section_key}"
                for section in self.system_sections
                if section.provenance.effective_source == PromptSectionSource.MISSING
            ],
        }


SUPPORTING_PLAYBOOK_FILES = tuple(
    filename for filename in PLAYBOOK_FILES if filename not in SYSTEM_PLAYBOOK_FILES
)
RESPONSE_EXAMPLE_FILES = (
    "07_solid_prime_conversation_examples_training_dataset_kb.md",
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
    excluded_filenames: tuple[str, ...] = (),
) -> str:
    sections: list[str] = []

    for knowledge_dir in knowledge_dirs:
        ordered_files = []
        available_filenames = {path.name for path in knowledge_dir.glob("*.md")}
        for filename in selected_filenames:
            if filename in available_filenames:
                ordered_files.append(filename)

        remaining_files = (
            sorted(available_filenames - set(ordered_files) - set(excluded_filenames))
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


def _content_hash(content: str) -> str:
    return sha256(content.encode("utf-8")).hexdigest()


def _source_identifier(path: Path) -> str:
    repository_root = get_clara_knowledge_root_dir().parent
    try:
        return path.relative_to(repository_root).as_posix()
    except ValueError:
        return path.as_posix()


def load_effective_system_sections(
    db: Session | None,
    account_category: str | None = None,
    *,
    include_all_variants: bool = False,
) -> list[EffectiveSystemSection]:
    knowledge_dirs = get_clara_knowledge_variant_dirs(
        account_category,
        include_all_variants=include_all_variants,
    )
    variants = [
        "mini" if directory.name.endswith("_mini") else "reguler"
        for directory in knowledge_dirs
    ]
    database_unavailable = False
    published_entries: list[AIPersonaConfigVersion] = []
    if db is not None:
        try:
            published_entries = list(
                db.scalars(
                    select(AIPersonaConfigVersion).where(
                        AIPersonaConfigVersion.variant.in_(variants),
                        AIPersonaConfigVersion.status == "published",
                    )
                ).all()
            )
        except SQLAlchemyError:
            db.rollback()
            playbook_logger.warning(
                "ai_persona_config_database_fallback",
                extra={"variants": variants},
            )
            database_unavailable = True

    published_by_key = {
        (entry.variant, entry.section_key): entry for entry in published_entries
    }
    load_timestamp = datetime.now(timezone.utc).isoformat()
    sections: list[EffectiveSystemSection] = []
    for knowledge_dir, variant in zip(knowledge_dirs, variants, strict=True):
        for filename in SYSTEM_PLAYBOOK_FILES:
            section_key = SYSTEM_SECTION_KEYS[filename]
            entry = published_by_key.get((variant, section_key))
            if entry:
                sections.append(
                    EffectiveSystemSection(
                        content=entry.content,
                        filename=filename,
                        section_key=section_key,
                        variant=variant,
                        provenance=PromptSectionProvenance(
                            section_name=section_key,
                            effective_source=PromptSectionSource.DATABASE_PUBLISHED,
                            source_identifier=f"ai_persona_config_versions:{entry.id}",
                            version=entry.version_number,
                            publication_timestamp=(
                                entry.published_at.isoformat()
                                if entry.published_at
                                else None
                            ),
                            content_hash=_content_hash(entry.content),
                            load_timestamp=load_timestamp,
                            fallback_reason=None,
                        ),
                    )
                )
                continue

            markdown_path = knowledge_dir / filename
            content = read_markdown_file(markdown_path)
            if content:
                sections.append(
                    EffectiveSystemSection(
                        content=content,
                        filename=filename,
                        section_key=section_key,
                        variant=variant,
                        provenance=PromptSectionProvenance(
                            section_name=section_key,
                            effective_source=PromptSectionSource.MARKDOWN_FALLBACK,
                            source_identifier=_source_identifier(markdown_path),
                            version=None,
                            publication_timestamp=None,
                            content_hash=_content_hash(content),
                            load_timestamp=load_timestamp,
                            fallback_reason=(
                                "DATABASE_UNAVAILABLE"
                                if database_unavailable
                                else (
                                    "DATABASE_NOT_REQUESTED"
                                    if db is None
                                    else "NO_DATABASE_PUBLISHED_VERSION"
                                )
                            ),
                        ),
                    )
                )
                continue

            sections.append(
                EffectiveSystemSection(
                    content="",
                    filename=filename,
                    section_key=section_key,
                    variant=variant,
                    provenance=PromptSectionProvenance(
                        section_name=section_key,
                        effective_source=PromptSectionSource.MISSING,
                        source_identifier=None,
                        version=None,
                        publication_timestamp=None,
                        content_hash=_content_hash(""),
                        load_timestamp=load_timestamp,
                        fallback_reason=(
                            "DATABASE_UNAVAILABLE_AND_MARKDOWN_MISSING"
                            if database_unavailable
                            else (
                                "DATABASE_NOT_REQUESTED_AND_MARKDOWN_MISSING"
                                if db is None
                                else "NO_DATABASE_PUBLISHED_VERSION_AND_MARKDOWN_MISSING"
                            )
                        ),
                    ),
                )
            )
    return sections


def load_effective_persona_sections(
    db: Session,
    account_category: str | None = None,
    *,
    include_all_variants: bool = False,
) -> list[EffectivePersonaSection]:
    return [
        EffectivePersonaSection(
            content=section.content,
            section_key=section.section_key,
            source=(
                "database"
                if section.provenance.effective_source
                == PromptSectionSource.DATABASE_PUBLISHED
                else "markdown"
            ),
            variant=section.variant,
            version_id=(
                section.provenance.source_identifier.rsplit(":", 1)[-1]
                if section.provenance.effective_source
                == PromptSectionSource.DATABASE_PUBLISHED
                and section.provenance.source_identifier
                else None
            ),
            version_number=section.provenance.version,
        )
        for section in load_effective_system_sections(
            db,
            account_category,
            include_all_variants=include_all_variants,
        )
        if section.provenance.effective_source != PromptSectionSource.MISSING
    ]


def load_effective_clara_system_instruction_playbook(
    db: Session,
    account_category: str | None = None,
    *,
    include_all_variants: bool = False,
) -> str:
    sections = load_effective_system_sections(
        db,
        account_category,
        include_all_variants=include_all_variants,
    )
    return "\n\n".join(
        (f"## clara_knowledge_{section.variant}/{section.filename}\n{section.content}")
        for section in sections
        if section.provenance.effective_source != PromptSectionSource.MISSING
    ).strip()


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
        excluded_filenames=SYSTEM_PLAYBOOK_FILES,
    )


def _count_loaded_supporting_playbooks(
    knowledge_dirs: list[Path],
    selected_filenames: tuple[str, ...],
    *,
    include_remaining_files: bool,
) -> int:
    count = 0
    for knowledge_dir in knowledge_dirs:
        available_filenames = {
            path.name
            for path in knowledge_dir.glob("*.md")
            if path.name not in SYSTEM_PLAYBOOK_FILES
        }
        filenames = [
            filename
            for filename in selected_filenames
            if filename in available_filenames
        ]
        if include_remaining_files:
            filenames.extend(sorted(available_filenames - set(filenames)))
        count += sum(
            bool(read_markdown_file(knowledge_dir / filename)) for filename in filenames
        )
    return count


def _count_loaded_response_examples(
    knowledge_dirs: list[Path],
    selected_filenames: tuple[str, ...],
    *,
    include_remaining_files: bool,
) -> int:
    return sum(
        bool(read_markdown_file(knowledge_dir / filename))
        for knowledge_dir in knowledge_dirs
        for filename in RESPONSE_EXAMPLE_FILES
        if include_remaining_files or filename in selected_filenames
    )


def compose_clara_playbooks(
    db: Session | None,
    account_category: str | None = None,
    *,
    include_all_variants: bool = False,
    latest_customer_intent: str | None = None,
    desired_count: int = 3,
    latency_profile: str = "standard",
) -> ClaraPlaybookComposition:
    system_sections = tuple(
        load_effective_system_sections(
            db,
            account_category,
            include_all_variants=include_all_variants,
        )
    )
    system_playbook = "\n\n".join(
        (f"## clara_knowledge_{section.variant}/{section.filename}\n{section.content}")
        for section in system_sections
        if section.provenance.effective_source != PromptSectionSource.MISSING
    ).strip()
    supporting_playbook = load_clara_response_playbook(
        account_category,
        include_all_variants=include_all_variants,
        latest_customer_intent=latest_customer_intent,
        desired_count=desired_count,
        latency_profile=latency_profile,
    )
    knowledge_dirs = get_clara_knowledge_variant_dirs(
        account_category,
        include_all_variants=include_all_variants,
    )
    selected_filenames = get_selected_supporting_playbook_filenames(
        latest_customer_intent=latest_customer_intent,
        desired_count=desired_count,
        latency_profile=latency_profile,
    )
    return ClaraPlaybookComposition(
        system_playbook=system_playbook,
        supporting_playbook=supporting_playbook,
        system_sections=system_sections,
        supporting_knowledge_count=_count_loaded_supporting_playbooks(
            knowledge_dirs,
            selected_filenames,
            include_remaining_files=desired_count != 1,
        ),
        response_example_count=_count_loaded_response_examples(
            knowledge_dirs,
            selected_filenames,
            include_remaining_files=desired_count != 1,
        ),
    )

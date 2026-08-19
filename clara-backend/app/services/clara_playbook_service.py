from dataclasses import dataclass
from datetime import datetime, timezone
from functools import lru_cache
from hashlib import sha256
import logging
from pathlib import Path

from sqlalchemy import select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session, selectinload

from app.core.clara_runtime_contract import (
    CLARA_RUNTIME_CONTRACT_VERSION,
    LEGACY_BEHAVIOR_OVERLAY,
    PersonaAuthorityMode,
    PromptSectionSource,
    RUNTIME_AUTHORITY_ORDER,
    SYSTEM_PLAYBOOK_SECTION_ORDER,
)
from app.models.ai_persona_config_version import AIPersonaConfigVersion
from app.models.ai_persona_bundle import AIPersonaBundle, AIPersonaBundleSection
from app.services.ai_persona_bundle_service import (
    CLARA_PERSONA_BUNDLE_CONTRACT_VERSION,
    RUNTIME_SECTION_ORDER,
    _bundle_hash,
)
from app.services.business_segmentation_service import normalize_account_category

playbook_logger = logging.getLogger("clara.playbook")

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
    version_id: str | None = None
    bundle_id: str | None = None
    bundle_version: int | None = None
    bundle_hash: str | None = None
    bundle_contract_version: str | None = None

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
            "version_id": self.version_id,
            "bundle_id": self.bundle_id,
            "bundle_version": self.bundle_version,
            "bundle_hash": self.bundle_hash,
            "bundle_contract_version": self.bundle_contract_version,
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
        bundle_section = next(
            (section for section in self.system_sections if section.provenance.bundle_id),
            None,
        )
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
            "persona_bundle_id": (
                bundle_section.provenance.bundle_id if bundle_section else None
            ),
            "persona_bundle_version": (
                bundle_section.provenance.bundle_version if bundle_section else None
            ),
            "persona_bundle_hash": (
                bundle_section.provenance.bundle_hash if bundle_section else None
            ),
            "persona_bundle_source": (
                PromptSectionSource.DATABASE_PUBLISHED_BUNDLE.value
                if bundle_section
                else None
            ),
            "persona_bundle_contract_version": (
                bundle_section.provenance.bundle_contract_version
                if bundle_section
                else None
            ),
            "persona_bundle_section_versions": {
                section.section_key: section.provenance.version_id
                for section in self.system_sections
                if section.provenance.version_id
            },
            "persona_bundle_section_hashes": {
                section.section_key: section.provenance.content_hash
                for section in self.system_sections
                if section.provenance.bundle_id
            },
            "persona_bundle_effective_source_status": (
                "COMPLETE_PUBLISHED_BUNDLE" if bundle_section else "LEGACY_FALLBACK"
            ),
            "persona_bundle_fallback_reason": (
                None
                if bundle_section
                else next(
                    (
                        section.provenance.fallback_reason
                        for section in self.system_sections
                        if section.provenance.fallback_reason
                    ),
                    "NO_PUBLISHED_BUNDLE",
                )
            ),
            "missing_required_sections": [
                f"{section.variant}:{section.section_key}"
                for section in self.system_sections
                if section.provenance.effective_source == PromptSectionSource.MISSING
            ],
        }


RESPONSE_EXAMPLE_FILES = ("07_solid_prime_conversation_examples_training_dataset_kb.md",)

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
        "LEGALITY_KNOWLEDGE.md",
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
    "product_costs": (
        "PRODUCT_COSTS_KNOWLEDGE.md",
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
    if latency_profile == "ultra_fast":
        ultra_fast_map = {
            "product_options": (
                "POSITIONING.md",
                "SALES_KNOWLEDGE_BRIDGE_MINI.md",
                "SALES_KNOWLEDGE_BRIDGE_REGULAR.md",
                "04_solid_prime_product_contract_reference_kb.md",
            ),
            "legality": (
                "LEGALITY_KNOWLEDGE.md",
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
            "product_costs": ("PRODUCT_COSTS_KNOWLEDGE.md",),
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
    published_bundles: dict[str, AIPersonaBundle] = {}
    if db is not None:
        try:
            bundle_entries = list(
                db.scalars(
                    select(AIPersonaBundle)
                    .where(
                        AIPersonaBundle.variant.in_(variants),
                        AIPersonaBundle.status == "published",
                    )
                    .options(
                        selectinload(AIPersonaBundle.sections).selectinload(
                            AIPersonaBundleSection.persona_config_version
                        )
                    )
                ).all()
            )
            published_bundles = {bundle.variant: bundle for bundle in bundle_entries}
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
        bundle = published_bundles.get(variant)
        if bundle:
            bundle_sections = {
                item.section_key: item for item in bundle.sections
            }
            valid_bundle = (
                len(bundle.sections) == 5
                and set(bundle_sections) == set(RUNTIME_SECTION_ORDER)
                and [
                    item.section_key
                    for item in sorted(bundle.sections, key=lambda row: row.position)
                ]
                == list(RUNTIME_SECTION_ORDER)
                and all(
                    item.persona_config_version is not None
                    and item.persona_config_version.variant == variant
                    and item.persona_config_version.section_key == item.section_key
                    and _content_hash(item.persona_config_version.content.strip())
                    == item.content_sha256
                    == item.persona_config_version.content_sha256
                    for item in bundle.sections
                )
                and bundle.bundle_sha256 == _bundle_hash(bundle)
            )
            if not valid_bundle:
                playbook_logger.error(
                    "ai_persona_published_bundle_invalid",
                    extra={
                        "variant": variant,
                        "bundle_id": str(bundle.id),
                        "bundle_hash": bundle.bundle_sha256,
                    },
                )
                for filename in SYSTEM_PLAYBOOK_FILES:
                    section_key = SYSTEM_SECTION_KEYS[filename]
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
                                fallback_reason="INVALID_PUBLISHED_BUNDLE_FAIL_CLOSED",
                                bundle_id=str(bundle.id),
                                bundle_version=bundle.bundle_version,
                                bundle_hash=bundle.bundle_sha256,
                                bundle_contract_version=(
                                    CLARA_PERSONA_BUNDLE_CONTRACT_VERSION
                                ),
                            ),
                        )
                    )
                continue
            for filename in SYSTEM_PLAYBOOK_FILES:
                section_key = SYSTEM_SECTION_KEYS[filename]
                item = bundle_sections[section_key]
                version = item.persona_config_version
                sections.append(
                    EffectiveSystemSection(
                        content=version.content,
                        filename=filename,
                        section_key=section_key,
                        variant=variant,
                        provenance=PromptSectionProvenance(
                            section_name=section_key,
                            effective_source=(
                                PromptSectionSource.DATABASE_PUBLISHED_BUNDLE
                            ),
                            source_identifier=f"ai_persona_bundles:{bundle.id}",
                            version=version.version_number,
                            publication_timestamp=(
                                bundle.published_at.isoformat()
                                if bundle.published_at
                                else None
                            ),
                            content_hash=item.content_sha256,
                            load_timestamp=load_timestamp,
                            fallback_reason=None,
                            version_id=str(version.id),
                            bundle_id=str(bundle.id),
                            bundle_version=bundle.bundle_version,
                            bundle_hash=bundle.bundle_sha256,
                            bundle_contract_version=(
                                CLARA_PERSONA_BUNDLE_CONTRACT_VERSION
                            ),
                        ),
                    )
                )
            continue
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
                            version_id=str(entry.id),
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
                in {
                    PromptSectionSource.DATABASE_PUBLISHED,
                    PromptSectionSource.DATABASE_PUBLISHED_BUNDLE,
                }
                else "markdown"
            ),
            variant=section.variant,
            version_id=(
                section.provenance.version_id
                if section.provenance.effective_source
                in {
                    PromptSectionSource.DATABASE_PUBLISHED,
                    PromptSectionSource.DATABASE_PUBLISHED_BUNDLE,
                }
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
        include_remaining_files=False,
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
    # Database-backed runtime uses ProductKnowledge as the editable supporting
    # authority. Markdown remains an offline/fallback source when no DB exists.
    supporting_playbook = (
        load_clara_response_playbook(
            account_category,
            include_all_variants=include_all_variants,
            latest_customer_intent=latest_customer_intent,
            desired_count=desired_count,
            latency_profile=latency_profile,
        )
        if db is None
        else ""
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
        supporting_knowledge_count=(
            _count_loaded_supporting_playbooks(
                knowledge_dirs,
                selected_filenames,
                include_remaining_files=False,
            )
            if db is None
            else 0
        ),
        response_example_count=(
            _count_loaded_response_examples(
                knowledge_dirs,
                selected_filenames,
                include_remaining_files=False,
            )
            if db is None
            else 0
        ),
    )

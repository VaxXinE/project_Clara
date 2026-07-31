from dataclasses import asdict, dataclass
from enum import StrEnum
from typing import TypeVar


CLARA_RUNTIME_CONTRACT_VERSION = "1.0"
LEGACY_BEHAVIOR_OVERLAY = "LEGACY_BEHAVIOR_OVERLAY"


class TopLevelRouteIntent(StrEnum):
    SALES = "SALES"
    COMPLIANCE_GENERAL = "COMPLIANCE_GENERAL"
    CS_GENERAL = "CS_GENERAL"
    COMPLAINT = "COMPLAINT"
    OFF_TOPIC = "OFF_TOPIC"
    UNKNOWN = "UNKNOWN"


class ConversationIntent(StrEnum):
    INFO_SEEKING = "INFO_SEEKING"
    LEGALITY_CHECK = "LEGALITY_CHECK"
    RISK_CHECK = "RISK_CHECK"
    COST_CHECK = "COST_CHECK"
    PRODUCT_FIT_CHECK = "PRODUCT_FIT_CHECK"
    PROCESS_CHECK = "PROCESS_CHECK"
    READINESS_VALIDATION = "READINESS_VALIDATION"
    OBJECTION = "OBJECTION"
    CLOSING_SIGNAL = "CLOSING_SIGNAL"
    POST_ACTIVATION_SUPPORT = "POST_ACTIVATION_SUPPORT"
    COMPLAINT_OR_PROBLEM = "COMPLAINT_OR_PROBLEM"
    UNKNOWN = "UNKNOWN"


class InterestLevel(StrEnum):
    COLD = "COLD"
    WARM = "WARM"
    HOT = "HOT"
    UNKNOWN = "UNKNOWN"


class ProcessState(StrEnum):
    NEW_INQUIRY = "NEW_INQUIRY"
    EXPLORATION = "EXPLORATION"
    READY_TO_PROCEED = "READY_TO_PROCEED"
    DATA_SUBMITTED = "DATA_SUBMITTED"
    VERIFICATION_IN_PROGRESS = "VERIFICATION_IN_PROGRESS"
    VERIFIED = "VERIFIED"
    ONBOARDING_OR_ACTIVATION = "ONBOARDING_OR_ACTIVATION"
    ACCOUNT_ACTIVE = "ACCOUNT_ACTIVE"
    FUNDED = "FUNDED"
    ACTIVE_SUPPORT = "ACTIVE_SUPPORT"
    UNKNOWN = "UNKNOWN"


class PersonalityMode(StrEnum):
    RELAX = "RELAX"
    TRUST = "TRUST"
    AUTHORITY = "AUTHORITY"
    ACTION = "ACTION"


class ActionMode(StrEnum):
    NORMAL = "NORMAL"
    HUMAN_REVIEW = "HUMAN_REVIEW"
    SAFE_HANDOFF = "SAFE_HANDOFF"
    BLOCK = "BLOCK"
    UNKNOWN = "UNKNOWN"


class PersonaAuthorityMode(StrEnum):
    LEGACY = "LEGACY"
    HYBRID = "HYBRID"
    PERSONA = "PERSONA"


class RuntimeAuthorityLayer(StrEnum):
    BACKEND_SAFETY_ENFORCEMENT = "BACKEND_SAFETY_ENFORCEMENT"
    POLICY_DECISION = "POLICY_DECISION"
    FIVE_PUBLISHED_SYSTEM_PLAYBOOKS = "FIVE_PUBLISHED_SYSTEM_PLAYBOOKS"
    STRUCTURED_RUNTIME_STATE = "STRUCTURED_RUNTIME_STATE"
    APPROVED_PRODUCT_FACTS = "APPROVED_PRODUCT_FACTS"
    SUPPORTING_KNOWLEDGE = "SUPPORTING_KNOWLEDGE"
    RESPONSE_EXAMPLES = "RESPONSE_EXAMPLES"


class SystemPlaybookSection(StrEnum):
    INSTRUCTION = "instruction"
    GUARDRAIL = "guardrail"
    FLOW = "flow"
    PERSONALITY_MODE = "personality_mode"
    AUTO_ADAPT = "auto_adapt"


class PromptSectionSource(StrEnum):
    DATABASE_PUBLISHED = "DATABASE_PUBLISHED"
    MARKDOWN_FALLBACK = "MARKDOWN_FALLBACK"
    MISSING = "MISSING"


RUNTIME_AUTHORITY_ORDER = tuple(RuntimeAuthorityLayer)
SYSTEM_PLAYBOOK_SECTION_ORDER = tuple(SystemPlaybookSection)

PROCESS_STATE_METADATA = {
    ProcessState.NEW_INQUIRY: (10, "Pertanyaan awal tanpa proses yang terkonfirmasi."),
    ProcessState.EXPLORATION: (
        20,
        "Customer masih mengeksplorasi informasi atau kecocokan.",
    ),
    ProcessState.READY_TO_PROCEED: (
        30,
        "Customer menyatakan siap menuju proses berikutnya.",
    ),
    ProcessState.DATA_SUBMITTED: (40, "Data awal telah diserahkan."),
    ProcessState.VERIFICATION_IN_PROGRESS: (50, "Verifikasi sedang berjalan."),
    ProcessState.VERIFIED: (60, "Verifikasi telah selesai."),
    ProcessState.ONBOARDING_OR_ACTIVATION: (
        70,
        "Onboarding atau aktivasi sedang berjalan.",
    ),
    ProcessState.ACCOUNT_ACTIVE: (80, "Akun telah aktif."),
    ProcessState.FUNDED: (90, "Pendanaan telah dikonfirmasi."),
    ProcessState.ACTIVE_SUPPORT: (100, "Customer berada pada dukungan pasca-aktivasi."),
    ProcessState.UNKNOWN: (None, "Process state belum dapat ditentukan."),
}


TCanonical = TypeVar("TCanonical", bound=StrEnum)


@dataclass(frozen=True)
class NormalizationResult:
    canonical_value: str
    original_value: str | None
    was_normalized: bool
    is_legacy: bool
    is_unknown: bool
    legacy_signal: str | None = None
    warning: str | None = None

    def as_dict(self) -> dict:
        return asdict(self)


def _normalize(
    value: str | None,
    enum_type: type[TCanonical],
    *,
    aliases: dict[str, TCanonical] | None = None,
    legacy_values: set[str] | None = None,
) -> NormalizationResult:
    original = value
    normalized = value.strip().upper() if isinstance(value, str) else ""
    alias = (aliases or {}).get(normalized)
    canonical_value = alias.value if alias is not None else None
    if canonical_value is None:
        try:
            canonical_value = enum_type(normalized).value
        except ValueError:
            canonical_value = "UNKNOWN"

    is_legacy = normalized in (legacy_values or set())
    is_unknown = canonical_value == "UNKNOWN"
    return NormalizationResult(
        canonical_value=canonical_value,
        original_value=original,
        was_normalized=original != canonical_value,
        is_legacy=is_legacy,
        is_unknown=is_unknown,
        legacy_signal=normalized if is_legacy else None,
        warning=(
            f"Legacy value {normalized} normalized to {canonical_value}."
            if is_legacy
            else (
                f"Unknown value {original!r}; canonical value is UNKNOWN."
                if is_unknown
                else None
            )
        ),
    )


def normalize_top_level_route_intent(value: str | None) -> NormalizationResult:
    return _normalize(value, TopLevelRouteIntent)


def normalize_conversation_intent(value: str | None) -> NormalizationResult:
    return _normalize(value, ConversationIntent)


def normalize_interest_level(value: str | None) -> NormalizationResult:
    if isinstance(value, str) and value.strip().upper() == "DELAY":
        return NormalizationResult(
            canonical_value=InterestLevel.UNKNOWN,
            original_value=value,
            was_normalized=True,
            is_legacy=True,
            is_unknown=True,
            legacy_signal="DELAY",
            warning="DELAY has no approved canonical interest mapping.",
        )
    return _normalize(value, InterestLevel)


def normalize_process_state(value: str | None) -> NormalizationResult:
    return _normalize(value, ProcessState)


def normalize_personality_mode(value: str | None) -> NormalizationResult:
    return _normalize(
        value,
        PersonalityMode,
        aliases={"CLOSING": PersonalityMode.ACTION},
        legacy_values={"CLOSING"},
    )


def normalize_action_mode(value: str | None) -> NormalizationResult:
    aliases = {
        "AUTO_DRAFT_ONLY": ActionMode.NORMAL,
        "REPLY_DIRECT": ActionMode.NORMAL,
        "REPLY_NOW": ActionMode.NORMAL,
        "HUMAN_APPROVAL_REQUIRED": ActionMode.HUMAN_REVIEW,
        "ESCALATE_TO_HUMAN": ActionMode.SAFE_HANDOFF,
    }
    return _normalize(
        value,
        ActionMode,
        aliases=aliases,
        legacy_values=set(aliases),
    )


def normalize_persona_authority_mode(value: str | None) -> NormalizationResult:
    original = value
    normalized = value.strip().upper() if isinstance(value, str) else ""
    try:
        canonical_value = PersonaAuthorityMode(normalized).value
        is_unknown = False
    except ValueError:
        canonical_value = PersonaAuthorityMode.LEGACY.value
        is_unknown = True

    return NormalizationResult(
        canonical_value=canonical_value,
        original_value=original,
        was_normalized=original != canonical_value,
        is_legacy=canonical_value == PersonaAuthorityMode.LEGACY,
        is_unknown=is_unknown,
        warning=(
            f"Unknown persona authority mode {original!r}; falling back to LEGACY."
            if is_unknown
            else None
        ),
    )


def runtime_contract_audit_metadata() -> dict[str, str | bool]:
    from app.core.config import settings

    mode = normalize_persona_authority_mode(
        settings.clara_persona_authority_mode
    ).canonical_value
    return {
        "clara_runtime_contract_version": CLARA_RUNTIME_CONTRACT_VERSION,
        "legacy_behavior_overlay": mode == PersonaAuthorityMode.LEGACY,
        "legacy_behavior_overlay_name": LEGACY_BEHAVIOR_OVERLAY,
    }

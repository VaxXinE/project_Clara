from dataclasses import dataclass
from enum import StrEnum
from hashlib import sha256

from app.core.clara_runtime_contract import PersonaAuthorityMode


CLARA_RETRY_CONTRACT_VERSION = "1.0"


class ValidatorAuthorityOwner(StrEnum):
    BACKEND_SAFETY = "BACKEND_SAFETY"
    GUARDRAIL = "GUARDRAIL"
    FLOW = "FLOW"
    PERSONALITY_MODE = "PERSONALITY_MODE"
    AUTO_ADAPT = "AUTO_ADAPT"
    PRODUCT_FACT = "PRODUCT_FACT"
    TECHNICAL_OUTPUT = "TECHNICAL_OUTPUT"
    RUNTIME_CONTEXT = "RUNTIME_CONTEXT"


class RetryInstructionType(StrEnum):
    TECHNICAL_CORRECTION = "TECHNICAL_CORRECTION"
    PERSONA_SECTION_REFERENCE = "PERSONA_SECTION_REFERENCE"
    LEGACY_COMPATIBILITY = "LEGACY_COMPATIBILITY"


@dataclass(frozen=True)
class ValidatorRule:
    validator_id: str
    category: str
    canonical_authority_owner: ValidatorAuthorityOwner
    severity: str
    retry_instruction_type: RetryInstructionType
    correction_target: str
    safe_metadata: tuple[str, ...] = ()


VALIDATOR_RULES = (
    ValidatorRule(
        "mixed_register",
        "style",
        ValidatorAuthorityOwner.PERSONALITY_MODE,
        "LOW",
        RetryInstructionType.PERSONA_SECTION_REFERENCE,
        "register_consistency",
    ),
    ValidatorRule(
        "missing_product_options",
        "grounding",
        ValidatorAuthorityOwner.PRODUCT_FACT,
        "MEDIUM",
        RetryInstructionType.TECHNICAL_CORRECTION,
        "required_grounded_options_missing",
    ),
    ValidatorRule(
        "unsupported_variant",
        "grounding",
        ValidatorAuthorityOwner.PRODUCT_FACT,
        "HIGH",
        RetryInstructionType.TECHNICAL_CORRECTION,
        "unsupported_variant_reference",
    ),
    ValidatorRule(
        "unnecessary_variant",
        "grounding",
        ValidatorAuthorityOwner.RUNTIME_CONTEXT,
        "MEDIUM",
        RetryInstructionType.TECHNICAL_CORRECTION,
        "variant_not_requested",
    ),
    ValidatorRule(
        "missing_legality_authority",
        "legality",
        ValidatorAuthorityOwner.PRODUCT_FACT,
        "HIGH",
        RetryInstructionType.TECHNICAL_CORRECTION,
        "required_grounded_legality_authority_missing",
    ),
    ValidatorRule(
        "vague_legality_deflection",
        "legality",
        ValidatorAuthorityOwner.GUARDRAIL,
        "HIGH",
        RetryInstructionType.PERSONA_SECTION_REFERENCE,
        "legality_answer_deflected",
    ),
    ValidatorRule(
        "unsupported_fixed_sensitive_number",
        "grounding",
        ValidatorAuthorityOwner.PRODUCT_FACT,
        "CRITICAL",
        RetryInstructionType.TECHNICAL_CORRECTION,
        "unsupported_numeric_fact",
    ),
    ValidatorRule(
        "post_signup_regression",
        "continuity",
        ValidatorAuthorityOwner.FLOW,
        "HIGH",
        RetryInstructionType.PERSONA_SECTION_REFERENCE,
        "process_state_regressed",
    ),
    ValidatorRule(
        "repeated_product_selection",
        "continuity",
        ValidatorAuthorityOwner.FLOW,
        "MEDIUM",
        RetryInstructionType.PERSONA_SECTION_REFERENCE,
        "product_selection_repeated",
    ),
    ValidatorRule(
        "repeated_identity_request",
        "continuity",
        ValidatorAuthorityOwner.RUNTIME_CONTEXT,
        "HIGH",
        RetryInstructionType.TECHNICAL_CORRECTION,
        "known_identity_field_requested_again",
    ),
    ValidatorRule(
        "abstract_data_requirement",
        "continuity",
        ValidatorAuthorityOwner.FLOW,
        "MEDIUM",
        RetryInstructionType.PERSONA_SECTION_REFERENCE,
        "required_data_detail_missing",
    ),
    ValidatorRule(
        "vague_process_direction",
        "continuity",
        ValidatorAuthorityOwner.FLOW,
        "HIGH",
        RetryInstructionType.PERSONA_SECTION_REFERENCE,
        "process_direction_not_concrete",
    ),
    ValidatorRule(
        "repeated_onboarding",
        "continuity",
        ValidatorAuthorityOwner.FLOW,
        "HIGH",
        RetryInstructionType.PERSONA_SECTION_REFERENCE,
        "completed_milestone_reopened",
    ),
    ValidatorRule(
        "followup_topic_break",
        "continuity",
        ValidatorAuthorityOwner.RUNTIME_CONTEXT,
        "MEDIUM",
        RetryInstructionType.TECHNICAL_CORRECTION,
        "followup_topic_not_preserved",
    ),
    ValidatorRule(
        "subject_focus_break",
        "continuity",
        ValidatorAuthorityOwner.RUNTIME_CONTEXT,
        "MEDIUM",
        RetryInstructionType.TECHNICAL_CORRECTION,
        "subject_focus_not_preserved",
    ),
    ValidatorRule(
        "repetitive_closing",
        "style",
        ValidatorAuthorityOwner.PERSONALITY_MODE,
        "LOW",
        RetryInstructionType.PERSONA_SECTION_REFERENCE,
        "closing_template_repeated",
    ),
    ValidatorRule(
        "response_similarity",
        "style",
        ValidatorAuthorityOwner.PERSONALITY_MODE,
        "LOW",
        RetryInstructionType.PERSONA_SECTION_REFERENCE,
        "response_too_similar",
    ),
    ValidatorRule(
        "insufficient_concrete_detail",
        "continuity",
        ValidatorAuthorityOwner.FLOW,
        "MEDIUM",
        RetryInstructionType.PERSONA_SECTION_REFERENCE,
        "required_detail_missing",
    ),
    ValidatorRule(
        "missing_latest_intent",
        "continuity",
        ValidatorAuthorityOwner.RUNTIME_CONTEXT,
        "HIGH",
        RetryInstructionType.TECHNICAL_CORRECTION,
        "latest_intent_not_answered",
    ),
    ValidatorRule(
        "generic_opening",
        "style",
        ValidatorAuthorityOwner.PERSONALITY_MODE,
        "LOW",
        RetryInstructionType.PERSONA_SECTION_REFERENCE,
        "opening_not_topic_specific",
    ),
    ValidatorRule(
        "unnecessary_question",
        "style",
        ValidatorAuthorityOwner.AUTO_ADAPT,
        "LOW",
        RetryInstructionType.PERSONA_SECTION_REFERENCE,
        "answer_deferred_by_question",
    ),
    ValidatorRule(
        "source_dump_opening",
        "style",
        ValidatorAuthorityOwner.PERSONALITY_MODE,
        "LOW",
        RetryInstructionType.PERSONA_SECTION_REFERENCE,
        "source_link_opening",
    ),
)
VALIDATOR_RULES_BY_ID = {rule.validator_id: rule for rule in VALIDATOR_RULES}


@dataclass(frozen=True)
class LegacyRetryFragment:
    name: str
    canonical_section: str
    validator_ids: frozenset[str]
    content: str


LEGACY_RETRY_FRAGMENTS = (
    LegacyRetryFragment(
        "legacy_retry_style",
        "PERSONALITY_MODE",
        frozenset(
            {
                "mixed_register",
                "repetitive_closing",
                "response_similarity",
                "generic_opening",
                "unnecessary_question",
                "source_dump_opening",
            }
        ),
        (
            "Jaga register konsisten, jangan menyalin balasan sebelumnya, jawab topik "
            "utama sejak kalimat pertama, dan hindari pertanyaan atau closing berulang "
            "yang tidak membantu."
        ),
    ),
    LegacyRetryFragment(
        "legacy_retry_product_selection",
        "FLOW",
        frozenset(
            {
                "missing_product_options",
                "unsupported_variant",
                "unnecessary_variant",
                "repeated_product_selection",
            }
        ),
        (
            "Gunakan hanya varian yang tersedia di grounding. Jika customer meminta "
            "perbandingan, bedakan opsi yang tersedia; jika pilihan sudah jelas, jangan "
            "meminta customer memilih ulang."
        ),
    ),
    LegacyRetryFragment(
        "legacy_retry_process_continuity",
        "FLOW",
        frozenset(
            {
                "post_signup_regression",
                "repeated_identity_request",
                "vague_process_direction",
                "repeated_onboarding",
                "followup_topic_break",
                "subject_focus_break",
                "missing_latest_intent",
            }
        ),
        (
            "Jawab intent terakhir dan pertahankan topik aktif. Jangan mengulang data, "
            "verifikasi, pemilihan produk, atau onboarding yang sudah selesai; berikan "
            "arah operasional yang relevan dengan milestone terbaru."
        ),
    ),
    LegacyRetryFragment(
        "legacy_retry_concrete_detail",
        "FLOW",
        frozenset({"abstract_data_requirement", "insufficient_concrete_detail"}),
        (
            "Jika customer meminta detail atau langkah, berikan isi konkret dan hindari "
            "template umum atau filler."
        ),
    ),
    LegacyRetryFragment(
        "legacy_retry_legality_grounding",
        "GUARDRAIL",
        frozenset(
            {
                "missing_legality_authority",
                "vague_legality_deflection",
                "unsupported_fixed_sensitive_number",
            }
        ),
        (
            "Untuk legalitas dan angka sensitif, gunakan hanya fakta yang tersedia di "
            "grounding; jangan mengarang detail atau mengganti jawaban dengan defleksi "
            "kabur."
        ),
    ),
)
HYBRID_APPROVED_RETRY_FRAGMENTS = frozenset(
    {"legacy_retry_legality_grounding"}
)


@dataclass(frozen=True)
class RetryCompositionResult:
    content: str
    authority_mode: PersonaAuthorityMode
    validator_ids: tuple[str, ...]
    technical_instruction_ids: tuple[str, ...]
    behavioral_fragment_names: tuple[str, ...]
    legacy_behavior_present: bool
    content_hash: str
    retry_contract_version: str = CLARA_RETRY_CONTRACT_VERSION

    def debug_metadata(self) -> dict:
        return {
            "authority_mode": self.authority_mode.value,
            "validator_ids": list(self.validator_ids),
            "technical_instruction_ids": list(self.technical_instruction_ids),
            "behavioral_fragment_names": list(self.behavioral_fragment_names),
            "legacy_behavior_present": self.legacy_behavior_present,
            "content_hash": self.content_hash,
            "retry_contract_version": self.retry_contract_version,
        }


def compose_retry_prompt(
    *,
    authority_mode: PersonaAuthorityMode,
    validator_ids: tuple[str, ...],
    desired_count: int,
    available_system_sections: frozenset[str],
) -> RetryCompositionResult:
    unknown_ids = set(validator_ids) - VALIDATOR_RULES_BY_ID.keys()
    if unknown_ids:
        raise ValueError(f"Unknown retry validator IDs: {sorted(unknown_ids)}")

    ordered_ids = tuple(dict.fromkeys(validator_ids))
    rules = tuple(VALIDATOR_RULES_BY_ID[validator_id] for validator_id in ordered_ids)
    technical_ids = (
        "valid_json_only",
        "schema_clara_reply_suggestion",
        f"reply_count_{desired_count}",
        "no_markdown",
        "validator_correction_targets",
    )
    technical = (
        f"RETRY_TECHNICAL_CONTRACT v{CLARA_RETRY_CONTRACT_VERSION}\n"
        f"- validator_ids={','.join(ordered_ids)}\n"
        f"- correction_targets={','.join(rule.correction_target for rule in rules)}\n"
        f"- required_reply_count={desired_count}\n"
        "- Output valid JSON only, sesuai schema clara_reply_suggestion.\n"
        "- Jangan keluarkan Markdown atau teks di luar JSON."
    )

    if authority_mode == PersonaAuthorityMode.LEGACY:
        fragments = LEGACY_RETRY_FRAGMENTS
        appendix = "\n\n".join(
            f"### {fragment.name}\n{fragment.content}" for fragment in fragments
        )
        content = f"{technical}\n\nLEGACY_RETRY_COMPATIBILITY\n{appendix}"
    elif authority_mode == PersonaAuthorityMode.HYBRID:
        fragments = tuple(
            fragment
            for fragment in LEGACY_RETRY_FRAGMENTS
            if fragment.name in HYBRID_APPROVED_RETRY_FRAGMENTS
            and fragment.canonical_section.lower() not in available_system_sections
            and fragment.validator_ids.intersection(ordered_ids)
        )
        section_refs = sorted(
            {
                rule.canonical_authority_owner.value
                for rule in rules
                if rule.retry_instruction_type
                == RetryInstructionType.PERSONA_SECTION_REFERENCE
            }
        )
        appendix = (
            "\n\nAPPROVED_RETRY_COMPATIBILITY\n"
            + "\n\n".join(
                f"### {fragment.name}\n{fragment.content}" for fragment in fragments
            )
            if fragments
            else ""
        )
        content = (
            f"{technical}\n\nCANONICAL_PLAYBOOK_AUTHORITY="
            f"{','.join(section_refs) or 'NONE'}{appendix}"
        )
    else:
        fragments = ()
        section_refs = sorted(
            {
                rule.canonical_authority_owner.value
                for rule in rules
                if rule.retry_instruction_type
                == RetryInstructionType.PERSONA_SECTION_REFERENCE
            }
        )
        content = (
            f"{technical}\n\nCANONICAL_PLAYBOOK_AUTHORITY="
            f"{','.join(section_refs) or 'NONE'}"
        )

    return RetryCompositionResult(
        content=content,
        authority_mode=authority_mode,
        validator_ids=ordered_ids,
        technical_instruction_ids=technical_ids,
        behavioral_fragment_names=tuple(fragment.name for fragment in fragments),
        legacy_behavior_present=bool(fragments),
        content_hash=sha256(content.encode("utf-8")).hexdigest(),
    )


def compose_plain_json_repair_instructions(desired_count: int) -> str:
    return (
        "PLAIN_JSON_REPAIR v1.0\n"
        "- Output valid JSON only, tanpa Markdown atau kalimat pembuka.\n"
        "- Gunakan schema clara_reply_suggestion.\n"
        f"- suggested_replies harus berisi tepat {desired_count} item."
    )


@dataclass(frozen=True)
class SafetyCoverageEntry:
    behavior_id: str
    backend_validator_ids: tuple[str, ...]
    system_section: str
    legacy_fragment: str | None
    legacy_available: bool
    hybrid_available: bool
    persona_available: bool
    remaining_gap: str


SAFETY_COVERAGE_MATRIX = (
    SafetyCoverageEntry(
        "no_guaranteed_profit",
        (),
        "GUARDRAIL",
        "legacy_guardrail_safety",
        True,
        True,
        True,
        "Prompt-only; no universal backend claim validator.",
    ),
    SafetyCoverageEntry(
        "no_risk_free_claim",
        (),
        "GUARDRAIL",
        "legacy_guardrail_safety",
        True,
        True,
        True,
        "Prompt-only; no universal backend claim validator.",
    ),
    SafetyCoverageEntry(
        "no_invented_product_fact",
        ("unsupported_fixed_sensitive_number", "unsupported_variant"),
        "GUARDRAIL",
        "legacy_guardrail_safety",
        True,
        True,
        True,
        "Backend coverage is partial and limited to selected facts.",
    ),
    SafetyCoverageEntry(
        "no_specific_buy_sell_all_in_advice",
        (),
        "GUARDRAIL",
        "legacy_guardrail_safety",
        True,
        True,
        True,
        "Prompt-only; no universal buy/sell/all-in validator.",
    ),
    SafetyCoverageEntry(
        "no_process_regression",
        ("post_signup_regression", "vague_process_direction"),
        "FLOW",
        "legacy_flow_movement",
        True,
        True,
        True,
        "Retry detection is not a persisted process-state FSM.",
    ),
    SafetyCoverageEntry(
        "no_repeated_verification",
        ("vague_process_direction",),
        "FLOW",
        "legacy_flow_movement",
        True,
        True,
        True,
        "Heuristic text detection only.",
    ),
    SafetyCoverageEntry(
        "no_repeated_onboarding",
        ("repeated_onboarding",),
        "FLOW",
        "legacy_flow_movement",
        True,
        True,
        True,
        "Retry output is not semantically revalidated.",
    ),
    SafetyCoverageEntry(
        "no_unsupported_fixed_sensitive_number",
        ("unsupported_fixed_sensitive_number",),
        "GUARDRAIL",
        "legacy_retry_legality_grounding",
        True,
        True,
        True,
        "Validator covers configured numeric patterns, not every mutable fact.",
    ),
    SafetyCoverageEntry(
        "no_fake_access_to_verification_status",
        (),
        "GUARDRAIL",
        None,
        False,
        False,
        False,
        "No dedicated backend validator or guaranteed persona rule.",
    ),
    SafetyCoverageEntry(
        "no_unsupported_legal_detail",
        ("missing_legality_authority", "vague_legality_deflection"),
        "GUARDRAIL",
        "legacy_retry_legality_grounding",
        True,
        True,
        True,
        "Validators do not detect every invented legal detail.",
    ),
)

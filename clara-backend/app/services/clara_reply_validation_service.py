import re
from dataclasses import dataclass, field
from enum import StrEnum
from hashlib import sha256

from app.services.clara_reply_retry_service import (
    VALIDATOR_RULES,
    VALIDATOR_RULES_BY_ID,
    ValidatorAuthorityOwner,
)


CLARA_VALIDATION_CONTRACT_VERSION = "1.0"


class SemanticRevalidationMode(StrEnum):
    OFF = "OFF"
    OBSERVE = "OBSERVE"


def normalize_semantic_revalidation_mode(
    value: str | None,
) -> SemanticRevalidationMode:
    normalized = (value or "").strip().upper()
    return (
        SemanticRevalidationMode.OBSERVE
        if normalized == SemanticRevalidationMode.OBSERVE
        else SemanticRevalidationMode.OFF
    )


@dataclass(frozen=True)
class ReplyValidationCapabilities:
    can_access_verification_status: bool = False
    can_access_account_status: bool = False
    can_access_fund_status: bool = False
    can_authorize_refund: bool = False
    can_execute_transaction: bool = False
    customer_is_verified: bool = False
    account_is_active: bool = False
    account_is_funded: bool = False


@dataclass(frozen=True)
class ReplyValidationContext:
    latency_profile: str = "standard"
    preferred_reply_register: str = "neutral_polite"
    must_answer_with_product_options: bool = False
    product_option_summary: str = ""
    latest_customer_intent: str = "general"
    answer_commitment_level: str = "answer_then_optional_clarify"
    latest_customer_message: str = ""
    conversation_variant_focus: str | None = None
    customer_has_variant_commitment: bool = False
    known_identity_fields: dict[str, str] = field(default_factory=dict)
    customer_has_identity_submission: bool = False
    customer_has_verification_completion: bool = False
    latest_sales_message: str = ""
    previous_customer_message: str = ""
    should_avoid_repeating_sales_reply: bool = False
    must_give_concrete_steps: bool = False
    must_give_detailed_explanation: bool = False
    discusses_scalping_or_setup: bool = False
    capabilities: ReplyValidationCapabilities = field(
        default_factory=ReplyValidationCapabilities
    )


@dataclass(frozen=True)
class ValidatorResult:
    validator_id: str
    passed: bool
    severity: str
    authority_owner: ValidatorAuthorityOwner
    reason_code: str
    diagnostic_metadata: dict[str, bool | str | int]
    retry_eligible: bool
    critical: bool


@dataclass(frozen=True)
class ReplyValidationReport:
    evaluated_text: str
    validator_results: tuple[ValidatorResult, ...]
    failed_validator_ids: tuple[str, ...]
    passed_validator_ids: tuple[str, ...]
    critical_failure_ids: tuple[str, ...]
    warning_ids: tuple[str, ...]
    is_valid: bool
    content_hash: str
    validation_contract_version: str = CLARA_VALIDATION_CONTRACT_VERSION

    def debug_metadata(self) -> dict:
        return {
            "failed_validator_ids": list(self.failed_validator_ids),
            "passed_validator_ids": list(self.passed_validator_ids),
            "critical_failure_ids": list(self.critical_failure_ids),
            "warning_ids": list(self.warning_ids),
            "is_valid": self.is_valid,
            "content_hash": self.content_hash,
            "validation_contract_version": self.validation_contract_version,
            "validator_results": [
                {
                    "validator_id": result.validator_id,
                    "passed": result.passed,
                    "severity": result.severity,
                    "authority_owner": result.authority_owner.value,
                    "reason_code": result.reason_code,
                    "diagnostic_metadata": result.diagnostic_metadata,
                    "retry_eligible": result.retry_eligible,
                    "critical": result.critical,
                }
                for result in self.validator_results
            ],
        }


CRITICAL_SAFETY_VALIDATOR_IDS = frozenset(
    {
        "guaranteed_profit_claim",
        "risk_free_claim",
        "specific_buy_sell_instruction",
        "all_in_or_full_margin_instruction",
        "fake_verification_status_access",
        "fake_account_or_fund_status_access",
        "unsupported_refund_or_compensation_promise",
    }
)

GUARANTEED_PROFIT_PATTERN = re.compile(
    r"\b("
    r"dijamin(?:\s+\w+){0,2}\s+(?:profit|untung)|"
    r"(?:profit|untung|keuntungan)(?:\s+\w+){0,2}\s+"
    r"(?:pasti|terjamin|dijamin)|"
    r"pasti\s+(?:profit|untung)"
    r")\b",
    re.IGNORECASE,
)
GUARANTEED_PROFIT_DENIAL_PATTERN = re.compile(
    r"\b("
    r"tidak|bukan|nggak|gak|tak"
    r")(?:\s+\w+){0,4}\s+(?:jamin|dijamin|pasti|terjamin)\b|"
    r"\btidak\s+ada\s+jaminan\b",
    re.IGNORECASE,
)
RISK_FREE_PATTERN = re.compile(
    r"\b(tanpa\s+risiko|bebas\s+risiko|tidak\s+mungkin\s+rugi|"
    r"tidak\s+akan\s+rugi|pasti\s+aman)\b",
    re.IGNORECASE,
)
RISK_FREE_DENIAL_PATTERN = re.compile(
    r"\b(tidak|bukan|nggak|gak|tak)(?:\s+\w+){0,4}\s+"
    r"(?:tanpa\s+risiko|bebas\s+risiko|pasti\s+aman)|"
    r"\btidak\s+ada\s+(?:produk|transaksi|trading)\s+tanpa\s+risiko\b",
    re.IGNORECASE,
)
BUY_SELL_PATTERN = re.compile(
    r"\b(?:anda|kamu|kak|sebaiknya|harus|langsung|silakan|wajib)"
    r"(?:\s+\w+){0,5}\s+(?:buy|sell)\b|"
    r"\b(?:buy|sell)(?:\s+\w+){0,5}\s+(?:sekarang|di\s+harga|sebanyak)\b",
    re.IGNORECASE,
)
BUY_SELL_EDUCATION_PATTERN = re.compile(
    r"\b(contoh|edukasi|secara\s+umum|bukan\s+rekomendasi|"
    r"jangan|tidak\s+boleh|hindari)(?:\s+\w+){0,6}\s+(?:buy|sell)\b",
    re.IGNORECASE,
)
ALL_IN_PATTERN = re.compile(
    r"\b(all[\s-]?in|full\s+margin|gunakan\s+seluruh\s+dana|"
    r"pakai\s+semua\s+dana|masukkan\s+semua\s+modal)\b",
    re.IGNORECASE,
)
ALL_IN_DENIAL_PATTERN = re.compile(
    r"\b(jangan|hindari|tidak\s+boleh|bukan)(?:\s+\w+){0,5}\s+"
    r"(?:all[\s-]?in|full\s+margin|seluruh\s+dana|semua\s+dana)\b",
    re.IGNORECASE,
)
ACCESS_ASSERTION_PATTERN = re.compile(
    r"\b(sudah\s+saya\s+cek|saya\s+(?:sudah\s+)?(?:cek|lihat)"
    r"(?:\s+\w+){0,4}\s+di\s+sistem|sistem\s+kami\s+menunjukkan)\b",
    re.IGNORECASE,
)
VERIFICATION_STATUS_PATTERN = re.compile(r"\bverifikasi\b", re.IGNORECASE)
ACCOUNT_STATUS_PATTERN = re.compile(
    r"\b(akun|account)(?:\s+\w+){0,3}\s+(?:aktif|nonaktif|terblokir)\b",
    re.IGNORECASE,
)
FUND_STATUS_PATTERN = re.compile(
    r"\b(saldo|dana|deposit|transfer)(?:\s+\w+){0,3}\s+"
    r"(?:masuk|tercatat|tersedia|diterima)\b",
    re.IGNORECASE,
)
REFUND_PROMISE_PATTERN = re.compile(
    r"\b(kami|saya)(?:\s+\w+){0,4}\s+"
    r"(?:pastikan|jamin|menjamin|akan)(?:\s+\w+){0,4}\s+"
    r"(?:refund|kompensasi|pengembalian\s+dana)|"
    r"\b(?:refund|kompensasi|pengembalian\s+dana)"
    r"(?:\s+\w+){0,3}\s+(?:pasti|dijamin)\b",
    re.IGNORECASE,
)
REFUND_DENIAL_PATTERN = re.compile(
    r"\b(tidak|belum|bukan|nggak|gak)(?:\s+\w+){0,5}\s+"
    r"(?:menjanjikan|memastikan|menjamin|refund|kompensasi|pengembalian)\b",
    re.IGNORECASE,
)


def _has_non_denied_claim(
    text: str,
    claim_pattern: re.Pattern[str],
    denial_pattern: re.Pattern[str],
) -> bool:
    for sentence in re.split(r"(?<=[.!?])\s+|\n+", text):
        if claim_pattern.search(sentence) and not denial_pattern.search(sentence):
            return True
    return False


def _has_access_assertion(text: str, subject_pattern: re.Pattern[str]) -> bool:
    return any(
        ACCESS_ASSERTION_PATTERN.search(sentence)
        and subject_pattern.search(sentence)
        for sentence in re.split(r"(?<=[.!?])\s+|\n+", text)
    )


def evaluate_reply(
    text: str,
    context: ReplyValidationContext,
) -> ReplyValidationReport:
    from app.services import reply_suggestion_service as validators

    checks = {
        "mixed_register": (
            context.latency_profile not in {"ultra_fast", "fast"}
            and validators.response_mixes_register(
                text, context.preferred_reply_register
            )
        ),
        "missing_product_options": validators.response_fails_product_option_requirement(
            text,
            context.must_answer_with_product_options,
            context.product_option_summary,
        ),
        "unsupported_variant": validators.response_mentions_variant_not_in_grounding(
            text,
            context.product_option_summary,
            context.must_answer_with_product_options,
        ),
        "unnecessary_variant": (
            validators.response_unnecessarily_mentions_product_variants(
                text,
                context.latest_customer_intent,
                context.latest_customer_message,
                context.must_answer_with_product_options,
                context.conversation_variant_focus,
            )
        ),
        "missing_legality_authority": validators.response_lacks_legality_authority(
            text, context.latest_customer_intent
        ),
        "vague_legality_deflection": (
            validators.response_uses_vague_legality_deflection(
                text, context.latest_customer_intent
            )
        ),
        "unsupported_fixed_sensitive_number": (
            validators.response_states_fixed_sensitive_number(
                text, context.latest_customer_intent
            )
        ),
        "post_signup_regression": validators.response_ignores_post_signup_state(
            text, context.latest_customer_message
        ),
        "repeated_product_selection": validators.response_reopens_product_selection(
            text,
            customer_has_variant_commitment=(
                context.customer_has_variant_commitment
            ),
        ),
        "repeated_identity_request": validators.response_reasks_identity_data(
            text,
            latest_identity_fields=context.known_identity_fields,
        ),
        "abstract_data_requirement": validators.response_uses_abstract_data_requirement(
            text, context.latest_customer_message
        ),
        "vague_process_direction": (
            validators.response_is_vague_after_identity_submission(
                text,
                latest_customer_intent=context.latest_customer_intent,
                customer_has_variant_commitment=(
                    context.customer_has_variant_commitment
                ),
                customer_has_identity_submission=(
                    context.customer_has_identity_submission
                ),
                customer_has_verification_completion=(
                    context.customer_has_verification_completion
                ),
            )
        ),
        "repeated_onboarding": (
            validators.response_stays_stuck_in_onboarding_after_milestone(
                text, context.latest_customer_intent
            )
        ),
        "followup_topic_break": validators.response_breaks_followup_topic(
            text,
            context.latest_customer_message,
            context.latest_sales_message,
        ),
        "subject_focus_break": validators.response_breaks_subject_focus(
            text,
            context.latest_customer_message,
            context.previous_customer_message,
        ),
        "repetitive_closing": (
            context.latency_profile != "ultra_fast"
            and validators.response_uses_repetitive_closing_template(text)
        ),
        "response_similarity": (
            context.latency_profile != "ultra_fast"
            and validators.response_is_too_similar_to_latest_sales_message(
                text,
                context.latest_sales_message,
                context.should_avoid_repeating_sales_reply,
            )
        ),
        "insufficient_concrete_detail": (
            context.latency_profile not in {"ultra_fast", "fast"}
            and validators.response_lacks_concrete_detail(
                text,
                context.must_give_concrete_steps,
                context.must_give_detailed_explanation,
                context.discusses_scalping_or_setup,
            )
        ),
        "missing_latest_intent": validators.response_misses_latest_customer_intent(
            text, context.latest_customer_intent
        ),
        "generic_opening": (
            context.latency_profile not in {"ultra_fast", "fast"}
            and validators.response_starts_too_generic(
                text, context.latest_customer_intent
            )
        ),
        "unnecessary_question": validators.response_defers_answer_with_question(
            text, context.answer_commitment_level
        ),
        "source_dump_opening": validators.response_opens_with_source_dump(
            text, context.latest_customer_intent
        ),
        "guaranteed_profit_claim": _has_non_denied_claim(
            text, GUARANTEED_PROFIT_PATTERN, GUARANTEED_PROFIT_DENIAL_PATTERN
        ),
        "risk_free_claim": _has_non_denied_claim(
            text, RISK_FREE_PATTERN, RISK_FREE_DENIAL_PATTERN
        ),
        "specific_buy_sell_instruction": bool(
            BUY_SELL_PATTERN.search(text)
            and not BUY_SELL_EDUCATION_PATTERN.search(text)
        ),
        "all_in_or_full_margin_instruction": bool(
            ALL_IN_PATTERN.search(text) and not ALL_IN_DENIAL_PATTERN.search(text)
        ),
        "fake_verification_status_access": bool(
            not context.capabilities.can_access_verification_status
            and _has_access_assertion(text, VERIFICATION_STATUS_PATTERN)
        ),
        "fake_account_or_fund_status_access": bool(
            (
                not context.capabilities.can_access_account_status
                and _has_access_assertion(text, ACCOUNT_STATUS_PATTERN)
            )
            or (
                not context.capabilities.can_access_fund_status
                and _has_access_assertion(text, FUND_STATUS_PATTERN)
            )
        ),
        "unsupported_refund_or_compensation_promise": bool(
            not context.capabilities.can_authorize_refund
            and REFUND_PROMISE_PATTERN.search(text)
            and not REFUND_DENIAL_PATTERN.search(text)
        ),
    }

    results = tuple(
        _build_validator_result(rule.validator_id, checks[rule.validator_id])
        for rule in VALIDATOR_RULES
    )
    failed_ids = tuple(
        result.validator_id for result in results if not result.passed
    )
    passed_ids = tuple(result.validator_id for result in results if result.passed)
    critical_ids = tuple(
        result.validator_id
        for result in results
        if not result.passed and result.critical
    )
    warning_ids = tuple(
        result.validator_id
        for result in results
        if not result.passed and result.severity in {"LOW", "MEDIUM"}
    )
    return ReplyValidationReport(
        evaluated_text=text,
        validator_results=results,
        failed_validator_ids=failed_ids,
        passed_validator_ids=passed_ids,
        critical_failure_ids=critical_ids,
        warning_ids=warning_ids,
        is_valid=not failed_ids,
        content_hash=sha256(text.encode("utf-8")).hexdigest(),
    )


def _build_validator_result(
    validator_id: str,
    failed: bool,
) -> ValidatorResult:
    rule = VALIDATOR_RULES_BY_ID[validator_id]
    return ValidatorResult(
        validator_id=validator_id,
        passed=not failed,
        severity=rule.severity,
        authority_owner=rule.canonical_authority_owner,
        reason_code=(
            "validation_passed" if not failed else rule.correction_target
        ),
        diagnostic_metadata={
            "detected": failed,
            "category": rule.category,
        },
        retry_eligible=validator_id not in CRITICAL_SAFETY_VALIDATOR_IDS,
        critical=rule.severity == "CRITICAL",
    )


def build_validation_log_metadata(
    *,
    mode: SemanticRevalidationMode,
    primary_report: ReplyValidationReport,
    final_text: str,
    retry_performed: bool,
    retry_report: ReplyValidationReport | None = None,
    json_repair_performed: bool = False,
    repair_report: ReplyValidationReport | None = None,
    final_report: ReplyValidationReport | None = None,
) -> dict:
    return {
        "validation_contract_version": CLARA_VALIDATION_CONTRACT_VERSION,
        "semantic_revalidation_mode": mode.value,
        "primary_failed_validator_ids": list(
            primary_report.failed_validator_ids
        ),
        "primary_critical_failure_ids": list(
            primary_report.critical_failure_ids
        ),
        "retry_performed": retry_performed,
        "retry_failed_validator_ids": (
            list(retry_report.failed_validator_ids) if retry_report else []
        ),
        "retry_critical_failure_ids": (
            list(retry_report.critical_failure_ids) if retry_report else []
        ),
        "json_repair_performed": json_repair_performed,
        "repair_failed_validator_ids": (
            list(repair_report.failed_validator_ids) if repair_report else []
        ),
        "unresolved_final_validator_ids": (
            list(final_report.failed_validator_ids) if final_report else []
        ),
        "primary_reply_hash": primary_report.content_hash,
        "retry_reply_hash": retry_report.content_hash if retry_report else None,
        "final_reply_hash": sha256(final_text.encode("utf-8")).hexdigest(),
        "final_validation_observed": final_report is not None,
    }

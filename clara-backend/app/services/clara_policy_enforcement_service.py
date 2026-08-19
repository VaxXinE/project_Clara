import json
import re
from dataclasses import dataclass
from enum import StrEnum
from hashlib import sha256

from app.core.clara_runtime_contract import ActionMode, normalize_action_mode
from app.core.config import settings
from app.services.clara_reply_validation_service import (
    ReplyValidationContext,
    evaluate_reply,
)
from app.services.clara_safe_handoff_service import SafeHandoffCategory
from app.services.role_service import normalize_role


CLARA_ENFORCEMENT_CONTRACT_VERSION = "1.0"


class PolicyEnforcementMode(StrEnum):
    OFF = "OFF"
    OBSERVE = "OBSERVE"
    ENFORCE = "ENFORCE"


class GenerationStrategy(StrEnum):
    NORMAL_GENERATION = "NORMAL_GENERATION"
    SAFE_HANDOFF_TEMPLATE = "SAFE_HANDOFF_TEMPLATE"
    NO_CUSTOMER_DRAFT = "NO_CUSTOMER_DRAFT"


class SendPermission(StrEnum):
    PENDING_REVIEW = "PENDING_REVIEW"
    AUTHORIZED_REVIEW_REQUIRED = "AUTHORIZED_REVIEW_REQUIRED"
    BLOCKED = "BLOCKED"


class ReviewerRequirement(StrEnum):
    SALES_REVIEW = "SALES_REVIEW"
    MANAGER_REVIEW = "MANAGER_REVIEW"
    COMPLIANCE_REVIEW = "COMPLIANCE_REVIEW"
    SUPERVISOR_OR_COMPLIANCE_REVIEW = "SUPERVISOR_OR_COMPLIANCE_REVIEW"
    NO_REVIEW_ALLOWED = "NO_REVIEW_ALLOWED"


@dataclass(frozen=True)
class EnforcementModeResolution:
    mode: PolicyEnforcementMode
    original_value: str | None
    was_normalized: bool

    def debug_metadata(self) -> dict:
        return {
            "enforcement_mode": self.mode.value,
            "enforcement_mode_original": self.original_value,
            "enforcement_mode_was_normalized": self.was_normalized,
        }


@dataclass(frozen=True)
class ClaraEnforcementDecision:
    action_mode: ActionMode
    reason_codes: tuple[str, ...]
    policy_risk_level: str
    critical_validator_ids: tuple[str, ...]
    reviewer_requirement: ReviewerRequirement
    generation_strategy: GenerationStrategy
    send_permission: SendPermission
    safe_handoff_category: SafeHandoffCategory | None
    decision_hash: str
    enforcement_contract_version: str = CLARA_ENFORCEMENT_CONTRACT_VERSION

    def debug_metadata(self) -> dict:
        return {
            "enforcement_contract_version": self.enforcement_contract_version,
            "calculated_action_mode": self.action_mode.value,
            "reason_codes": list(self.reason_codes),
            "policy_risk_level": self.policy_risk_level,
            "unresolved_critical_validator_ids": list(
                self.critical_validator_ids
            ),
            "reviewer_requirement": self.reviewer_requirement.value,
            "generation_strategy": self.generation_strategy.value,
            "send_permission": self.send_permission.value,
            "safe_handoff_category": (
                self.safe_handoff_category.value
                if self.safe_handoff_category
                else None
            ),
            "would_block": self.action_mode == ActionMode.BLOCK,
            "would_safe_handoff": (
                self.action_mode == ActionMode.SAFE_HANDOFF
            ),
            "decision_hash": self.decision_hash,
        }


class ClaraEnforcementError(RuntimeError):
    pass


PERSONAL_PATTERN = re.compile(
    r"\b(saya|aku|kami|milik\s+saya|akun\s+saya|dana\s+saya)\b",
    re.IGNORECASE,
)
CONCRETE_PROBLEM_PATTERN = re.compile(
    r"\b(rugi|hilang|tidak\s+masuk|belum\s+masuk|terpotong|dibekukan|"
    r"tidak\s+bisa|bermasalah)\b|"
    r"\b(?:masalah|kendala|gagal)\b.{0,20}\b"
    r"(?:transaksi|deposit|penarikan|withdraw)\b|"
    r"\b(?:transaksi|deposit|penarikan|withdraw)\b.{0,20}\b"
    r"(?:masalah|kendala|gagal)\b",
    re.IGNORECASE,
)
FINANCIAL_LOSS_PATTERN = re.compile(
    r"\b(rugi|kehilangan|dana\s+hilang|saldo\s+berkurang|uang\s+hilang)\b",
    re.IGNORECASE,
)
RISK_FREE_EDUCATION_PATTERN = re.compile(
    r"\b(?:pasti\s+aman|"
    r"pasti\s+(?:tidak|tak|nggak|gak|ngga|ga)\s+rugi|"
    r"(?:tidak|tak|nggak|gak|ngga|ga)\s+(?:mungkin|akan)\s+"
    r"(?:rugi|hilang|berkurang))\b",
    re.IGNORECASE,
)
REFUND_PATTERN = re.compile(
    r"\b(refund|kompensasi|ganti\s+rugi|pengembalian\s+dana)\b",
    re.IGNORECASE,
)
REFUND_REQUEST_PATTERN = re.compile(
    r"\b(minta|mohon|tolong|ajukan|meminta)\b(?:\s+\w+){0,4}\s+"
    r"\b(refund|kompensasi|ganti\s+rugi|pengembalian\s+dana)\b",
    re.IGNORECASE,
)
LEGAL_THREAT_PATTERN = re.compile(
    r"\b(lapor(?:kan)?\s+ke|akan\s+lapor|pengacara|somasi|gugat|"
    r"bappebti|polisi|regulator)\b",
    re.IGNORECASE,
)
FRAUD_PATTERN = re.compile(
    r"\b(ditipu|penipuan|fraud|scam|dicurangi)\b",
    re.IGNORECASE,
)
PERSONAL_FRAUD_INCIDENT_PATTERN = re.compile(
    r"\b(saya|aku|kami)\b(?:\s+\w+){0,4}\s+\b(ditipu|dicurangi)\b|"
    r"\b(ditipu|dicurangi)\b(?:\s+\w+){0,4}\s+\b(saya|aku|kami)\b",
    re.IGNORECASE,
)
PERSONAL_LEGAL_THREAT_PATTERN = re.compile(
    r"\b(saya|aku|kami)\b(?:\s+\w+){0,5}\s+"
    r"\b(akan\s+lapor|laporkan\s+ke|somasi|gugat|pengacara|lapor\s+polisi)\b",
    re.IGNORECASE,
)
HUMAN_REQUEST_PATTERN = re.compile(
    r"\b(bicara|hubungkan|sambungkan|ditangani)\b(?:\s+\w+){0,4}\s+"
    r"\b(manusia|petugas|supervisor|manager|atasan)\b|"
    r"\bminta\s+(?:petugas|supervisor|manager|atasan)\b",
    re.IGNORECASE,
)
HIGH_EMOTION_PATTERN = re.compile(
    r"\b(marah|kecewa\s+sekali|sangat\s+kecewa|keterlaluan|"
    r"tidak\s+terima|parah\s+banget)\b",
    re.IGNORECASE,
)
GOVERNANCE_BYPASS_PATTERN = re.compile(
    r"\b(abaikan|lewati|bypass|matikan)\b(?:\s+\w+){0,5}\s+"
    r"\b(instruksi|aturan|guardrail|validasi|approval|persetujuan)\b|"
    r"\b(system\s+prompt|developer\s+message)\b",
    re.IGNORECASE,
)


def normalize_policy_enforcement_mode(
    value: str | None,
) -> EnforcementModeResolution:
    original = value
    normalized = (value or "").strip().upper()
    if normalized in {mode.value for mode in PolicyEnforcementMode}:
        mode = PolicyEnforcementMode(normalized)
        was_normalized = normalized != (value or "")
    else:
        mode = PolicyEnforcementMode.OBSERVE
        was_normalized = True
    return EnforcementModeResolution(mode, original, was_normalized)


def classify_safe_handoff_category(
    message: str,
) -> SafeHandoffCategory | None:
    if HUMAN_REQUEST_PATTERN.search(message):
        return SafeHandoffCategory.HUMAN_REQUEST

    incident_text = RISK_FREE_EDUCATION_PATTERN.sub("", message)
    personal = bool(PERSONAL_PATTERN.search(message))
    concrete = bool(CONCRETE_PROBLEM_PATTERN.search(incident_text))
    if not personal:
        return None
    if REFUND_REQUEST_PATTERN.search(message):
        return SafeHandoffCategory.REFUND_OR_COMPENSATION
    if PERSONAL_FRAUD_INCIDENT_PATTERN.search(message):
        return SafeHandoffCategory.FRAUD_ALLEGATION
    if PERSONAL_LEGAL_THREAT_PATTERN.search(message):
        return SafeHandoffCategory.LEGAL_OR_REGULATOR_THREAT
    if REFUND_PATTERN.search(message) and concrete:
        return SafeHandoffCategory.REFUND_OR_COMPENSATION
    if FRAUD_PATTERN.search(message) and concrete:
        return SafeHandoffCategory.FRAUD_ALLEGATION
    if LEGAL_THREAT_PATTERN.search(message) and concrete:
        return SafeHandoffCategory.LEGAL_OR_REGULATOR_THREAT
    if FINANCIAL_LOSS_PATTERN.search(incident_text):
        return SafeHandoffCategory.FINANCIAL_LOSS_CLAIM
    if HIGH_EMOTION_PATTERN.search(message) and concrete:
        return SafeHandoffCategory.HIGH_EMOTION
    if concrete:
        return SafeHandoffCategory.PERSONAL_COMPLAINT
    return None


def decide_enforcement(
    *,
    legacy_policy_action: str,
    policy_risk_level: str,
    latest_customer_message: str = "",
    critical_validator_ids: tuple[str, ...] = (),
    warning_validator_ids: tuple[str, ...] = (),
    backend_security_denied: bool = False,
    validation_unavailable: bool = False,
) -> ClaraEnforcementDecision:
    critical_ids = tuple(sorted(set(critical_validator_ids)))
    category = classify_safe_handoff_category(latest_customer_message)

    if backend_security_denied:
        return _decision(
            action=ActionMode.BLOCK,
            reasons=("backend_security_denied",),
            risk=policy_risk_level,
            critical_ids=critical_ids,
            reviewer=ReviewerRequirement.NO_REVIEW_ALLOWED,
            strategy=GenerationStrategy.NO_CUSTOMER_DRAFT,
            permission=SendPermission.BLOCKED,
        )

    if GOVERNANCE_BYPASS_PATTERN.search(latest_customer_message):
        return _decision(
            action=ActionMode.BLOCK,
            reasons=("governance_bypass_attempt",),
            risk=policy_risk_level,
            critical_ids=critical_ids,
            reviewer=ReviewerRequirement.NO_REVIEW_ALLOWED,
            strategy=GenerationStrategy.NO_CUSTOMER_DRAFT,
            permission=SendPermission.BLOCKED,
        )

    if validation_unavailable:
        return _decision(
            action=ActionMode.BLOCK,
            reasons=("semantic_validation_unavailable",),
            risk=policy_risk_level,
            critical_ids=critical_ids,
            reviewer=ReviewerRequirement.NO_REVIEW_ALLOWED,
            strategy=GenerationStrategy.NO_CUSTOMER_DRAFT,
            permission=SendPermission.BLOCKED,
        )

    if critical_ids:
        refund_only = set(critical_ids) == {
            "unsupported_refund_or_compensation_promise"
        }
        if refund_only and category:
            return _decision(
                action=ActionMode.SAFE_HANDOFF,
                reasons=("critical_refund_claim_requires_handoff",),
                risk=policy_risk_level,
                critical_ids=critical_ids,
                reviewer=ReviewerRequirement.SUPERVISOR_OR_COMPLIANCE_REVIEW,
                strategy=GenerationStrategy.SAFE_HANDOFF_TEMPLATE,
                permission=SendPermission.AUTHORIZED_REVIEW_REQUIRED,
                category=category,
            )
        return _decision(
            action=ActionMode.BLOCK,
            reasons=("unresolved_critical_semantic_failure",),
            risk=policy_risk_level,
            critical_ids=critical_ids,
            reviewer=ReviewerRequirement.NO_REVIEW_ALLOWED,
            strategy=GenerationStrategy.NO_CUSTOMER_DRAFT,
            permission=SendPermission.BLOCKED,
        )

    if category:
        return _decision(
            action=ActionMode.SAFE_HANDOFF,
            reasons=("personal_complaint_requires_handoff",),
            risk=policy_risk_level,
            critical_ids=critical_ids,
            reviewer=ReviewerRequirement.SUPERVISOR_OR_COMPLIANCE_REVIEW,
            strategy=GenerationStrategy.SAFE_HANDOFF_TEMPLATE,
            permission=SendPermission.AUTHORIZED_REVIEW_REQUIRED,
            category=category,
        )

    legal_sensitive = bool(
        re.search(r"\b(legal|regulator|bappebti|hukum|izin)\b", latest_customer_message, re.I)
    )
    if policy_risk_level == "high":
        return _decision(
            action=ActionMode.HUMAN_REVIEW,
            reasons=("high_policy_risk",),
            risk=policy_risk_level,
            critical_ids=critical_ids,
            reviewer=ReviewerRequirement.COMPLIANCE_REVIEW,
            strategy=GenerationStrategy.NORMAL_GENERATION,
            permission=SendPermission.AUTHORIZED_REVIEW_REQUIRED,
        )
    if legal_sensitive:
        return _decision(
            action=ActionMode.HUMAN_REVIEW,
            reasons=("legal_or_regulatory_sensitivity",),
            risk=policy_risk_level,
            critical_ids=critical_ids,
            reviewer=ReviewerRequirement.COMPLIANCE_REVIEW,
            strategy=GenerationStrategy.NORMAL_GENERATION,
            permission=SendPermission.AUTHORIZED_REVIEW_REQUIRED,
        )
    if (
        policy_risk_level == "medium"
        or legacy_policy_action
        in {"human_approval_required", "escalate_to_human"}
        or warning_validator_ids
    ):
        return _decision(
            action=ActionMode.HUMAN_REVIEW,
            reasons=("elevated_review_required",),
            risk=policy_risk_level,
            critical_ids=critical_ids,
            reviewer=ReviewerRequirement.MANAGER_REVIEW,
            strategy=GenerationStrategy.NORMAL_GENERATION,
            permission=SendPermission.AUTHORIZED_REVIEW_REQUIRED,
        )
    return _decision(
        action=ActionMode.NORMAL,
        reasons=("normal_pending_review",),
        risk=policy_risk_level,
        critical_ids=critical_ids,
        reviewer=ReviewerRequirement.SALES_REVIEW,
        strategy=GenerationStrategy.NORMAL_GENERATION,
        permission=SendPermission.PENDING_REVIEW,
    )


def _decision(
    *,
    action: ActionMode,
    reasons: tuple[str, ...],
    risk: str,
    critical_ids: tuple[str, ...],
    reviewer: ReviewerRequirement,
    strategy: GenerationStrategy,
    permission: SendPermission,
    category: SafeHandoffCategory | None = None,
) -> ClaraEnforcementDecision:
    payload = {
        "action_mode": action.value,
        "reason_codes": list(reasons),
        "policy_risk_level": risk,
        "critical_validator_ids": list(critical_ids),
        "reviewer_requirement": reviewer.value,
        "generation_strategy": strategy.value,
        "send_permission": permission.value,
        "safe_handoff_category": category.value if category else None,
        "enforcement_contract_version": CLARA_ENFORCEMENT_CONTRACT_VERSION,
    }
    return ClaraEnforcementDecision(
        action_mode=action,
        reason_codes=reasons,
        policy_risk_level=risk,
        critical_validator_ids=critical_ids,
        reviewer_requirement=reviewer,
        generation_strategy=strategy,
        send_permission=permission,
        safe_handoff_category=category,
        decision_hash=sha256(
            json.dumps(payload, sort_keys=True, separators=(",", ":")).encode()
        ).hexdigest(),
    )


def critical_validator_ids_for_text(text: str) -> tuple[str, ...]:
    return evaluate_reply(
        text,
        ReplyValidationContext(),
    ).critical_failure_ids


def assert_no_critical_safety_violation(text: str) -> None:
    try:
        critical_ids = critical_validator_ids_for_text(text)
    except Exception as exc:
        raise ClaraEnforcementError(
            "Semantic validation is unavailable; action denied."
        ) from exc
    if critical_ids:
        raise ClaraEnforcementError(
            "Suggestion contains unresolved critical safety violations."
        )


def reviewer_requirement_for_suggestion(
    *,
    action_mode: str,
    risk_level: str,
    policy_reasons: tuple[str, ...] = (),
) -> ReviewerRequirement:
    marker = "enforcement:reviewer_requirement="
    for reason in policy_reasons:
        if reason.startswith(marker):
            value = reason.removeprefix(marker)
            if value in {item.value for item in ReviewerRequirement}:
                return ReviewerRequirement(value)
    normalized_action = ActionMode(
        normalize_action_mode(action_mode).canonical_value
    )
    if normalized_action == ActionMode.BLOCK:
        return ReviewerRequirement.NO_REVIEW_ALLOWED
    if normalized_action == ActionMode.SAFE_HANDOFF:
        return ReviewerRequirement.SUPERVISOR_OR_COMPLIANCE_REVIEW
    if normalized_action == ActionMode.HUMAN_REVIEW:
        return (
            ReviewerRequirement.COMPLIANCE_REVIEW
            if risk_level == "high"
            else ReviewerRequirement.MANAGER_REVIEW
        )
    return ReviewerRequirement.SALES_REVIEW


def assert_user_can_review_requirement(
    actor_role: str | None,
    requirement: ReviewerRequirement,
) -> None:
    role = normalize_role(actor_role)
    compliance_roles = {
        normalize_role(item)
        for item in settings.clara_compliance_reviewer_roles.split(",")
        if item.strip()
    }
    allowed = {
        ReviewerRequirement.SALES_REVIEW: {"sales", "manager", "head", "superadmin"},
        ReviewerRequirement.MANAGER_REVIEW: {"manager", "head", "superadmin"},
        ReviewerRequirement.COMPLIANCE_REVIEW: compliance_roles,
        ReviewerRequirement.SUPERVISOR_OR_COMPLIANCE_REVIEW: (
            {"manager", "head", "superadmin"} | compliance_roles
        ),
        ReviewerRequirement.NO_REVIEW_ALLOWED: set(),
    }[requirement]
    if role not in allowed:
        raise ClaraEnforcementError(
            f"Reviewer role is not authorized for {requirement.value}."
        )


def assert_suggestion_can_be_approved(
    *,
    action_mode: str,
    risk_level: str,
    approval_status: str,
    actor_role: str | None,
    candidate_text: str,
    policy_reasons: tuple[str, ...] = (),
) -> ReviewerRequirement:
    mode = normalize_policy_enforcement_mode(
        settings.clara_policy_enforcement_mode
    ).mode
    requirement = reviewer_requirement_for_suggestion(
        action_mode=action_mode,
        risk_level=risk_level,
        policy_reasons=policy_reasons,
    )
    if mode != PolicyEnforcementMode.ENFORCE:
        return requirement
    if approval_status == "blocked" or action_mode.upper() == "BLOCK":
        raise ClaraEnforcementError("Blocked suggestion cannot be approved.")
    assert_no_critical_safety_violation(candidate_text)
    assert_user_can_review_requirement(actor_role, requirement)
    return requirement


def assert_suggestion_can_be_sent(
    *,
    action_mode: str,
    risk_level: str,
    approval_status: str,
    actor_role: str | None,
    final_text: str,
    policy_reasons: tuple[str, ...] = (),
) -> ReviewerRequirement:
    mode = normalize_policy_enforcement_mode(
        settings.clara_policy_enforcement_mode
    ).mode
    requirement = reviewer_requirement_for_suggestion(
        action_mode=action_mode,
        risk_level=risk_level,
        policy_reasons=policy_reasons,
    )
    if mode != PolicyEnforcementMode.ENFORCE:
        return requirement
    if approval_status != "approved":
        raise ClaraEnforcementError(
            "Suggestion must be explicitly approved before send."
        )
    if action_mode.upper() == "BLOCK":
        raise ClaraEnforcementError("Blocked suggestion cannot be sent.")
    assert_no_critical_safety_violation(final_text)
    return requirement

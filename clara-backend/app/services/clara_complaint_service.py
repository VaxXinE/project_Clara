import json
import re
from dataclasses import dataclass, replace
from datetime import datetime, timedelta, timezone
from hashlib import sha256
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.complaint_case import ComplaintCase, ComplaintCaseEvent
from app.models.conversation import Conversation
from app.services.clara_policy_enforcement_service import ReviewerRequirement
from app.services.clara_safe_handoff_service import (
    SafeHandoffCategory,
    SafeHandoffResult,
)
from app.services.clara_service_routing_service import ComplaintSeverity


@dataclass(frozen=True)
class ComplaintIntakeResult:
    category: SafeHandoffCategory
    severity: ComplaintSeverity
    safe_summary: str
    requested_outcome: str | None
    required_information: tuple[str, ...]
    missing_information: tuple[str, ...]
    sensitive_information_detected: bool
    sensitive_information_types: tuple[str, ...]
    create_or_update_action: str
    case_id: UUID | None
    case_fingerprint: str
    handoff_category: SafeHandoffCategory
    reviewer_requirement: ReviewerRequirement
    reason_codes: tuple[str, ...]
    intake_hash: str

    def debug_metadata(self) -> dict:
        return {
            "category": self.category.value,
            "severity": self.severity.value,
            "requested_outcome": self.requested_outcome,
            "required_information": list(self.required_information),
            "missing_information": list(self.missing_information),
            "sensitive_information_detected": self.sensitive_information_detected,
            "sensitive_information_types": list(self.sensitive_information_types),
            "create_or_update_action": self.create_or_update_action,
            "case_id": str(self.case_id) if self.case_id else None,
            "case_fingerprint": self.case_fingerprint,
            "handoff_category": self.handoff_category.value,
            "reviewer_requirement": self.reviewer_requirement.value,
            "reason_codes": list(self.reason_codes),
            "intake_hash": self.intake_hash,
        }


_SENSITIVE_PATTERNS = {
    "PASSWORD": re.compile(r"\b(?:password|kata\s+sandi)\s*[:=]\s*\S+", re.I),
    "OTP": re.compile(r"\b(?:otp|kode\s+verifikasi)\s*[:=]?\s*\d{4,8}\b", re.I),
    "PIN": re.compile(r"\bpin\s*[:=]?\s*\d{4,8}\b", re.I),
    "ACCESS_TOKEN": re.compile(
        r"\b(?:access[_ -]?token|bearer)\s*[:=]?\s*[A-Za-z0-9._-]{12,}", re.I
    ),
    "API_KEY": re.compile(r"\b(?:api[_ -]?key|sk-)\s*[:=]?\s*[A-Za-z0-9_-]{12,}", re.I),
    "CARD_OR_BANK_CREDENTIAL": re.compile(
        r"\b(?:cvv|cvc)\s*[:=]?\s*\d{3,4}\b|\b\d{13,19}\b", re.I
    ),
    "IDENTITY_DOCUMENT_NUMBER": re.compile(
        r"\b(?:nik|nomor\s+ktp)\s*[:=]?\s*\d{16}\b", re.I
    ),
    "REMOTE_ACCESS_CREDENTIAL": re.compile(
        r"\b(?:anydesk|teamviewer)\s*(?:id|kode|password)?\s*[:=]?\s*[A-Za-z0-9-]{6,}",
        re.I,
    ),
}
_TIME = re.compile(
    r"\b(?:hari ini|kemarin|tadi|tanggal|jam|pukul|minggu lalu|bulan lalu)\b", re.I
)
_MONEY = re.compile(r"\b(?:rp\s?[\d.]|uang|dana|saldo|rugi|refund|kompensasi)\b", re.I)
_ACCESS = re.compile(r"\b(?:login|akun|password|otp|pin|akses|dibajak)\b", re.I)
_HUMAN = re.compile(r"\b(?:petugas|manusia|manager|supervisor|atasan)\b", re.I)
_PROCESS = (
    ("WITHDRAWAL", re.compile(r"\b(?:withdraw|penarikan)\b", re.I)),
    ("FUNDING", re.compile(r"\b(?:deposit|pendanaan|top\s*up)\b", re.I)),
    ("LOGIN", re.compile(r"\b(?:login|masuk\s+akun)\b", re.I)),
    ("VERIFICATION", re.compile(r"\b(?:verifikasi|verified|kyc)\b", re.I)),
    ("ACTIVATION", re.compile(r"\baktivasi\b", re.I)),
    ("TRANSACTION", re.compile(r"\btransaksi\b", re.I)),
    ("PLATFORM", re.compile(r"\b(?:platform|aplikasi)\b", re.I)),
)


def build_complaint_intake(
    *,
    message: str,
    category: SafeHandoffCategory,
    channel: str | None,
    observed_at: datetime | None = None,
    organization_id: UUID | None = None,
    customer_profile_id: UUID | None = None,
    conversation_id: UUID | None = None,
) -> ComplaintIntakeResult:
    text = " ".join((message or "").split())[:8000]
    observed = observed_at or datetime.now(timezone.utc)
    sensitive_types = tuple(
        sorted(
            label
            for label, pattern in _SENSITIVE_PATTERNS.items()
            if pattern.search(text)
        )
    )
    process = next(
        (label for label, pattern in _PROCESS if pattern.search(text)), "UNSPECIFIED"
    )
    money = bool(_MONEY.search(text))
    access = bool(_ACCESS.search(text))
    human = bool(_HUMAN.search(text))
    requested_outcome = _requested_outcome(text, human)
    required = (
        "WHAT_HAPPENED",
        "APPROXIMATE_TIME",
        "CHANNEL",
        "AFFECTED_FEATURE_OR_PROCESS",
        "REQUESTED_OUTCOME",
    )
    present = {"WHAT_HAPPENED"}
    if _TIME.search(text):
        present.add("APPROXIMATE_TIME")
    if channel:
        present.add("CHANNEL")
    if process != "UNSPECIFIED":
        present.add("AFFECTED_FEATURE_OR_PROCESS")
    if requested_outcome:
        present.add("REQUESTED_OUTCOME")
    missing = tuple(item for item in required if item not in present)
    severity = _severity(category)
    reviewer = (
        ReviewerRequirement.COMPLIANCE_REVIEW
        if severity in {ComplaintSeverity.HIGH, ComplaintSeverity.CRITICAL}
        else ReviewerRequirement.MANAGER_REVIEW
    )
    issue_payload = {
        "category": category.value,
        "process": process,
        "money_involved": money,
        "account_access_concern": access,
        "requested_outcome": requested_outcome,
        "human_requested": human,
    }
    issue_signature = sha256(
        json.dumps(issue_payload, sort_keys=True).encode()
    ).hexdigest()
    window_days = max(1, settings.clara_complaint_incident_window_days)
    bucket = str(observed.date().toordinal() // window_days)
    identity = f"{organization_id}:{customer_profile_id}:{conversation_id}:{channel}:{category.value}:{issue_signature}:{bucket}"
    fingerprint = sha256(identity.encode()).hexdigest()
    summary = f"Kategori {category.value}; proses {process}; dana {'TERINDIKASI' if money else 'TIDAK_TERINDIKASI'}; akses akun {'TERINDIKASI' if access else 'TIDAK_TERINDIKASI'}; hasil diminta {requested_outcome or 'BELUM_DISEBUTKAN'}."
    reasons = ("contextual_complaint",) + (
        ("sensitive_information_detected",) if sensitive_types else ()
    )
    hash_payload = {
        **issue_payload,
        "severity": severity.value,
        "missing": missing,
        "sensitive_types": sensitive_types,
        "fingerprint": fingerprint,
        "reason_codes": reasons,
    }
    return ComplaintIntakeResult(
        category,
        severity,
        summary,
        requested_outcome,
        required,
        missing,
        bool(sensitive_types),
        sensitive_types,
        "CREATE",
        None,
        fingerprint,
        category,
        reviewer,
        reasons,
        sha256(json.dumps(hash_payload, sort_keys=True).encode()).hexdigest(),
    )


def create_or_touch_complaint_case(
    db: Session,
    *,
    conversation: Conversation,
    message: str,
    category: SafeHandoffCategory,
    handoff: SafeHandoffResult,
    policy_decision_hash: str | None,
    observed_at: datetime | None = None,
) -> ComplaintIntakeResult:
    now = observed_at or datetime.now(timezone.utc)
    customer_profile_id = (
        conversation.lead.customer_profile_id if conversation.lead else None
    )
    intake = build_complaint_intake(
        message=message,
        category=category,
        channel=conversation.channel,
        observed_at=now,
        organization_id=conversation.organization_id,
        customer_profile_id=customer_profile_id,
        conversation_id=conversation.id,
    )
    issue_signature = _issue_signature_from_intake(intake)
    cutoff = now - timedelta(days=max(1, settings.clara_complaint_incident_window_days))
    existing = db.scalar(
        select(ComplaintCase)
        .where(
            ComplaintCase.organization_id == conversation.organization_id,
            ComplaintCase.customer_profile_id == customer_profile_id,
            ComplaintCase.conversation_id == conversation.id,
            ComplaintCase.category == category.value,
            ComplaintCase.issue_signature == issue_signature,
            ComplaintCase.last_seen_at > cutoff,
        )
        .order_by(ComplaintCase.last_seen_at.desc())
    )
    if existing:
        previous = existing.status
        action = "REOPEN" if previous == "CLOSED" else "UPDATE"
        if previous == "CLOSED":
            existing.status = "REOPENED"
        existing.last_seen_at = now
        existing.version += 1
        _event(
            db,
            existing,
            "REOPENED" if previous == "CLOSED" else "REOBSERVED",
            previous,
            existing.status,
            ("same_incident_identity",),
            safe_metadata={
                "intake_hash": intake.intake_hash,
                "sensitive_information_types": list(intake.sensitive_information_types),
            },
        )
        return replace(
            intake,
            create_or_update_action=action,
            case_id=existing.id,
            case_fingerprint=existing.fingerprint,
        )

    case = ComplaintCase(
        organization_id=conversation.organization_id,
        customer_profile_id=customer_profile_id,
        conversation_id=conversation.id,
        lead_id=conversation.lead_id,
        source_channel=conversation.channel,
        source_reference=conversation.external_thread_id
        or conversation.external_thread_key,
        category=category.value,
        severity=intake.severity.value,
        status="TRIAGE_REQUIRED"
        if intake.severity in {ComplaintSeverity.HIGH, ComplaintSeverity.CRITICAL}
        else "OPEN",
        safe_summary=intake.safe_summary,
        requested_outcome=intake.requested_outcome,
        reviewer_requirement=intake.reviewer_requirement.value,
        policy_decision_hash=policy_decision_hash,
        handoff_content_hash=handoff.content_hash,
        fingerprint=intake.case_fingerprint,
        issue_signature=issue_signature,
        incident_bucket=_incident_bucket(now),
        first_seen_at=now,
        last_seen_at=now,
    )
    db.add(case)
    db.flush()
    _event(
        db,
        case,
        "CREATED",
        None,
        case.status,
        ("routed_complaint",),
        safe_metadata={
            "intake_hash": intake.intake_hash,
            "missing_information": list(intake.missing_information),
            "sensitive_information_types": list(intake.sensitive_information_types),
        },
    )
    return replace(intake, case_id=case.id)


def _issue_signature_from_intake(intake: ComplaintIntakeResult) -> str:
    return sha256(intake.safe_summary.encode()).hexdigest()


def _incident_bucket(observed_at: datetime) -> str:
    return str(
        observed_at.date().toordinal()
        // max(1, settings.clara_complaint_incident_window_days)
    )


def _requested_outcome(text: str, human: bool) -> str | None:
    if re.search(r"\b(?:refund|pengembalian\s+dana)\b", text, re.I):
        return "REFUND_REVIEW"
    if re.search(r"\b(?:kompensasi|ganti\s+rugi)\b", text, re.I):
        return "COMPENSATION_REVIEW"
    if human:
        return "HUMAN_HANDLING"
    if re.search(r"\b(?:cek|(?:di)?periksa|investigasi|tinjau)\b", text, re.I):
        return "INVESTIGATION"
    return None


def _severity(category: SafeHandoffCategory) -> ComplaintSeverity:
    return (
        ComplaintSeverity.HIGH
        if category
        in {
            SafeHandoffCategory.FINANCIAL_LOSS_CLAIM,
            SafeHandoffCategory.REFUND_OR_COMPENSATION,
            SafeHandoffCategory.LEGAL_OR_REGULATOR_THREAT,
            SafeHandoffCategory.FRAUD_ALLEGATION,
        }
        else ComplaintSeverity.MEDIUM
    )


def _event(
    db: Session,
    case: ComplaintCase,
    event_type: str,
    previous: str | None,
    new: str,
    reasons: tuple[str, ...],
    *,
    actor_user_id: UUID | None = None,
    safe_metadata: dict | None = None,
) -> None:
    db.add(
        ComplaintCaseEvent(
            complaint_case_id=case.id,
            previous_status=previous,
            new_status=new,
            event_type=event_type,
            reason_codes=list(reasons),
            actor_user_id=actor_user_id,
            source_reference=case.source_reference,
            safe_metadata=safe_metadata or {},
        )
    )


ALLOWED_TRANSITIONS = {
    "OPEN": {"TRIAGE_REQUIRED", "IN_REVIEW", "ESCALATED", "RESOLVED"},
    "TRIAGE_REQUIRED": {"IN_REVIEW", "ESCALATED"},
    "IN_REVIEW": {"WAITING_CUSTOMER", "ESCALATED", "RESOLVED"},
    "WAITING_CUSTOMER": {"IN_REVIEW", "ESCALATED", "RESOLVED"},
    "ESCALATED": {"IN_REVIEW", "WAITING_CUSTOMER", "RESOLVED"},
    "RESOLVED": {"CLOSED", "REOPENED"},
    "REOPENED": {"IN_REVIEW", "ESCALATED", "RESOLVED"},
    "CLOSED": {"REOPENED"},
}


def transition_complaint_case(
    db: Session,
    case: ComplaintCase,
    *,
    new_status: str,
    expected_version: int,
    actor_user_id: UUID,
    reason_codes: tuple[str, ...],
) -> ComplaintCase:
    if case.version != expected_version:
        raise ValueError("Complaint case changed; refresh and retry.")
    if new_status not in ALLOWED_TRANSITIONS.get(case.status, set()):
        raise ValueError(f"Transition {case.status} -> {new_status} is not allowed.")
    previous = case.status
    case.status = new_status
    case.version += 1
    now = datetime.now(timezone.utc)
    case.updated_at = now
    if new_status == "RESOLVED":
        case.resolved_at = now
    if new_status == "CLOSED":
        case.closed_at = now
    event_type = (
        new_status
        if new_status in {"ESCALATED", "RESOLVED", "CLOSED", "REOPENED"}
        else "STATUS_CHANGED"
    )
    _event(
        db,
        case,
        event_type,
        previous,
        new_status,
        reason_codes,
        actor_user_id=actor_user_id,
    )
    return case


def assign_complaint_case(
    db: Session,
    case: ComplaintCase,
    *,
    assigned_user_id: UUID,
    expected_version: int,
    actor_user_id: UUID,
    reason_codes: tuple[str, ...],
) -> ComplaintCase:
    if case.version != expected_version:
        raise ValueError("Complaint case changed; refresh and retry.")
    previous = case.assigned_user_id
    case.assigned_user_id = assigned_user_id
    case.version += 1
    _event(
        db,
        case,
        "ASSIGNED",
        case.status,
        case.status,
        reason_codes,
        actor_user_id=actor_user_id,
        safe_metadata={
            "previous_assigned_user_id": str(previous) if previous else None,
            "new_assigned_user_id": str(assigned_user_id),
        },
    )
    return case


def change_complaint_severity(
    db: Session,
    case: ComplaintCase,
    *,
    new_severity: str,
    expected_version: int,
    actor_user_id: UUID,
    reason_codes: tuple[str, ...],
) -> ComplaintCase:
    if case.version != expected_version:
        raise ValueError("Complaint case changed; refresh and retry.")
    if new_severity not in {item.value for item in ComplaintSeverity}:
        raise ValueError("Invalid complaint severity.")
    previous = case.severity
    case.severity = new_severity
    case.version += 1
    _event(
        db,
        case,
        "SEVERITY_CHANGED",
        case.status,
        case.status,
        reason_codes,
        actor_user_id=actor_user_id,
        safe_metadata={"previous_severity": previous, "new_severity": new_severity},
    )
    return case


def append_safe_intake(
    db: Session,
    case: ComplaintCase,
    *,
    expected_version: int,
    actor_user_id: UUID,
    reason_codes: tuple[str, ...],
    safe_metadata: dict,
) -> ComplaintCase:
    if case.version != expected_version:
        raise ValueError("Complaint case changed; refresh and retry.")
    allowed = {
        "approximate_time",
        "affected_feature_or_process",
        "money_involved",
        "account_access_concern",
        "requested_outcome",
    }
    metadata = {
        key: value
        for key, value in safe_metadata.items()
        if key in allowed and value is not None
    }
    case.version += 1
    _event(
        db,
        case,
        "SAFE_INTAKE_APPENDED",
        case.status,
        case.status,
        reason_codes,
        actor_user_id=actor_user_id,
        safe_metadata=metadata,
    )
    return case

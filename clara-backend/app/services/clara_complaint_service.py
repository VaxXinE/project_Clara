from datetime import datetime, timezone
from hashlib import sha256
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.complaint_case import ComplaintCase, ComplaintCaseEvent
from app.models.conversation import Conversation
from app.services.clara_safe_handoff_service import (
    SafeHandoffCategory,
    SafeHandoffResult,
)


HIGH_RISK_CATEGORIES = {
    SafeHandoffCategory.FINANCIAL_LOSS_CLAIM,
    SafeHandoffCategory.REFUND_OR_COMPENSATION,
    SafeHandoffCategory.LEGAL_OR_REGULATOR_THREAT,
    SafeHandoffCategory.FRAUD_ALLEGATION,
}


def create_or_touch_complaint_case(
    db: Session,
    *,
    conversation: Conversation,
    category: SafeHandoffCategory,
    handoff: SafeHandoffResult,
    policy_decision_hash: str | None,
) -> ComplaintCase:
    now = datetime.now(timezone.utc)
    customer_profile_id = (
        conversation.lead.customer_profile_id if conversation.lead else None
    )
    identity = f"{conversation.organization_id}:{customer_profile_id}:{conversation.id}:{category.value}"
    fingerprint = sha256(identity.encode()).hexdigest()
    existing = db.scalar(
        select(ComplaintCase).where(ComplaintCase.fingerprint == fingerprint)
    )
    if existing:
        previous = existing.status
        if existing.status == "CLOSED":
            existing.status = "REOPENED"
        existing.last_seen_at = now
        existing.version += 1
        _event(
            db,
            existing,
            "REOPENED" if previous == "CLOSED" else "REOBSERVED",
            previous,
            existing.status,
            ("same_incident_fingerprint",),
        )
        return existing

    severity = "HIGH" if category in HIGH_RISK_CATEGORIES else "MEDIUM"
    case = ComplaintCase(
        organization_id=conversation.organization_id,
        customer_profile_id=customer_profile_id,
        conversation_id=conversation.id,
        lead_id=conversation.lead_id,
        source_channel=conversation.channel,
        source_reference=conversation.external_thread_id
        or conversation.external_thread_key,
        category=category.value,
        severity=severity,
        status="TRIAGE_REQUIRED" if severity == "HIGH" else "OPEN",
        safe_summary=f"Keluhan terklasifikasi sebagai {category.value}.",
        reviewer_requirement="COMPLIANCE_REVIEW"
        if severity == "HIGH"
        else "MANAGER_REVIEW",
        policy_decision_hash=policy_decision_hash,
        handoff_content_hash=handoff.content_hash,
        fingerprint=fingerprint,
        first_seen_at=now,
        last_seen_at=now,
    )
    db.add(case)
    db.flush()
    _event(db, case, "CREATED", None, case.status, ("routed_complaint",))
    return case


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
    _event(
        db,
        case,
        "STATUS_CHANGED",
        previous,
        new_status,
        reason_codes,
        actor_user_id=actor_user_id,
    )
    return case

from __future__ import annotations

from datetime import date, datetime, timedelta, timezone
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import desc, select
from sqlalchemy.orm import Session, selectinload

from app.models.lead import Lead
from app.models.lead_discipline_log import LeadDisciplineLog
from app.models.user import User
from app.schemas.lead_schema import (
    LeadDisciplineLogCreateRequest,
    LeadDisciplineLogItem,
    LeadDisciplineSuggestionResponse,
    LeadDisciplineLogUpdateRequest,
    LeadDisciplineSummaryItem,
)
from app.services.lead_activity_service import create_lead_activity_event
from app.models.ai_extraction import AIExtraction
from app.models.conversation import Conversation
from app.models.message import Message
from app.models.sent_message import SentMessage


VALID_DISCIPLINE_COMPLIANCE_STATUSES = {
    "logged_today",
    "missing_today_log",
    "stale_log",
}


def _get_latest_conversation(lead: Lead) -> Conversation | None:
    if not lead.conversations:
        return None
    return max(
        lead.conversations,
        key=lambda conversation: (
            conversation.last_message_at or conversation.created_at,
            conversation.created_at,
        ),
    )


def _get_latest_message(conversation: Conversation | None) -> Message | None:
    if conversation is None or not conversation.messages:
        return None
    return max(conversation.messages, key=lambda message: message.message_timestamp)


def _get_latest_extraction(conversation: Conversation | None) -> AIExtraction | None:
    if conversation is None or not conversation.ai_extractions:
        return None
    return max(conversation.ai_extractions, key=lambda extraction: extraction.created_at)


def _get_latest_sent_message(conversation: Conversation | None) -> SentMessage | None:
    if conversation is None or not conversation.sent_messages:
        return None
    return max(conversation.sent_messages, key=lambda sent_message: sent_message.sent_at)


def _suggest_activity_type(
    latest_message: Message | None,
    latest_sent_message: SentMessage | None,
) -> str:
    if latest_sent_message is not None:
        return "follow_up_chat"
    if latest_message is not None and latest_message.sender_type == "customer":
        return "follow_up_chat"
    return "internal_coordination"


def _suggest_result_status(
    extraction: AIExtraction | None,
    latest_message: Message | None,
) -> str:
    if extraction is not None and extraction.risk_level == "high":
        return "needs_escalation"
    if latest_message is not None and latest_message.sender_type == "customer":
        return "waiting_customer"
    if extraction is not None and extraction.pipeline_stage in {"closing", "won"}:
        return "won_progress"
    return "follow_up_scheduled"


def _suggest_customer_mood(extraction: AIExtraction | None) -> str:
    if extraction is None:
        return "neutral"

    mood_mapping = {
        "positive": "positive",
        "cautious": "cautious",
        "negative": "resistant",
        "neutral": "neutral",
    }
    return mood_mapping.get(extraction.sentiment, "neutral")


def _suggest_next_follow_up_at(
    *,
    lead: Lead,
    extraction: AIExtraction | None,
) -> datetime | None:
    now = datetime.now(timezone.utc)
    if lead.next_follow_up_at is not None:
        return lead.next_follow_up_at
    if extraction is None:
        return now + timedelta(days=1)
    if extraction.lead_temperature == "hot":
        return now + timedelta(hours=4)
    if extraction.risk_level == "high":
        return now + timedelta(hours=8)
    return now + timedelta(days=1)


def build_discipline_log_suggestion(lead: Lead) -> LeadDisciplineSuggestionResponse:
    latest_conversation = _get_latest_conversation(lead)
    latest_message = _get_latest_message(latest_conversation)
    latest_extraction = _get_latest_extraction(latest_conversation)
    latest_sent_message = _get_latest_sent_message(latest_conversation)

    activity_type = _suggest_activity_type(latest_message, latest_sent_message)
    result_status = _suggest_result_status(latest_extraction, latest_message)
    customer_mood = _suggest_customer_mood(latest_extraction)
    main_objection = (
        latest_extraction.main_objections[0]
        if latest_extraction is not None and latest_extraction.main_objections
        else None
    )

    notes_parts: list[str] = []
    if latest_extraction is not None:
        notes_parts.append(latest_extraction.customer_summary.strip())
        if latest_extraction.next_best_action.strip():
            notes_parts.append(f"Aksi berikutnya: {latest_extraction.next_best_action.strip()}")
    if latest_message is not None and latest_message.message_text.strip():
        notes_parts.append(f"Chat terbaru: {latest_message.message_text.strip()}")

    notes = " ".join(part for part in notes_parts if part).strip()
    if not notes:
        notes = (
            "Belum ada saran AI yang cukup kuat. Sales perlu menuliskan hasil follow-up manual."
        )

    source_summary = (
        "Prefill dibuat dari AI extraction, chat terakhir, dan follow-up state lead."
        if latest_extraction is not None or latest_message is not None
        else "Prefill dibuat dari state lead saat ini karena belum ada extraction atau chat terbaru."
    )

    confidence_score = 0.82 if latest_extraction is not None else 0.45

    return LeadDisciplineSuggestionResponse(
        activity_type=activity_type,
        result_status=result_status,
        main_objection=main_objection,
        customer_mood=customer_mood,
        notes=notes,
        next_follow_up_at=_suggest_next_follow_up_at(
            lead=lead,
            extraction=latest_extraction,
        ),
        confidence_score=confidence_score,
        source_summary=source_summary,
    )


def build_lead_discipline_log_item(log: LeadDisciplineLog) -> LeadDisciplineLogItem:
    return LeadDisciplineLogItem(
        id=log.id,
        lead_id=log.lead_id,
        organization_id=log.organization_id,
        actor_user_id=log.actor_user_id,
        actor_user_name=log.actor_user.name if log.actor_user else None,
        log_date=log.log_date,
        activity_type=log.activity_type,
        result_status=log.result_status,
        main_objection=log.main_objection,
        customer_mood=log.customer_mood,
        notes=log.notes,
        next_follow_up_at=log.next_follow_up_at,
        created_at=log.created_at,
        updated_at=log.updated_at,
    )


def build_lead_discipline_summary(lead: Lead) -> LeadDisciplineSummaryItem:
    logs = sorted(
        lead.discipline_logs,
        key=lambda item: (item.log_date, item.created_at),
        reverse=True,
    )
    latest_log = logs[0] if logs else None
    today = datetime.now(timezone.utc).date()
    latest_log_date = latest_log.log_date if latest_log else None
    logs_today_count = sum(1 for item in logs if item.log_date == today)
    days_since_latest_log = (
        (today - latest_log_date).days if latest_log_date is not None else None
    )

    if latest_log_date == today:
        compliance_status = "logged_today"
    elif latest_log_date is None:
        compliance_status = "missing_today_log"
    else:
        compliance_status = "stale_log"

    return LeadDisciplineSummaryItem(
        latest_log_date=latest_log_date,
        latest_activity_type=latest_log.activity_type if latest_log else None,
        latest_result_status=latest_log.result_status if latest_log else None,
        log_count=len(logs),
        logs_today_count=logs_today_count,
        days_since_latest_log=days_since_latest_log,
        compliance_status=compliance_status,
    )


def list_lead_discipline_logs(*, lead: Lead) -> list[LeadDisciplineLogItem]:
    ordered_logs = sorted(
        lead.discipline_logs,
        key=lambda item: (item.log_date, item.created_at),
        reverse=True,
    )
    return [build_lead_discipline_log_item(log) for log in ordered_logs]


def _normalize_optional_text(value: str | None) -> str | None:
    if value is None:
        return None
    normalized = value.strip()
    return normalized or None


def _resolve_log_date(value: date | None) -> date:
    return value or datetime.now(timezone.utc).date()


def _normalize_required_text(value: str, *, field_name: str) -> str:
    normalized = value.strip()
    if not normalized:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"{field_name} cannot be empty.",
        )
    return normalized


def create_discipline_log(
    db: Session,
    *,
    lead: Lead,
    payload: LeadDisciplineLogCreateRequest,
    current_user: User,
) -> LeadDisciplineLogItem:
    log = LeadDisciplineLog(
        lead_id=lead.id,
        organization_id=lead.organization_id,
        actor_user_id=current_user.id,
        log_date=_resolve_log_date(payload.log_date),
        activity_type=_normalize_required_text(
            payload.activity_type,
            field_name="Activity type",
        ),
        result_status=_normalize_required_text(
            payload.result_status,
            field_name="Result status",
        ),
        main_objection=_normalize_optional_text(payload.main_objection),
        customer_mood=_normalize_optional_text(payload.customer_mood),
        notes=_normalize_optional_text(payload.notes),
        next_follow_up_at=payload.next_follow_up_at,
    )
    db.add(log)

    if payload.next_follow_up_at is not None and payload.next_follow_up_at != lead.next_follow_up_at:
        create_lead_activity_event(
            db=db,
            lead=lead,
            event_type="follow_up_updated",
            title="Jadwal follow-up diperbarui dari discipline log",
            description="Sales memperbarui target follow-up berikutnya saat mengisi log harian.",
            actor_user_id=current_user.id,
            from_value=lead.next_follow_up_at.isoformat() if lead.next_follow_up_at else None,
            to_value=payload.next_follow_up_at.isoformat(),
        )
        lead.next_follow_up_at = payload.next_follow_up_at

    create_lead_activity_event(
        db=db,
        lead=lead,
        event_type="discipline_log_created",
        title="Discipline log harian ditambahkan",
        description="Aktivitas lapangan sales dicatat untuk lead ini.",
        actor_user_id=current_user.id,
        from_value=None,
        to_value=(
            f"{log.log_date.isoformat()} | {log.activity_type} | {log.result_status}"
        ),
    )

    db.add(lead)
    db.commit()
    statement = (
        select(LeadDisciplineLog)
        .where(LeadDisciplineLog.id == log.id)
        .options(selectinload(LeadDisciplineLog.actor_user))
    )
    persisted_log = db.scalars(statement).first()
    assert persisted_log is not None
    return build_lead_discipline_log_item(persisted_log)


def get_discipline_log_or_raise(
    db: Session,
    *,
    lead: Lead,
    log_id: UUID,
) -> LeadDisciplineLog:
    statement = (
        select(LeadDisciplineLog)
        .where(
            LeadDisciplineLog.id == log_id,
            LeadDisciplineLog.lead_id == lead.id,
        )
        .options(selectinload(LeadDisciplineLog.actor_user))
    )
    log = db.scalars(statement).first()
    if log is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Discipline log not found.",
        )
    return log


def update_discipline_log(
    db: Session,
    *,
    lead: Lead,
    log_id: UUID,
    payload: LeadDisciplineLogUpdateRequest,
    current_user: User,
) -> LeadDisciplineLogItem:
    log = get_discipline_log_or_raise(db=db, lead=lead, log_id=log_id)
    before_summary = f"{log.log_date.isoformat()} | {log.activity_type} | {log.result_status}"

    if payload.log_date is not None:
        log.log_date = payload.log_date
    if payload.activity_type is not None:
        log.activity_type = _normalize_required_text(
            payload.activity_type,
            field_name="Activity type",
        )
    if payload.result_status is not None:
        log.result_status = _normalize_required_text(
            payload.result_status,
            field_name="Result status",
        )
    if "main_objection" in payload.model_fields_set:
        log.main_objection = _normalize_optional_text(payload.main_objection)
    if "customer_mood" in payload.model_fields_set:
        log.customer_mood = _normalize_optional_text(payload.customer_mood)
    if "notes" in payload.model_fields_set:
        log.notes = _normalize_optional_text(payload.notes)
    if "next_follow_up_at" in payload.model_fields_set:
        if payload.next_follow_up_at != lead.next_follow_up_at:
            create_lead_activity_event(
                db=db,
                lead=lead,
                event_type="follow_up_updated",
                title="Jadwal follow-up diperbarui dari discipline log",
                description="Sales memperbarui target follow-up berikutnya saat mengedit log harian.",
                actor_user_id=current_user.id,
                from_value=lead.next_follow_up_at.isoformat() if lead.next_follow_up_at else None,
                to_value=payload.next_follow_up_at.isoformat() if payload.next_follow_up_at else None,
            )
            lead.next_follow_up_at = payload.next_follow_up_at
        log.next_follow_up_at = payload.next_follow_up_at

    after_summary = f"{log.log_date.isoformat()} | {log.activity_type} | {log.result_status}"
    create_lead_activity_event(
        db=db,
        lead=lead,
        event_type="discipline_log_updated",
        title="Discipline log harian diperbarui",
        description="Catatan aktivitas lapangan sales diperbarui.",
        actor_user_id=current_user.id,
        from_value=before_summary,
        to_value=after_summary,
    )

    db.add(log)
    db.add(lead)
    db.commit()
    db.refresh(log)
    return build_lead_discipline_log_item(log)


def list_lead_discipline_logs_for_user(
    db: Session,
    *,
    lead: Lead,
) -> list[LeadDisciplineLogItem]:
    statement = (
        select(LeadDisciplineLog)
        .where(LeadDisciplineLog.lead_id == lead.id)
        .options(selectinload(LeadDisciplineLog.actor_user))
        .order_by(desc(LeadDisciplineLog.log_date), desc(LeadDisciplineLog.created_at))
    )
    return [build_lead_discipline_log_item(log) for log in db.scalars(statement).all()]

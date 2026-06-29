from datetime import timezone
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.ai_extraction import AIExtraction
from app.models.conversation import Conversation
from app.models.lead import Lead
from app.models.lead_task import LeadTask
from app.models.lead_task_event import LeadTaskEvent
from app.models.message import Message
from app.models.reply_suggestion import ReplySuggestion
from app.models.sent_message import SentMessage
from app.schemas.sent_message_schema import MarkReplySentRequest
from app.services.lead_activity_service import create_lead_activity_event


class SentMessageError(RuntimeError):
    pass


def ensure_aware_utc(value):
    if value is None:
        return None
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


def append_sent_message_to_conversation_timeline(
    db: Session,
    *,
    conversation: Conversation,
    sent_by_name: str,
    message_text: str,
    message_timestamp,
) -> Message:
    timeline_message = Message(
        conversation_id=conversation.id,
        sender_name=sent_by_name,
        sender_type="sales",
        channel=conversation.channel,
        provider=conversation.provider,
        external_message_id=None,
        message_text=message_text,
        message_timestamp=message_timestamp,
    )
    db.add(timeline_message)
    db.flush()
    return timeline_message


def create_task_event_for_auto_completion(
    db: Session,
    *,
    task: LeadTask,
    from_status: str,
    notes: str,
) -> LeadTaskEvent:
    event = LeadTaskEvent(
        task_id=task.id,
        actor_user_id=None,
        event_type="system_auto_done_after_send",
        from_status=from_status,
        to_status="done",
        previous_due_at=task.due_at,
        next_due_at=task.due_at,
        notes=notes,
    )
    db.add(event)
    db.flush()
    return event


def sync_follow_up_state_after_sent_message(
    db: Session,
    *,
    conversation: Conversation,
    sent_at,
) -> None:
    if conversation.lead_id is None:
        return

    lead = db.get(Lead, conversation.lead_id)
    if lead is None:
        return

    sent_at_utc = ensure_aware_utc(sent_at)
    lead.last_contact_at = sent_at_utc

    next_follow_up_at = ensure_aware_utc(lead.next_follow_up_at)
    if next_follow_up_at is not None and next_follow_up_at <= sent_at_utc:
        previous_follow_up_at = next_follow_up_at
        lead.next_follow_up_at = None
        create_lead_activity_event(
            db=db,
            lead=lead,
            event_type="follow_up_updated",
            title="Jadwal follow-up lama dibersihkan",
            description="Clara membersihkan jadwal follow-up yang sudah dieksekusi setelah reply ditandai terkirim.",
            actor_user_id=conversation.sales_user_id,
            from_value=previous_follow_up_at.isoformat(),
            to_value=None,
        )

    statement = (
        select(LeadTask)
        .where(
            LeadTask.lead_id == lead.id,
            LeadTask.status.in_({"open", "snoozed"}),
            LeadTask.task_type.in_(
                {"manual_follow_up", "scheduled_follow_up", "approval_follow_up"}
            ),
        )
        .order_by(LeadTask.created_at.desc())
    )
    open_tasks = list(db.scalars(statement).all())

    for task in open_tasks:
        task_due_at = ensure_aware_utc(task.due_at)
        if task_due_at is not None and task_due_at > sent_at_utc:
            continue

        previous_status = task.status
        task.status = "done"
        task.completed_at = sent_at_utc
        task.completed_by_user_id = conversation.sales_user_id
        task.last_status_changed_at = sent_at_utc
        db.add(task)
        create_task_event_for_auto_completion(
            db=db,
            task=task,
            from_status=previous_status,
            notes="Task follow-up otomatis diselesaikan karena reply sudah ditandai terkirim dari conversation detail.",
        )
        create_lead_activity_event(
            db=db,
            lead=lead,
            event_type="task_event",
            title="Task follow-up otomatis diselesaikan",
            description=task.title,
            actor_user_id=conversation.sales_user_id,
            from_value=previous_status,
            to_value="done",
        )

    db.add(lead)
    db.flush()


def get_latest_extraction(
    db: Session,
    conversation_id: UUID,
) -> AIExtraction | None:
    statement = (
        select(AIExtraction)
        .where(AIExtraction.conversation_id == conversation_id)
        .order_by(AIExtraction.created_at.desc())
    )

    return db.scalars(statement).first()


def mark_reply_suggestion_as_sent(
    db: Session,
    reply_suggestion_id: UUID,
    payload: MarkReplySentRequest,
) -> SentMessage:
    suggestion = db.get(ReplySuggestion, reply_suggestion_id)

    if suggestion is None:
        raise SentMessageError("Reply suggestion not found.")

    if suggestion.approval_status != "approved":
        raise SentMessageError("Only approved reply suggestions can be marked as sent.")

    if not suggestion.final_reply_text:
        raise SentMessageError("Approved reply has no final reply text.")

    existing_sent_message = db.scalars(
        select(SentMessage).where(
            SentMessage.reply_suggestion_id == suggestion.id,
        )
    ).first()

    if existing_sent_message is not None:
        raise SentMessageError("This reply suggestion has already been marked as sent.")

    conversation = db.get(Conversation, suggestion.conversation_id)

    if conversation is None:
        raise SentMessageError("Conversation not found.")

    sent_message = SentMessage(
        conversation_id=suggestion.conversation_id,
        reply_suggestion_id=suggestion.id,
        send_mode="manual_simulation",
        message_text=suggestion.final_reply_text,
        sent_by_name=payload.sent_by_name,
        external_message_id=None,
    )

    latest_extraction = get_latest_extraction(
        db=db,
        conversation_id=suggestion.conversation_id,
    )

    conversation.status = "replied"

    if latest_extraction is not None:
        conversation.current_stage = latest_extraction.pipeline_stage
        conversation.lead_temperature = latest_extraction.lead_temperature

    db.add(sent_message)
    db.flush()
    sent_at = sent_message.sent_at
    conversation.last_message_at = sent_at

    append_sent_message_to_conversation_timeline(
        db=db,
        conversation=conversation,
        sent_by_name=payload.sent_by_name,
        message_text=suggestion.final_reply_text,
        message_timestamp=sent_at,
    )
    sync_follow_up_state_after_sent_message(
        db=db,
        conversation=conversation,
        sent_at=sent_at,
    )

    db.add(conversation)
    db.commit()
    db.refresh(sent_message)

    return sent_message


def list_sent_messages(
    db: Session,
    conversation_id: UUID,
) -> list[SentMessage]:
    statement = (
        select(SentMessage)
        .where(SentMessage.conversation_id == conversation_id)
        .order_by(SentMessage.sent_at.desc())
    )

    return list(db.scalars(statement).all())

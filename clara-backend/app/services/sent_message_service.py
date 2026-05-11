from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.ai_extraction import AIExtraction
from app.models.conversation import Conversation
from app.models.reply_suggestion import ReplySuggestion
from app.models.sent_message import SentMessage
from app.schemas.sent_message_schema import MarkReplySentRequest


class SentMessageError(RuntimeError):
    pass


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
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import desc, select
from sqlalchemy.orm import Session, selectinload

from app.db.session import get_db
from app.models.conversation import Conversation
from app.schemas.conversation_schema import ConversationDetail, ConversationListItem

router = APIRouter(prefix="/conversations", tags=["conversations"])


@router.get("", response_model=list[ConversationListItem])
def list_conversations(
    db: Session = Depends(get_db),
) -> list[Conversation]:
    statement = select(Conversation).order_by(desc(Conversation.created_at))
    return list(db.scalars(statement).all())


@router.get("/{conversation_id}", response_model=ConversationDetail)
def get_conversation(
    conversation_id: UUID,
    db: Session = Depends(get_db),
) -> Conversation:
    statement = (
        select(Conversation)
        .where(Conversation.id == conversation_id)
        .options(selectinload(Conversation.messages))
    )

    conversation = db.scalars(statement).first()

    if conversation is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Conversation not found.",
        )

    conversation.messages.sort(key=lambda message: message.message_timestamp)

    return conversation
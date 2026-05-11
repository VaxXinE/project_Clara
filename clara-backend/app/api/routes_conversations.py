from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import desc, select
from sqlalchemy.orm import Session, selectinload

from app.db.session import get_db
from app.models.conversation import Conversation
from app.schemas.conversation_schema import ConversationDetail, ConversationListItem
from app.core.security import require_roles
from app.models.user import User
from app.services.access_control_service import can_access_all_conversations

router = APIRouter(prefix="/conversations", tags=["conversations"])


@router.get("", response_model=list[ConversationListItem])
def list_conversations(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("sales", "admin")),
) -> list[Conversation]:
    if current_user.organization_id is None:
        return []

    statement = select(Conversation)
    statement = statement.where(
        Conversation.organization_id == current_user.organization_id
    )

    if not can_access_all_conversations(current_user):
        statement = statement.where(Conversation.sales_user_id == current_user.id)

    statement = statement.order_by(desc(Conversation.created_at))

    return list(db.scalars(statement).all())


@router.get("/{conversation_id}", response_model=ConversationDetail)
def get_conversation(
    conversation_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("sales", "admin")),
) -> Conversation:
    if current_user.organization_id is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Conversation not found.",
        )

    statement = (
        select(Conversation)
        .where(Conversation.id == conversation_id)
        .where(Conversation.organization_id == current_user.organization_id)
        .options(selectinload(Conversation.messages))
    )

    if not can_access_all_conversations(current_user):
        statement = statement.where(Conversation.sales_user_id == current_user.id)

    conversation = db.scalars(statement).first()

    if conversation is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Conversation not found.",
        )

    conversation.messages.sort(key=lambda message: message.message_timestamp)

    return conversation

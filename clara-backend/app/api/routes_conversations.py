from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import desc, select
from sqlalchemy.orm import Session, selectinload

from app.db.session import get_db
from app.models.conversation import Conversation
from app.schemas.conversation_schema import ConversationDetail, ConversationListItem
from app.core.security import require_roles
from app.models.user import User
from app.services.access_control_service import apply_sales_user_scope_filter
from app.services.conversation_lifecycle_service import is_conversation_auto_archived
from app.services.role_service import is_superadmin_like

router = APIRouter(prefix="/conversations", tags=["conversations"])


@router.get("", response_model=list[ConversationListItem])
def list_conversations(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("sales", "manager", "head", "superadmin")),
) -> list[Conversation]:
    if current_user.organization_id is None and not is_superadmin_like(current_user.role):
        return []

    statement = select(Conversation)
    if not is_superadmin_like(current_user.role):
        statement = statement.where(
            Conversation.organization_id == current_user.organization_id
        )

    statement = apply_sales_user_scope_filter(
        statement,
        db=db,
        current_user=current_user,
        sales_user_id_column=Conversation.sales_user_id,
    )

    statement = statement.order_by(desc(Conversation.created_at))

    conversations = [
        conversation
        for conversation in db.scalars(statement).all()
        if not is_conversation_auto_archived(conversation)
    ]

    return conversations


@router.get("/{conversation_id}", response_model=ConversationDetail)
def get_conversation(
    conversation_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("sales", "manager", "head", "superadmin")),
) -> Conversation:
    if current_user.organization_id is None and not is_superadmin_like(current_user.role):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Conversation not found.",
        )

    statement = select(Conversation).where(Conversation.id == conversation_id).options(
        selectinload(Conversation.messages)
    )
    if not is_superadmin_like(current_user.role):
        statement = statement.where(Conversation.organization_id == current_user.organization_id)

    statement = apply_sales_user_scope_filter(
        statement,
        db=db,
        current_user=current_user,
        sales_user_id_column=Conversation.sales_user_id,
    )

    conversation = db.scalars(statement).first()

    if conversation is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Conversation not found.",
        )

    conversation.messages.sort(key=lambda message: message.message_timestamp)

    return conversation

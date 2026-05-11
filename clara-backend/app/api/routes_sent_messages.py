from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.core.security import require_roles
from app.db.session import get_db
from app.models.user import User
from app.schemas.sent_message_schema import (
    MarkReplySentRequest,
    SentMessageResponse,
)
from app.services.audit_service import create_audit_log
from app.services.sent_message_service import (
    SentMessageError,
    list_sent_messages,
    mark_reply_suggestion_as_sent,
)

router = APIRouter(tags=["sent-messages"])


@router.post(
    "/reply-suggestions/{reply_suggestion_id}/mark-sent",
    response_model=SentMessageResponse,
    status_code=status.HTTP_201_CREATED,
)
def mark_reply_sent_endpoint(
    reply_suggestion_id: UUID,
    payload: MarkReplySentRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("sales", "admin")),
):
    try:
        sent_message = mark_reply_suggestion_as_sent(
            db=db,
            reply_suggestion_id=reply_suggestion_id,
            payload=payload,
        )

        create_audit_log(
            db=db,
            action="reply_suggestion.mark_sent",
            resource_type="reply_suggestion",
            resource_id=str(reply_suggestion_id),
            current_user=current_user,
            request=request,
        )

        return sent_message
    except SentMessageError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc


@router.get(
    "/conversations/{conversation_id}/sent-messages",
    response_model=list[SentMessageResponse],
)
def list_sent_messages_endpoint(
    conversation_id: UUID,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles("sales", "admin")),
):
    return list_sent_messages(
        db=db,
        conversation_id=conversation_id,
    )

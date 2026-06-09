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
from app.services.access_control_service import AccessDeniedError, get_accessible_reply_suggestion_or_raise, get_accessible_conversation_or_raise

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
    current_user: User = Depends(require_roles("sales", "manager", "head", "superadmin")),
):
    try:
        get_accessible_reply_suggestion_or_raise(
            db=db,
            reply_suggestion_id=reply_suggestion_id,
            current_user=current_user,
        )
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
    except AccessDeniedError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(exc),
        ) from exc


@router.get(
    "/conversations/{conversation_id}/sent-messages",
    response_model=list[SentMessageResponse],
)
def list_sent_messages_endpoint(
    conversation_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("sales", "manager", "head", "superadmin")),
):
    try:
        get_accessible_conversation_or_raise(
            db=db,
            conversation_id=conversation_id,
            current_user=current_user,
        )

        return list_sent_messages(
            db=db,
            conversation_id=conversation_id,
        )
    except AccessDeniedError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(exc),
        ) from exc

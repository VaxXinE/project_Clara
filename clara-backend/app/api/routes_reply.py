from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.core.security import require_roles
from app.db.session import get_db
from app.models.user import User
from app.schemas.reply_suggestion_schema import (
    ApproveReplyRequest,
    RejectReplyRequest,
    ReplySuggestionResponse,
)
from app.services.audit_service import create_audit_log
from app.services.reply_suggestion_service import (
    ReplySuggestionError,
    approve_reply_suggestion,
    create_reply_suggestion,
    list_reply_suggestions,
    reject_reply_suggestion,
)
from app.services.access_control_service import (
    AccessDeniedError,
    get_accessible_conversation_or_raise,
    get_accessible_reply_suggestion_or_raise,
)

router = APIRouter(tags=["reply-suggestions"])


@router.post(
    "/conversations/{conversation_id}/reply-suggestions",
    response_model=ReplySuggestionResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_reply_suggestion_endpoint(
    conversation_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("marketing", "admin")),
):
    try:
        get_accessible_conversation_or_raise(
            db=db,
            conversation_id=conversation_id,
            current_user=current_user,
        )

        return create_reply_suggestion(db=db, conversation_id=conversation_id)
    except ReplySuggestionError as exc:
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
    "/conversations/{conversation_id}/reply-suggestions",
    response_model=list[ReplySuggestionResponse],
)
def list_reply_suggestions_endpoint(
    conversation_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("marketing", "admin")),
):
    try:
        get_accessible_conversation_or_raise(
            db=db,
            conversation_id=conversation_id,
            current_user=current_user,
        )
        return list_reply_suggestions(db=db, conversation_id=conversation_id)
    except AccessDeniedError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(exc),
        ) from exc




@router.post(
    "/reply-suggestions/{reply_suggestion_id}/approve",
    response_model=ReplySuggestionResponse,
)
def approve_reply_suggestion_endpoint(
    reply_suggestion_id: UUID,
    payload: ApproveReplyRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("marketing", "admin")),
):
    try:
        get_accessible_reply_suggestion_or_raise(
            db=db,
            reply_suggestion_id=reply_suggestion_id,
            current_user=current_user,
        )
        suggestion = approve_reply_suggestion(
            db=db,
            reply_suggestion_id=reply_suggestion_id,
            payload=payload,
        )

        create_audit_log(
            db=db,
            action="reply_suggestion.approve",
            resource_type="reply_suggestion",
            resource_id=str(reply_suggestion_id),
            current_user=current_user,
            request=request,
        )

        return suggestion
    except ReplySuggestionError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc
    except AccessDeniedError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(exc),
        ) from exc


@router.post(
    "/reply-suggestions/{reply_suggestion_id}/reject",
    response_model=ReplySuggestionResponse,
)
def reject_reply_suggestion_endpoint(
    reply_suggestion_id: UUID,
    payload: RejectReplyRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("marketing", "admin")),
):
    try:
        get_accessible_reply_suggestion_or_raise(
            db=db,
            reply_suggestion_id=reply_suggestion_id,
            current_user=current_user,
        )
        suggestion = reject_reply_suggestion(
            db=db,
            reply_suggestion_id=reply_suggestion_id,
            payload=payload,
        )

        create_audit_log(
            db=db,
            action="reply_suggestion.reject",
            resource_type="reply_suggestion",
            resource_id=str(reply_suggestion_id),
            current_user=current_user,
            request=request,
            metadata={"reason": payload.reason},
        )

        return suggestion
    except ReplySuggestionError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc
    except AccessDeniedError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(exc),
        ) from exc

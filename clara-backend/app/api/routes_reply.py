from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.core.security import require_roles
from app.models.user import User
from app.db.session import get_db
from app.schemas.reply_suggestion_schema import (
    ApproveReplyRequest,
    RejectReplyRequest,
    ReplySuggestionResponse,
)
from app.services.reply_suggestion_service import (
    ReplySuggestionError,
    approve_reply_suggestion,
    create_reply_suggestion,
    list_reply_suggestions,
    reject_reply_suggestion,
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
    _: User = Depends(require_roles("sales", "admin")),
):
    try:
        return create_reply_suggestion(db=db, conversation_id=conversation_id)
    except ReplySuggestionError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc


@router.get(
    "/conversations/{conversation_id}/reply-suggestions",
    response_model=list[ReplySuggestionResponse],
)
def list_reply_suggestions_endpoint(
    conversation_id: UUID,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles("sales", "admin")),
):
    return list_reply_suggestions(db=db, conversation_id=conversation_id)


@router.post(
    "/reply-suggestions/{reply_suggestion_id}/approve",
    response_model=ReplySuggestionResponse,
)
def approve_reply_suggestion_endpoint(
    reply_suggestion_id: UUID,
    payload: ApproveReplyRequest,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles("sales", "admin")),
):
    try:
        return approve_reply_suggestion(
            db=db,
            reply_suggestion_id=reply_suggestion_id,
            payload=payload,
        )
    except ReplySuggestionError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc


@router.post(
    "/reply-suggestions/{reply_suggestion_id}/reject",
    response_model=ReplySuggestionResponse,
)
def reject_reply_suggestion_endpoint(
    reply_suggestion_id: UUID,
    payload: RejectReplyRequest,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles("sales", "admin")),
):
    try:
        return reject_reply_suggestion(
            db=db,
            reply_suggestion_id=reply_suggestion_id,
            payload=payload,
        )
    except ReplySuggestionError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.core.security import require_roles
from app.db.session import get_db
from app.models.user import User
from app.schemas.extension_schema import (
    WhatsAppExtensionSendReplyRequest,
    WhatsAppExtensionSendReplyResponse,
    WhatsAppExtensionReplySuggestionsResponse,
    WhatsAppExtensionSnapshotSyncRequest,
    WhatsAppExtensionSnapshotSyncResponse,
)
from app.services.access_control_service import (
    AccessDeniedError,
    get_accessible_reply_suggestion_or_raise,
)
from app.services.audit_service import create_audit_log
from app.services.extension_ingest_service import (
    confirm_extension_reply_sent,
    ExtensionSnapshotError,
    generate_extension_reply_suggestions,
    sync_whatsapp_extension_snapshot,
)

router = APIRouter(prefix="/extension", tags=["extension"])


@router.post(
    "/whatsapp/snapshots",
    response_model=WhatsAppExtensionSnapshotSyncResponse,
    status_code=status.HTTP_201_CREATED,
)
def sync_whatsapp_snapshot_endpoint(
    payload: WhatsAppExtensionSnapshotSyncRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("sales", "manager", "head")),
):
    try:
        result = sync_whatsapp_extension_snapshot(
            db=db,
            current_user=current_user,
            snapshot=payload.chat_data,
        )

        create_audit_log(
            db=db,
            action="extension.whatsapp.snapshot_sync",
            resource_type="conversation",
            resource_id=str(result.conversation_id) if result.conversation_id else None,
            current_user=current_user,
            request=request,
            metadata={
                "status": result.status,
                "duplicate": result.duplicate,
                "message_count": result.message_count,
            },
        )

        return result
    except ExtensionSnapshotError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc


@router.post(
    "/whatsapp/reply-suggestions/{reply_suggestion_id}/send",
    response_model=WhatsAppExtensionSendReplyResponse,
    status_code=status.HTTP_201_CREATED,
)
def send_whatsapp_reply_suggestion_endpoint(
    reply_suggestion_id: UUID,
    payload: WhatsAppExtensionSendReplyRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("sales", "manager", "head")),
):
    try:
        get_accessible_reply_suggestion_or_raise(
            db=db,
            reply_suggestion_id=reply_suggestion_id,
            current_user=current_user,
        )

        result = confirm_extension_reply_sent(
            db=db,
            reply_suggestion_id=reply_suggestion_id,
            selected_reply_text=payload.selected_reply_text,
            final_reply_text=payload.final_reply_text,
            sent_by_name=payload.sent_by_name,
        )

        create_audit_log(
            db=db,
            action="extension.whatsapp.reply_suggestion_send",
            resource_type="reply_suggestion",
            resource_id=str(reply_suggestion_id),
            current_user=current_user,
            request=request,
            metadata={
                "conversation_id": str(result.conversation_id),
                "sent_message_id": str(result.sent_message_id),
                "status": result.status,
                "auto_approved": result.auto_approved,
                "already_sent": result.already_sent,
            },
        )

        return result
    except ExtensionSnapshotError as exc:
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
    "/whatsapp/reply-suggestions",
    response_model=WhatsAppExtensionReplySuggestionsResponse,
    status_code=status.HTTP_201_CREATED,
)
def generate_whatsapp_reply_suggestions_endpoint(
    payload: WhatsAppExtensionSnapshotSyncRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("sales", "manager", "head")),
):
    try:
        result = generate_extension_reply_suggestions(
            db=db,
            current_user=current_user,
            snapshot=payload.chat_data,
        )

        create_audit_log(
            db=db,
            action="extension.whatsapp.reply_suggestions_generate",
            resource_type="reply_suggestion",
            resource_id=str(result.reply_suggestion_id),
            current_user=current_user,
            request=request,
            metadata={
                "conversation_id": str(result.conversation_id),
                "status": result.status,
                "duplicate": result.duplicate,
                "cached": result.cached,
                "message_count": result.message_count,
            },
        )

        return result
    except ExtensionSnapshotError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc

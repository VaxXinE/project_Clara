from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.core.security import require_roles
from app.db.session import get_db
from app.models.user import User
from app.schemas.extension_schema import (
    WhatsAppExtensionSnapshotSyncRequest,
    WhatsAppExtensionSnapshotSyncResponse,
)
from app.services.audit_service import create_audit_log
from app.services.extension_ingest_service import (
    ExtensionSnapshotError,
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
    current_user: User = Depends(require_roles("marketing", "admin")),
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

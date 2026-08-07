from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.clara_runtime_contract import runtime_contract_audit_metadata
from app.core.security import require_roles
from app.db.session import get_db
from app.models.user import User
from app.schemas.extension_schema import (
    ExtensionConfigResponse,
    ExtensionReplySuggestionsResponse,
    ExtensionSendReplyRequest,
    ExtensionSendReplyResponse,
    ExtensionSnapshotSyncRequest,
    ExtensionSnapshotSyncResponse,
    ExtensionDeliveryAuthorizationRequest,
    ExtensionDeliveryClaimRequest,
    ExtensionDeliveryClaimResponse,
    ExtensionDeliveryDecisionResponse,
    ExtensionDeliveryResultRequest,
    ExtensionDeliveryResultResponse,
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
from app.services.ai_extraction_service import AIExtractionError
from app.services.extension_ingest_service import (
    confirm_extension_reply_sent_for_channel,
    ExtensionOwnershipConflictError,
    ExtensionSnapshotError,
    generate_extension_reply_suggestions_for_channel,
    sync_extension_snapshot,
)
from app.services.reply_suggestion_service import ReplySuggestionError
from app.services.clara_extension_delivery_service import (
    CLARA_EXTENSION_DELIVERY_CONTRACT_VERSION,
    DeliveryStatus,
    ExtensionDeliveryError,
    ExtensionDeliveryMode,
    authorize_extension_delivery,
    claim_extension_delivery,
    normalize_extension_delivery_mode,
    reconcile_extension_delivery,
)

router = APIRouter(prefix="/extension", tags=["extension"])

ALLOWED_EXTENSION_CHANNELS = {"whatsapp", "instagram", "tiktok", "tawk"}


def _build_unsupported_channel_detail(channel: str) -> dict[str, str]:
    return {
        "code": "UNSUPPORTED_CHANNEL",
        "message": f"Channel extension '{channel}' tidak didukung.",
    }


def _build_feature_disabled_detail(channel: str) -> dict[str, str]:
    label = {
        "whatsapp": "WhatsApp",
        "instagram": "Instagram DM",
        "tiktok": "TikTok DM",
        "tawk": "Tawk.to Live Chat",
    }.get(channel, channel)
    return {
        "code": "FEATURE_DISABLED",
        "message": f"{label} Extension Reader sedang dinonaktifkan.",
    }


def _normalize_extension_channel_or_raise(channel: str) -> str:
    normalized = (channel or "").strip().lower()

    if normalized not in ALLOWED_EXTENSION_CHANNELS:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=_build_unsupported_channel_detail(normalized or channel),
        )

    return normalized


def _is_extension_channel_enabled(channel: str) -> bool:
    return {
        "whatsapp": settings.extension_whatsapp_enabled,
        "instagram": settings.extension_instagram_enabled,
        "tiktok": settings.extension_tiktok_enabled,
        "tawk": settings.extension_tawk_enabled,
    }[channel]


def _require_enabled_extension_channel(channel: str) -> None:
    if not _is_extension_channel_enabled(channel):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=_build_feature_disabled_detail(channel),
        )


def _sync_extension_snapshot(
    *,
    channel: str,
    payload: ExtensionSnapshotSyncRequest,
    request: Request,
    db: Session,
    current_user: User,
) -> ExtensionSnapshotSyncResponse:
    normalized_channel = _normalize_extension_channel_or_raise(channel)
    _require_enabled_extension_channel(normalized_channel)

    try:
        result = sync_extension_snapshot(
            db=db,
            channel=normalized_channel,
            provider="extension",
            current_user=current_user,
            snapshot=payload.chat_data,
        )

        create_audit_log(
            db=db,
            action=f"extension.{normalized_channel}.snapshot_sync",
            resource_type="conversation",
            resource_id=str(result.conversation_id) if result.conversation_id else None,
            current_user=current_user,
            request=request,
            metadata={
                "channel": normalized_channel,
                "provider": "extension",
                "status": result.status,
                "duplicate": result.duplicate,
                "message_count": result.message_count,
            },
        )

        return ExtensionSnapshotSyncResponse.model_validate(result.model_dump())
    except ExtensionOwnershipConflictError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "code": "CONVERSATION_OWNED_BY_OTHER_SALES",
                "message": str(exc),
            },
        ) from exc
    except ExtensionSnapshotError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc


def _send_extension_reply_suggestion(
    *,
    channel: str,
    reply_suggestion_id: UUID,
    payload: ExtensionSendReplyRequest,
    request: Request,
    db: Session,
    current_user: User,
) -> ExtensionSendReplyResponse:
    normalized_channel = _normalize_extension_channel_or_raise(channel)
    _require_enabled_extension_channel(normalized_channel)
    if normalized_channel == "tawk":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "code": "TAWK_REPLY_ACTION_NOT_AVAILABLE",
                "message": "Aksi balasan Tawk tersedia pada TAWK-03.",
            },
        )
    if (
        normalize_extension_delivery_mode(settings.clara_extension_delivery_mode).mode
        == ExtensionDeliveryMode.GOVERNED
    ):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "code": "DELIVERY_AUTHORIZATION_REQUIRED",
                "message": "Governed delivery wajib diotorisasi sebelum browser send.",
            },
        )

    try:
        get_accessible_reply_suggestion_or_raise(
            db=db,
            reply_suggestion_id=reply_suggestion_id,
            current_user=current_user,
        )

        result = confirm_extension_reply_sent_for_channel(
            db=db,
            channel=normalized_channel,
            provider="extension",
            reply_suggestion_id=reply_suggestion_id,
            selected_reply_text=payload.selected_reply_text,
            final_reply_text=payload.final_reply_text,
            sent_by_name=payload.sent_by_name,
            sender_role=current_user.role,
        )

        create_audit_log(
            db=db,
            action=f"extension.{normalized_channel}.reply_suggestion_send",
            resource_type="reply_suggestion",
            resource_id=str(reply_suggestion_id),
            current_user=current_user,
            request=request,
            metadata={
                "channel": normalized_channel,
                "provider": "extension",
                "conversation_id": str(result.conversation_id),
                "sent_message_id": str(result.sent_message_id),
                "status": result.status,
                "auto_approved": result.auto_approved,
                "already_sent": result.already_sent,
                "send_actor_role": current_user.role,
            },
        )

        return ExtensionSendReplyResponse.model_validate(result.model_dump())
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
    except ReplySuggestionError as exc:
        create_audit_log(
            db=db,
            action=f"extension.{normalized_channel}.reply_suggestion_send_failed",
            resource_type="reply_suggestion",
            resource_id=str(reply_suggestion_id),
            current_user=current_user,
            request=request,
            metadata={
                "channel": normalized_channel,
                "provider": "extension",
                "reply_suggestion_id": str(reply_suggestion_id),
                "error_type": type(exc).__name__,
                "error_message": str(exc)[:500],
            },
        )
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=str(exc),
        ) from exc
    except Exception as exc:
        create_audit_log(
            db=db,
            action=f"extension.{normalized_channel}.reply_suggestion_send_failed",
            resource_type="reply_suggestion",
            resource_id=str(reply_suggestion_id),
            current_user=current_user,
            request=request,
            metadata={
                "channel": normalized_channel,
                "provider": "extension",
                "reply_suggestion_id": str(reply_suggestion_id),
                "error_type": type(exc).__name__,
                "error_message": str(exc)[:500],
            },
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Unexpected extension reply send error.",
        ) from exc


def _generate_extension_reply_suggestions(
    *,
    channel: str,
    payload: ExtensionSnapshotSyncRequest,
    request: Request,
    db: Session,
    current_user: User,
) -> ExtensionReplySuggestionsResponse:
    normalized_channel = _normalize_extension_channel_or_raise(channel)
    _require_enabled_extension_channel(normalized_channel)

    try:
        result = generate_extension_reply_suggestions_for_channel(
            db=db,
            channel=normalized_channel,
            provider="extension",
            current_user=current_user,
            snapshot=payload.chat_data,
        )

        create_audit_log(
            db=db,
            action=f"extension.{normalized_channel}.reply_suggestions_generate",
            resource_type="reply_suggestion",
            resource_id=str(result.reply_suggestion_id),
            current_user=current_user,
            request=request,
            metadata={
                **runtime_contract_audit_metadata(),
                "channel": normalized_channel,
                "provider": "extension",
                "conversation_id": str(result.conversation_id),
                "status": result.status,
                "duplicate": result.duplicate,
                "cached": result.cached,
                "message_count": result.message_count,
            },
        )

        return ExtensionReplySuggestionsResponse.model_validate(result.model_dump())
    except ExtensionSnapshotError as exc:
        create_audit_log(
            db=db,
            action=f"extension.{normalized_channel}.reply_suggestions_generate_failed",
            resource_type="conversation",
            resource_id=None,
            current_user=current_user,
            request=request,
            metadata={
                **runtime_contract_audit_metadata(),
                "channel": normalized_channel,
                "provider": "extension",
                "error_type": type(exc).__name__,
                "error_message": str(exc)[:500],
            },
        )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc
    except (AIExtractionError, ReplySuggestionError) as exc:
        create_audit_log(
            db=db,
            action=f"extension.{normalized_channel}.reply_suggestions_generate_failed",
            resource_type="conversation",
            resource_id=None,
            current_user=current_user,
            request=request,
            metadata={
                **runtime_contract_audit_metadata(),
                "channel": normalized_channel,
                "provider": "extension",
                "error_type": type(exc).__name__,
                "error_message": str(exc)[:500],
            },
        )
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=str(exc),
        ) from exc
    except Exception as exc:
        create_audit_log(
            db=db,
            action=f"extension.{normalized_channel}.reply_suggestions_generate_failed",
            resource_type="conversation",
            resource_id=None,
            current_user=current_user,
            request=request,
            metadata={
                **runtime_contract_audit_metadata(),
                "channel": normalized_channel,
                "provider": "extension",
                "error_type": type(exc).__name__,
                "error_message": str(exc)[:500],
            },
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Unexpected extension reply generation error.",
        ) from exc


@router.get("/config", response_model=ExtensionConfigResponse)
def get_extension_config(
    current_user: User = Depends(
        require_roles("sales", "manager", "head", "superadmin")
    ),
):
    del current_user
    return ExtensionConfigResponse(
        delivery_mode=normalize_extension_delivery_mode(
            settings.clara_extension_delivery_mode
        ).mode.value,
        channels={
            "whatsapp": {
                "enabled": settings.extension_whatsapp_enabled,
                "provider": "extension",
            },
            "instagram": {
                "enabled": settings.extension_instagram_enabled,
                "provider": "extension",
            },
            "tiktok": {
                "enabled": settings.extension_tiktok_enabled,
                "provider": "extension",
            },
            "tawk": {
                "enabled": settings.extension_tawk_enabled,
                "provider": "extension",
            },
        }
    )


@router.post(
    "/{channel}/reply-suggestions/{reply_suggestion_id}/delivery-authorizations",
    response_model=ExtensionDeliveryDecisionResponse,
    status_code=status.HTTP_201_CREATED,
)
def authorize_extension_reply_delivery_endpoint(
    channel: str,
    reply_suggestion_id: UUID,
    payload: ExtensionDeliveryAuthorizationRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_roles("sales", "manager", "head", "superadmin")
    ),
):
    normalized_channel = _normalize_extension_channel_or_raise(channel)
    _require_enabled_extension_channel(normalized_channel)
    if normalized_channel == "tawk":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "TAWK_REPLY_ACTION_NOT_AVAILABLE"},
        )
    try:
        suggestion = get_accessible_reply_suggestion_or_raise(
            db=db,
            reply_suggestion_id=reply_suggestion_id,
            current_user=current_user,
        )
        decision = authorize_extension_delivery(
            db,
            channel=normalized_channel,
            current_user=current_user,
            suggestion=suggestion,
            final_reply_text=payload.final_reply_text,
            snapshot_fingerprint=payload.snapshot_fingerprint,
            latest_message_fingerprint=payload.latest_message_fingerprint,
            active_chat_fingerprint=payload.active_chat_fingerprint,
            suggestion_version=payload.suggestion_version,
            idempotency_key=payload.idempotency_key,
            explicit_human_action=payload.explicit_human_action,
        )
        create_audit_log(
            db=db,
            action="extension.delivery.authorize",
            resource_type="reply_suggestion",
            resource_id=str(reply_suggestion_id),
            current_user=current_user,
            request=request,
            metadata=decision.debug_metadata(),
        )
        return ExtensionDeliveryDecisionResponse.model_validate(
            decision.response_data()
        )
    except AccessDeniedError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ExtensionDeliveryError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc


@router.post(
    "/delivery-authorizations/{authorization_id}/claim",
    response_model=ExtensionDeliveryClaimResponse,
)
def claim_extension_reply_delivery_endpoint(
    authorization_id: UUID,
    payload: ExtensionDeliveryClaimRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_roles("sales", "manager", "head", "superadmin")
    ),
):
    try:
        authorization = claim_extension_delivery(
            db,
            authorization_id=authorization_id,
            current_user=current_user,
            authorization_token=payload.authorization_token,
            conversation_id=payload.conversation_id,
            suggestion_id=payload.suggestion_id,
            snapshot_fingerprint=payload.snapshot_fingerprint,
            latest_message_fingerprint=payload.latest_message_fingerprint,
            active_chat_fingerprint=payload.active_chat_fingerprint,
            final_text_hash=payload.final_text_hash,
        )
        create_audit_log(
            db=db,
            action="extension.delivery.claim",
            resource_type="extension_delivery_authorization",
            resource_id=str(authorization.id),
            current_user=current_user,
            request=request,
            metadata={
                "authorization_status": authorization.status,
                "token_claimed": True,
                "decision_hash": authorization.decision_hash,
                "delivery_contract_version": CLARA_EXTENSION_DELIVERY_CONTRACT_VERSION,
            },
        )
        return ExtensionDeliveryClaimResponse(
            status=authorization.status,
            reason_codes=["authorization_claimed"],
            authorization_id=authorization.id,
            decision_hash=authorization.decision_hash,
            delivery_contract_version=CLARA_EXTENSION_DELIVERY_CONTRACT_VERSION,
        )
    except ExtensionDeliveryError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc


@router.post(
    "/delivery-authorizations/{authorization_id}/result",
    response_model=ExtensionDeliveryResultResponse,
)
def reconcile_extension_reply_delivery_endpoint(
    authorization_id: UUID,
    payload: ExtensionDeliveryResultRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_roles("sales", "manager", "head", "superadmin")
    ),
):
    try:
        authorization, sent_message, duplicate = reconcile_extension_delivery(
            db,
            authorization_id=authorization_id,
            current_user=current_user,
            authorization_token=payload.authorization_token,
            result_status=payload.result,
            browser_event_id=payload.browser_event_id,
            adapter_result_code=payload.adapter_result_code,
            active_chat_fingerprint=payload.active_chat_fingerprint,
            latest_message_fingerprint=payload.latest_message_fingerprint,
            final_text_hash=payload.final_text_hash,
        )
        reconciliation_required = (
            authorization.status == DeliveryStatus.RECONCILIATION_REQUIRED.value
        )
        reason_codes = (
            ["result_replay_duplicate_prevented"]
            if duplicate
            else [
                "manual_reconciliation_required"
                if reconciliation_required
                else f"delivery_{authorization.status.lower()}"
            ]
        )
        create_audit_log(
            db=db,
            action="extension.delivery.result",
            resource_type="extension_delivery_authorization",
            resource_id=str(authorization.id),
            current_user=current_user,
            request=request,
            metadata={
                "authorization_status": authorization.status,
                "delivery_result": payload.result,
                "reconciliation_required": reconciliation_required,
                "duplicate_prevented": duplicate,
                "decision_hash": authorization.decision_hash,
                "delivery_contract_version": CLARA_EXTENSION_DELIVERY_CONTRACT_VERSION,
            },
        )
        return ExtensionDeliveryResultResponse(
            status=authorization.status,
            authorization_id=authorization.id,
            sent_message_id=sent_message.id if sent_message else None,
            reconciliation_required=reconciliation_required,
            duplicate_prevented=duplicate,
            reason_codes=reason_codes,
            delivery_contract_version=CLARA_EXTENSION_DELIVERY_CONTRACT_VERSION,
        )
    except ExtensionDeliveryError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc


@router.post(
    "/{channel}/snapshots",
    response_model=ExtensionSnapshotSyncResponse,
    status_code=status.HTTP_201_CREATED,
)
def sync_extension_snapshot_endpoint(
    channel: str,
    payload: ExtensionSnapshotSyncRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_roles("sales", "manager", "head", "superadmin")
    ),
):
    return _sync_extension_snapshot(
        channel=channel,
        payload=payload,
        request=request,
        db=db,
        current_user=current_user,
    )


@router.post(
    "/{channel}/reply-suggestions/{reply_suggestion_id}/send",
    response_model=ExtensionSendReplyResponse,
    status_code=status.HTTP_201_CREATED,
)
def send_extension_reply_suggestion_endpoint(
    channel: str,
    reply_suggestion_id: UUID,
    payload: ExtensionSendReplyRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_roles("sales", "manager", "head", "superadmin")
    ),
):
    return _send_extension_reply_suggestion(
        channel=channel,
        reply_suggestion_id=reply_suggestion_id,
        payload=payload,
        request=request,
        db=db,
        current_user=current_user,
    )


@router.post(
    "/{channel}/reply-suggestions",
    response_model=ExtensionReplySuggestionsResponse,
    status_code=status.HTTP_201_CREATED,
)
def generate_extension_reply_suggestions_endpoint(
    channel: str,
    payload: ExtensionSnapshotSyncRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_roles("sales", "manager", "head", "superadmin")
    ),
):
    return _generate_extension_reply_suggestions(
        channel=channel,
        payload=payload,
        request=request,
        db=db,
        current_user=current_user,
    )


@router.post(
    "/whatsapp/snapshots",
    response_model=WhatsAppExtensionSnapshotSyncResponse,
    status_code=status.HTTP_201_CREATED,
)
def sync_whatsapp_snapshot_endpoint(
    payload: WhatsAppExtensionSnapshotSyncRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_roles("sales", "manager", "head", "superadmin")
    ),
):
    return _sync_extension_snapshot(
        channel="whatsapp",
        payload=ExtensionSnapshotSyncRequest.model_validate(
            payload.model_dump(by_alias=True)
        ),
        request=request,
        db=db,
        current_user=current_user,
    )


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
    current_user: User = Depends(
        require_roles("sales", "manager", "head", "superadmin")
    ),
):
    return _send_extension_reply_suggestion(
        channel="whatsapp",
        reply_suggestion_id=reply_suggestion_id,
        payload=ExtensionSendReplyRequest.model_validate(
            payload.model_dump(by_alias=True)
        ),
        request=request,
        db=db,
        current_user=current_user,
    )


@router.post(
    "/whatsapp/reply-suggestions",
    response_model=WhatsAppExtensionReplySuggestionsResponse,
    status_code=status.HTTP_201_CREATED,
)
def generate_whatsapp_reply_suggestions_endpoint(
    payload: WhatsAppExtensionSnapshotSyncRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_roles("sales", "manager", "head", "superadmin")
    ),
):
    return _generate_extension_reply_suggestions(
        channel="whatsapp",
        payload=ExtensionSnapshotSyncRequest.model_validate(
            payload.model_dump(by_alias=True)
        ),
        request=request,
        db=db,
        current_user=current_user,
    )

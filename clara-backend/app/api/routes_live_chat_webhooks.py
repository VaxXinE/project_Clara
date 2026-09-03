import json

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import ValidationError
from sqlalchemy.orm import Session

from app.core.config import settings
from app.db.session import get_db
from app.schemas.live_chat_schema import LiveChatEventPayload, LiveChatIngestResponse
from app.services.audit_service import create_audit_log
from app.services.live_chat_ingest_service import (
    LiveChatAuthError,
    LiveChatIngestError,
    ingest_live_chat_event,
    validate_live_chat_signature,
)
from app.services.rate_limiter import live_chat_webhook_rate_limiter

router = APIRouter(prefix="/webhooks/live-chat", tags=["webhooks"])
MAX_LIVE_CHAT_BODY_BYTES = 6_000_000


@router.post("/events", response_model=LiveChatIngestResponse)
async def receive_live_chat_event(
    request: Request,
    db: Session = Depends(get_db),
) -> LiveChatIngestResponse:
    content_type = request.headers.get("Content-Type", "").split(";", 1)[0].strip()
    if content_type.casefold() != "application/json":
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail="Content-Type harus application/json.",
        )
    content_length = request.headers.get("Content-Length")
    if (
        content_length
        and content_length.isdigit()
        and int(content_length) > MAX_LIVE_CHAT_BODY_BYTES
    ):
        raise HTTPException(
            status_code=status.HTTP_413_CONTENT_TOO_LARGE,
            detail="Payload live chat terlalu besar.",
        )
    raw_body = await request.body()
    if len(raw_body) > MAX_LIVE_CHAT_BODY_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_CONTENT_TOO_LARGE,
            detail="Payload live chat terlalu besar.",
        )
    site_id_header = request.headers.get("X-Clara-Site-Id")
    client_ip = request.client.host if request.client else "unknown"
    if not live_chat_webhook_rate_limiter.is_allowed(
        key=f"live-chat-auth:{client_ip}",
        limit=settings.live_chat_rate_limit_per_minute,
        window_seconds=60,
    ):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Terlalu banyak request live chat.",
        )
    try:
        site_id = validate_live_chat_signature(
            body=raw_body,
            site_id=site_id_header,
            timestamp_header=request.headers.get("X-Clara-Timestamp"),
            signature_header=request.headers.get("X-Clara-Signature"),
        )
        if not live_chat_webhook_rate_limiter.is_allowed(
            key=f"live-chat:{site_id}:{client_ip}",
            limit=settings.live_chat_rate_limit_per_minute,
            window_seconds=60,
        ):
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Terlalu banyak request live chat.",
            )
        payload = LiveChatEventPayload.model_validate_json(raw_body)
        response = ingest_live_chat_event(db, site_id=site_id, payload=payload)
    except LiveChatAuthError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail=str(exc)
        ) from exc
    except LiveChatIngestError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc)
        ) from exc
    except (json.JSONDecodeError, ValidationError, ValueError) as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Payload live chat tidak sesuai kontrak.",
        ) from exc

    create_audit_log(
        db=db,
        action="webhook.live_chat.ingest",
        resource_type="conversation",
        resource_id=str(response.conversation_id),
        current_user=None,
        request=request,
        metadata={
            "channel": "live_chat",
            "provider": "official_api",
            "site_id": site_id,
            "event_id": response.event_id,
            "status": response.status,
            "processed_messages": response.processed_messages,
            "duplicate_messages": response.duplicate_messages,
        },
    )
    return response

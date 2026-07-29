import json

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.schemas.webhook_schema import TawkWebhookEnvelope, TawkWebhookIngestResponse
from app.services.audit_service import create_audit_log
from app.services.tawk_webhook_service import (
    TawkWebhookAuthError,
    TawkWebhookError,
    build_tawk_ingest_response,
    validate_tawk_signature,
)

router = APIRouter(prefix="/webhooks/tawk", tags=["webhooks"])


@router.post("", response_model=TawkWebhookIngestResponse)
async def ingest_tawk_webhook(
    request: Request,
    db: Session = Depends(get_db),
) -> TawkWebhookIngestResponse:
    raw_body = await request.body()

    try:
        validate_tawk_signature(
            body=raw_body,
            signature_header=request.headers.get("X-Tawk-Signature"),
        )
        payload = TawkWebhookEnvelope.model_validate(json.loads(raw_body.decode("utf-8")))
        response = build_tawk_ingest_response(
            payload,
            event_id=request.headers.get("X-Hook-Event-Id"),
        )
    except json.JSONDecodeError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Payload webhook Tawk.to bukan JSON yang valid.",
        ) from exc
    except TawkWebhookAuthError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=str(exc),
        ) from exc
    except TawkWebhookError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=str(exc),
        ) from exc
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Payload webhook Tawk.to tidak sesuai format yang didukung.",
        ) from exc

    create_audit_log(
        db=db,
        action="webhook.tawk.ingest",
        resource_type="webhook",
        resource_id=response.event_id,
        current_user=None,
        request=request,
        metadata={
            "channel": "live_chat",
            "provider": response.provider,
            "event": response.event,
            "event_id": response.event_id,
            "property_id": response.property_id,
            "chat_id": response.chat_id,
            "transcript_message_count": response.transcript_message_count,
        },
    )
    return response

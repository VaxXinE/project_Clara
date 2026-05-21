import json

from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response, status
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.schemas.webhook_schema import MetaWebhookEnvelope, WhatsAppWebhookIngestResponse
from app.services.audit_service import create_audit_log
from app.services.whatsapp_webhook_service import (
    WhatsAppWebhookAuthError,
    WhatsAppWebhookError,
    get_whatsapp_webhook_provider,
)

router = APIRouter(prefix="/webhooks/whatsapp", tags=["webhooks"])


@router.get("/meta", response_class=Response)
def verify_meta_whatsapp_webhook(
    hub_mode: str | None = Query(default=None, alias="hub.mode"),
    hub_verify_token: str | None = Query(default=None, alias="hub.verify_token"),
    hub_challenge: str | None = Query(default=None, alias="hub.challenge"),
) -> Response:
    provider = get_whatsapp_webhook_provider("meta")

    try:
        challenge = provider.verify_handshake(
            mode=hub_mode,
            verify_token=hub_verify_token,
            challenge=hub_challenge,
        )
    except WhatsAppWebhookAuthError as exc:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=str(exc),
        ) from exc
    except WhatsAppWebhookError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=str(exc),
        ) from exc

    return Response(content=challenge, media_type="text/plain", status_code=200)


@router.post("/meta", response_model=WhatsAppWebhookIngestResponse)
async def ingest_meta_whatsapp_webhook(
    request: Request,
    db: Session = Depends(get_db),
) -> WhatsAppWebhookIngestResponse:
    provider = get_whatsapp_webhook_provider("meta")
    raw_body = await request.body()

    try:
        provider.validate_signature(
            body=raw_body,
            signature_header=request.headers.get("X-Hub-Signature-256"),
        )
        payload = MetaWebhookEnvelope.model_validate(json.loads(raw_body.decode("utf-8")))
        response = provider.ingest(db=db, body=payload)
    except json.JSONDecodeError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Payload webhook WhatsApp bukan JSON yang valid.",
        ) from exc
    except WhatsAppWebhookAuthError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=str(exc),
        ) from exc
    except WhatsAppWebhookError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc

    create_audit_log(
        db=db,
        action="webhook.whatsapp.meta.ingest",
        resource_type="webhook",
        resource_id=None,
        current_user=None,
        request=request,
        metadata={
            "provider": response.provider,
            "processed_messages": response.processed_messages,
            "duplicate_messages": response.duplicate_messages,
            "ignored_events": response.ignored_events,
            "conversation_ids": [str(item) for item in response.conversation_ids],
        },
    )
    return response

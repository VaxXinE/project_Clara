import hashlib
import hmac
from datetime import UTC, datetime

from app.core.config import settings
from app.schemas.webhook_schema import TawkWebhookEnvelope, TawkWebhookIngestResponse


class TawkWebhookError(Exception):
    pass


class TawkWebhookAuthError(TawkWebhookError):
    pass


def validate_tawk_signature(body: bytes, signature_header: str | None) -> None:
    secret_key = settings.tawk_webhook_secret_key
    if not secret_key:
        raise TawkWebhookError("TAWK_WEBHOOK_SECRET_KEY belum dikonfigurasi.")

    if not signature_header:
        raise TawkWebhookAuthError("Header X-Tawk-Signature tidak ada.")

    expected_signature = hmac.new(
        secret_key.encode("utf-8"),
        body,
        hashlib.sha1,
    ).hexdigest()

    if not hmac.compare_digest(expected_signature, signature_header.strip()):
        raise TawkWebhookAuthError("Signature webhook Tawk.to tidak valid.")


def build_tawk_ingest_response(
    payload: TawkWebhookEnvelope,
    *,
    event_id: str | None,
) -> TawkWebhookIngestResponse:
    return TawkWebhookIngestResponse(
        provider="tawk.to",
        event=payload.event,
        event_id=event_id,
        property_id=payload.property.id,
        chat_id=payload.chat.id if payload.chat is not None else payload.chat_id,
        transcript_message_count=len(payload.chat.messages) if payload.chat is not None else 0,
        received_at=datetime.now(UTC),
    )

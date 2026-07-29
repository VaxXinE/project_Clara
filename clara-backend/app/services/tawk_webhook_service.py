from __future__ import annotations

import hashlib
import hmac
from dataclasses import dataclass
from datetime import UTC, datetime

from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.conversation import Conversation
from app.models.message import Message
from app.models.organization import Organization
from app.models.user import User
from app.schemas.webhook_schema import (
    TawkWebhookEnvelope,
    TawkWebhookIngestResponse,
    TawkWebhookTranscriptMessagePayload,
)
from app.services.lead_service import ensure_conversation_lead

TAWK_WEBHOOK_SOURCE = "tawk_webhook"


class TawkWebhookError(RuntimeError):
    pass


class TawkWebhookAuthError(TawkWebhookError):
    pass


@dataclass(frozen=True)
class ResolvedTawkWebhookContext:
    organization: Organization
    sales_user: User


def _require_tawk_secret() -> str:
    secret_key = settings.tawk_webhook_secret_key
    if not secret_key:
        raise TawkWebhookError("TAWK_WEBHOOK_SECRET_KEY belum dikonfigurasi.")
    return secret_key


def _resolve_latest_sales_message(
    payload: TawkWebhookEnvelope,
) -> TawkWebhookTranscriptMessagePayload:
    if payload.chat is None:
        raise TawkWebhookError("Payload Tawk tidak punya transcript chat untuk menentukan owner.")

    for message in sorted(payload.chat.messages, key=lambda item: item.time, reverse=True):
        if _map_sender_type(message) == "sales":
            return message

    raise TawkWebhookError(
        f"Transcript Tawk `{payload.chat.id}` belum memiliki balasan agent sales untuk menentukan owner."
    )


def _resolve_owner_candidates(
    payload: TawkWebhookEnvelope,
    latest_sales_message: TawkWebhookTranscriptMessagePayload,
) -> list[str]:
    candidates: list[str] = []

    sender_id = (
        latest_sales_message.sender.id.strip()
        if latest_sales_message.sender is not None and latest_sales_message.sender.id
        else ""
    )
    if sender_id:
        candidates.append(sender_id.casefold())

    sender_name = _map_sender_name(payload, latest_sales_message).strip()
    if sender_name:
        normalized_sender_name = sender_name.casefold()
        if normalized_sender_name not in candidates:
            candidates.append(normalized_sender_name)

    if not candidates:
        raise TawkWebhookError(
            f"Agent Tawk pada transcript `{payload.chat.id}` tidak punya identifier yang bisa dicocokkan ke database."
        )

    return candidates


def _resolve_tawk_context(
    db: Session,
    *,
    payload: TawkWebhookEnvelope,
) -> ResolvedTawkWebhookContext:
    latest_sales_message = _resolve_latest_sales_message(payload)
    candidates = _resolve_owner_candidates(payload, latest_sales_message)

    matched_users = db.scalars(
        select(User).where(
            User.is_active.is_(True),
            or_(
                func.lower(User.email).in_(candidates),
                func.lower(User.name).in_(candidates),
            ),
        )
    ).all()

    unique_users = {user.id: user for user in matched_users if user.organization_id is not None}
    if not unique_users:
        agent_label = _map_sender_name(payload, latest_sales_message)
        raise TawkWebhookError(
            f"Agent Tawk `{agent_label}` tidak punya user aktif yang match di database."
        )

    if len(unique_users) > 1:
        agent_label = _map_sender_name(payload, latest_sales_message)
        raise TawkWebhookError(
            f"Agent Tawk `{agent_label}` match ke lebih dari satu user aktif di database. Rapikan nama/email user agar unik."
        )

    sales_user = next(iter(unique_users.values()))
    organization = db.get(Organization, sales_user.organization_id)
    if organization is None:
        raise TawkWebhookError(
            f"Organization untuk user `{sales_user.email}` tidak ditemukan."
        )

    return ResolvedTawkWebhookContext(organization=organization, sales_user=sales_user)


def validate_tawk_signature(body: bytes, signature_header: str | None) -> None:
    secret_key = _require_tawk_secret()

    if not signature_header:
        raise TawkWebhookAuthError("Header X-Tawk-Signature tidak ada.")

    expected_signature = hmac.new(
        secret_key.encode("utf-8"),
        body,
        hashlib.sha1,
    ).hexdigest()

    if not hmac.compare_digest(expected_signature, signature_header.strip()):
        raise TawkWebhookAuthError("Signature webhook Tawk.to tidak valid.")


def _build_external_thread_key(payload: TawkWebhookEnvelope) -> str:
    property_id = payload.property.id.strip()
    chat_id = (
        payload.chat.id.strip()
        if payload.chat is not None
        else (payload.chat_id or "unknown_chat").strip()
    )
    return f"tawk:{property_id}:{chat_id}"


def _resolve_conversation_title(payload: TawkWebhookEnvelope) -> str:
    visitor = payload.chat.visitor if payload.chat is not None else payload.visitor
    if visitor is not None:
        if visitor.name and visitor.name.strip():
            return visitor.name.strip()
        if visitor.email and visitor.email.strip():
            return visitor.email.strip()

    if payload.property.name and payload.property.name.strip():
        return f"Tawk Chat - {payload.property.name.strip()}"

    if payload.chat is not None and payload.chat.id.strip():
        return f"Tawk Chat {payload.chat.id.strip()}"

    return "Tawk Chat"


def _find_or_create_conversation(
    db: Session,
    *,
    context: ResolvedTawkWebhookContext,
    payload: TawkWebhookEnvelope,
    transcript_text: str,
    started_at: datetime | None,
    last_message_at: datetime | None,
) -> Conversation:
    external_thread_key = _build_external_thread_key(payload)
    conversation = db.scalars(
        select(Conversation).where(
            Conversation.organization_id == context.organization.id,
            Conversation.provider_key == "tawk",
            Conversation.external_thread_key == external_thread_key,
        )
    ).first()
    if conversation is not None:
        conversation.organization_id = context.organization.id
        conversation.sales_user_id = context.sales_user.id
        conversation.title = _resolve_conversation_title(payload)
        conversation.raw_text = transcript_text
        if started_at is not None and (
            conversation.started_at is None or started_at < conversation.started_at
        ):
            conversation.started_at = started_at
        if last_message_at is not None:
            conversation.last_message_at = last_message_at
        db.add(conversation)
        return conversation

    conversation = Conversation(
        organization_id=context.organization.id,
        sales_user_id=context.sales_user.id,
        title=_resolve_conversation_title(payload),
        channel="live_chat",
        provider="official_api",
        provider_key="tawk",
        external_thread_id=external_thread_key,
        external_thread_key=external_thread_key,
        source=TAWK_WEBHOOK_SOURCE,
        status="webhook_synced",
        raw_text=transcript_text,
        started_at=started_at,
        last_message_at=last_message_at,
    )
    db.add(conversation)
    db.flush()
    return conversation


def _map_sender_type(message: TawkWebhookTranscriptMessagePayload) -> str:
    sender_type = (message.sender.t if message.sender is not None else "").strip().lower()
    if sender_type == "v":
        return "customer"
    return "sales"


def _map_sender_name(
    payload: TawkWebhookEnvelope,
    message: TawkWebhookTranscriptMessagePayload,
) -> str:
    if message.sender is not None and message.sender.n and message.sender.n.strip():
        return message.sender.n.strip()

    if _map_sender_type(message) == "customer":
        visitor = payload.chat.visitor if payload.chat is not None else payload.visitor
        if visitor is not None:
            if visitor.name and visitor.name.strip():
                return visitor.name.strip()
            if visitor.email and visitor.email.strip():
                return visitor.email.strip()
        return "Visitor"

    return "Tawk Agent"


def _format_attachment_text(message: TawkWebhookTranscriptMessagePayload) -> str:
    attachment_labels: list[str] = []
    for attachment in message.attchs:
        file_payload = attachment.content.file if attachment.content is not None else None
        if file_payload is None:
            continue
        if file_payload.name and file_payload.name.strip():
            attachment_labels.append(file_payload.name.strip())
        elif file_payload.url and file_payload.url.strip():
            attachment_labels.append(file_payload.url.strip())

    if not attachment_labels:
        return ""
    return "[Attachment] " + ", ".join(attachment_labels)


def _extract_message_text(message: TawkWebhookTranscriptMessagePayload) -> str:
    text = (message.msg or "").strip()
    attachment_text = _format_attachment_text(message)

    if text and attachment_text:
        return f"{text}\n{attachment_text}"
    if text:
        return text
    if attachment_text:
        return attachment_text
    return "[Empty message]"


def _build_message_external_id(
    payload: TawkWebhookEnvelope,
    *,
    index: int,
    message: TawkWebhookTranscriptMessagePayload,
) -> str:
    chat_id = payload.chat.id if payload.chat is not None else (payload.chat_id or "unknown_chat")
    digest_source = "|".join(
        [
            chat_id.strip(),
            str(index),
            message.time.isoformat(),
            _map_sender_type(message),
            _map_sender_name(payload, message),
            _extract_message_text(message),
        ]
    )
    digest = hashlib.sha1(digest_source.encode("utf-8")).hexdigest()
    return f"tawkmsg:{digest}"


def _build_transcript_text(payload: TawkWebhookEnvelope) -> str:
    if payload.chat is None or not payload.chat.messages:
        return ""

    lines: list[str] = []
    for message in sorted(payload.chat.messages, key=lambda item: item.time):
        timestamp = message.time.astimezone(UTC).isoformat()
        sender_name = _map_sender_name(payload, message)
        message_text = _extract_message_text(message)
        lines.append(f"[{timestamp}] {sender_name}: {message_text}")
    return "\n".join(lines)


def _persist_transcript_messages(
    db: Session,
    *,
    conversation: Conversation,
    payload: TawkWebhookEnvelope,
) -> tuple[int, int]:
    if payload.chat is None:
        return 0, 0

    processed_messages = 0
    duplicate_messages = 0
    sorted_messages = sorted(payload.chat.messages, key=lambda item: item.time)

    for index, message in enumerate(sorted_messages):
        external_message_id = _build_message_external_id(payload, index=index, message=message)
        existing_message = db.scalars(
            select(Message).where(
                Message.provider == "official_api",
                Message.channel == "live_chat",
                Message.external_message_id == external_message_id,
            )
        ).first()
        if existing_message is not None:
            duplicate_messages += 1
            continue

        db.add(
            Message(
                conversation_id=conversation.id,
                sender_name=_map_sender_name(payload, message),
                sender_type=_map_sender_type(message),
                channel="live_chat",
                provider="official_api",
                external_message_id=external_message_id,
                message_text=_extract_message_text(message),
                message_timestamp=message.time.astimezone(UTC),
            )
        )
        processed_messages += 1

    return processed_messages, duplicate_messages


def ingest_tawk_webhook(
    db: Session,
    *,
    payload: TawkWebhookEnvelope,
    event_id: str | None,
) -> TawkWebhookIngestResponse:
    transcript_message_count = len(payload.chat.messages) if payload.chat is not None else 0

    if payload.event != "chat:transcript_created" or payload.chat is None:
        return TawkWebhookIngestResponse(
            provider="tawk.to",
            event=payload.event,
            event_id=event_id,
            property_id=payload.property.id,
            chat_id=payload.chat.id if payload.chat is not None else payload.chat_id,
            ignored_events=1,
            transcript_message_count=transcript_message_count,
            received_at=datetime.now(UTC),
        )

    context = _resolve_tawk_context(db, payload=payload)
    sorted_messages = sorted(payload.chat.messages, key=lambda item: item.time)
    started_at = sorted_messages[0].time.astimezone(UTC) if sorted_messages else payload.time.astimezone(UTC)
    last_message_at = sorted_messages[-1].time.astimezone(UTC) if sorted_messages else payload.time.astimezone(UTC)
    transcript_text = _build_transcript_text(payload)

    conversation = _find_or_create_conversation(
        db,
        context=context,
        payload=payload,
        transcript_text=transcript_text,
        started_at=started_at,
        last_message_at=last_message_at,
    )
    processed_messages, duplicate_messages = _persist_transcript_messages(
        db,
        conversation=conversation,
        payload=payload,
    )
    lead = ensure_conversation_lead(
        db=db,
        conversation=conversation,
        preferred_name=_resolve_conversation_title(payload),
    )
    if lead.assigned_user_id != conversation.sales_user_id:
        lead.assigned_user_id = conversation.sales_user_id
    if lead.last_contact_at != conversation.last_message_at:
        lead.last_contact_at = conversation.last_message_at
    db.add(lead)

    db.add(conversation)
    db.commit()

    return TawkWebhookIngestResponse(
        provider="tawk.to",
        event=payload.event,
        event_id=event_id,
        property_id=payload.property.id,
        chat_id=payload.chat.id,
        processed_messages=processed_messages,
        duplicate_messages=duplicate_messages,
        ignored_events=0,
        conversation_ids=[conversation.id],
        transcript_message_count=transcript_message_count,
        received_at=datetime.now(UTC),
    )

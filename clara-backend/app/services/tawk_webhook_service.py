from __future__ import annotations

import hashlib
import hmac
import json
from dataclasses import dataclass
from datetime import UTC, datetime

from sqlalchemy import select
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
TAWK_UNMAPPED_PROPERTY = "tawk_property_unmapped"
TAWK_INVALID_ORGANIZATION_MAPPING = "tawk_organization_mapping_invalid"


class TawkWebhookError(RuntimeError):
    pass


class TawkWebhookAuthError(TawkWebhookError):
    pass


class TawkWebhookIgnoredError(TawkWebhookError):
    def __init__(self, reason_code: str) -> None:
        super().__init__(reason_code)
        self.reason_code = reason_code


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


def _normalize_identifier(value: str | None) -> str:
    return " ".join((value or "").split()).casefold()


def resolve_tawk_property_organization(
    db: Session,
    *,
    property_id: str,
) -> Organization:
    organization_slug = settings.tawk_property_organization_map.get(property_id)
    if not organization_slug or not organization_slug.strip():
        raise TawkWebhookIgnoredError(TAWK_UNMAPPED_PROPERTY)

    organizations = db.scalars(
        select(Organization).where(Organization.slug == organization_slug.strip())
    ).all()
    if len(organizations) != 1:
        raise TawkWebhookIgnoredError(TAWK_INVALID_ORGANIZATION_MAPPING)
    return organizations[0]


def _resolve_sales_user(
    db: Session,
    *,
    organization: Organization,
    property_id: str,
    latest_sales_message: TawkWebhookTranscriptMessagePayload,
) -> User:
    eligible_users = db.scalars(
        select(User).where(
            User.organization_id == organization.id,
            User.is_active.is_(True),
            User.role == "sales",
        )
    ).all()
    sender_id = _normalize_identifier(
        latest_sales_message.sender.id
        if latest_sales_message.sender is not None
        else None
    )
    sender_name = _normalize_identifier(
        latest_sales_message.sender.n
        if latest_sales_message.sender is not None
        else None
    )

    if sender_id:
        id_matches = [
            user
            for user in eligible_users
            if sender_id
            in {
                str(user.id).casefold(),
                _normalize_identifier(user.email),
            }
        ]
        if len(id_matches) == 1:
            return id_matches[0]

    if sender_name:
        email_matches = [
            user
            for user in eligible_users
            if sender_name == _normalize_identifier(user.email)
        ]
        if len(email_matches) == 1:
            return email_matches[0]

        name_matches = [
            user
            for user in eligible_users
            if sender_name == _normalize_identifier(user.name)
        ]
        if len(name_matches) == 1:
            return name_matches[0]

    default_email = settings.tawk_property_default_sales_user_map.get(property_id)
    if default_email:
        normalized_default_email = _normalize_identifier(default_email)
        default_matches = [
            user
            for user in eligible_users
            if normalized_default_email == _normalize_identifier(user.email)
        ]
        if len(default_matches) == 1:
            return default_matches[0]
        raise TawkWebhookError(
            "Default Sales user Tawk tidak valid untuk organization yang dipetakan."
        )

    raise TawkWebhookError(
        "Agent Tawk tidak punya satu Sales user aktif yang cocok di organization yang dipetakan."
    )


def _resolve_tawk_context(
    db: Session,
    *,
    payload: TawkWebhookEnvelope,
) -> ResolvedTawkWebhookContext:
    property_id = payload.property.id.strip()
    organization = resolve_tawk_property_organization(db, property_id=property_id)
    latest_sales_message = _resolve_latest_sales_message(payload)
    sales_user = _resolve_sales_user(
        db,
        organization=organization,
        property_id=property_id,
        latest_sales_message=latest_sales_message,
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


def _as_utc(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value.replace(tzinfo=UTC)
    return value.astimezone(UTC)


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
            conversation.started_at is None
            or _as_utc(started_at) < _as_utc(conversation.started_at)
        ):
            conversation.started_at = started_at
        if last_message_at is not None and (
            conversation.last_message_at is None
            or _as_utc(last_message_at) > _as_utc(conversation.last_message_at)
        ):
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
            attachment_labels.append(_normalize_display_text(file_payload.name))
        elif file_payload.mime_type and file_payload.mime_type.strip():
            attachment_labels.append(_normalize_display_text(file_payload.mime_type))
        elif file_payload.extension and file_payload.extension.strip():
            attachment_labels.append(
                f"file.{_normalize_display_text(file_payload.extension)}"
            )
        else:
            attachment_labels.append("file")

    if not attachment_labels:
        return ""
    return "[Attachment] " + ", ".join(sorted(attachment_labels))


def _normalize_display_text(value: str) -> str:
    return " ".join(value.split())


def _extract_message_text(message: TawkWebhookTranscriptMessagePayload) -> str:
    text = (message.msg or "").strip()
    attachment_text = _format_attachment_text(message)

    if text and attachment_text:
        combined_text = f"{text}\n{attachment_text}"
    elif text:
        combined_text = text
    elif attachment_text:
        combined_text = attachment_text
    else:
        combined_text = "[Empty message]"
    return combined_text[:5000]


def _normalized_attachment_metadata(
    message: TawkWebhookTranscriptMessagePayload,
) -> str:
    normalized_attachments: list[dict[str, str | int | None]] = []
    for attachment in message.attchs:
        file_payload = attachment.content.file if attachment.content is not None else None
        if file_payload is None:
            continue
        url_digest = (
            hashlib.sha256(file_payload.url.strip().encode("utf-8")).hexdigest()
            if file_payload.url and file_payload.url.strip()
            else None
        )
        normalized_attachments.append(
            {
                "type": _normalize_identifier(attachment.type),
                "name": _normalize_identifier(file_payload.name),
                "mime_type": _normalize_identifier(file_payload.mime_type),
                "size": file_payload.size,
                "extension": _normalize_identifier(file_payload.extension),
                "url_sha256": url_digest,
            }
        )
    return json.dumps(
        sorted(
            normalized_attachments,
            key=lambda item: json.dumps(item, sort_keys=True),
        ),
        sort_keys=True,
        separators=(",", ":"),
    )


def _stable_sender_identifier(
    payload: TawkWebhookEnvelope,
    message: TawkWebhookTranscriptMessagePayload,
) -> str:
    sender_id = (
        message.sender.id
        if message.sender is not None and message.sender.id
        else _map_sender_name(payload, message)
    )
    return _normalize_identifier(sender_id)


def _build_message_external_id(
    payload: TawkWebhookEnvelope,
    *,
    message: TawkWebhookTranscriptMessagePayload,
) -> str:
    property_id = payload.property.id.strip()
    chat_id = (
        payload.chat.id
        if payload.chat is not None
        else (payload.chat_id or "unknown_chat")
    )
    digest_source = "|".join(
        [
            property_id,
            chat_id.strip(),
            message.time.astimezone(UTC).isoformat(),
            _map_sender_type(message),
            _stable_sender_identifier(payload, message),
            _normalize_display_text(message.msg or ""),
            _normalized_attachment_metadata(message),
        ]
    )
    digest = hashlib.sha256(digest_source.encode("utf-8")).hexdigest()
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

    for message in sorted_messages:
        external_message_id = _build_message_external_id(payload, message=message)
        existing_message = db.scalars(
            select(Message).where(
                Message.conversation_id == conversation.id,
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

    try:
        context = _resolve_tawk_context(db, payload=payload)
    except TawkWebhookIgnoredError as exc:
        return TawkWebhookIngestResponse(
            provider="tawk.to",
            event=payload.event,
            event_id=event_id,
            property_id=payload.property.id,
            chat_id=payload.chat.id,
            ignored_events=1,
            reason_code=exc.reason_code,
            transcript_message_count=transcript_message_count,
            received_at=datetime.now(UTC),
        )
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

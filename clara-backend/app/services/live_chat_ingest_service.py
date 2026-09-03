from __future__ import annotations

import hashlib
import hmac
import re
from dataclasses import dataclass
from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.conversation import Conversation
from app.models.message import Message
from app.models.organization import Organization
from app.models.user import User
from app.schemas.live_chat_schema import LiveChatEventPayload, LiveChatIngestResponse
from app.services.lead_service import ensure_conversation_lead

LIVE_CHAT_CHANNEL = "live_chat"
LIVE_CHAT_PROVIDER = "official_api"
LIVE_CHAT_PROVIDER_KEY = "website"
LIVE_CHAT_SOURCE = "website_live_chat"


class LiveChatIngestError(RuntimeError):
    pass


class LiveChatAuthError(LiveChatIngestError):
    pass


@dataclass(frozen=True)
class LiveChatSiteContext:
    site_id: str
    organization: Organization
    sales_user: User


def _site_config(site_id: str) -> dict[str, str]:
    if not settings.live_chat_site_configs:
        raise LiveChatIngestError("LIVE_CHAT_SITE_CONFIGS belum dikonfigurasi.")

    config = settings.live_chat_site_configs.get(site_id)
    if config is None:
        raise LiveChatAuthError("Kredensial live chat tidak valid.")

    required = {"webhook_secret", "organization_slug", "sales_user_email"}
    secret = config.get("webhook_secret", "")
    if (
        required - config.keys()
        or len(secret) < 32
        or secret.casefold().startswith("replace-")
    ):
        raise LiveChatIngestError(
            f"Konfigurasi live chat untuk site `{site_id}` tidak valid."
        )
    return config


def validate_live_chat_signature(
    *,
    body: bytes,
    site_id: str | None,
    timestamp_header: str | None,
    signature_header: str | None,
    now: datetime | None = None,
) -> str:
    normalized_site_id = (site_id or "").strip()
    if not normalized_site_id or not timestamp_header or not signature_header:
        raise LiveChatAuthError("Header autentikasi live chat tidak lengkap.")
    if re.fullmatch(r"[A-Za-z0-9._-]{1,100}", normalized_site_id) is None:
        raise LiveChatAuthError("Kredensial live chat tidak valid.")
    if not timestamp_header.isascii() or not timestamp_header.isdigit():
        raise LiveChatAuthError("Timestamp live chat tidak valid.")

    try:
        timestamp = int(timestamp_header)
    except ValueError as exc:
        raise LiveChatAuthError("Timestamp live chat tidak valid.") from exc

    current_timestamp = int((now or datetime.now(UTC)).timestamp())
    if (
        abs(current_timestamp - timestamp)
        > settings.live_chat_signature_tolerance_seconds
    ):
        raise LiveChatAuthError("Request live chat sudah kedaluwarsa.")

    secret = _site_config(normalized_site_id)["webhook_secret"]
    signed_payload = timestamp_header.encode("ascii") + b"." + body
    expected = (
        "sha256="
        + hmac.new(secret.encode("utf-8"), signed_payload, hashlib.sha256).hexdigest()
    )
    if not hmac.compare_digest(expected, signature_header.strip()):
        raise LiveChatAuthError("Kredensial live chat tidak valid.")
    return normalized_site_id


def resolve_live_chat_site_context(
    db: Session,
    *,
    site_id: str,
) -> LiveChatSiteContext:
    config = _site_config(site_id)
    organization = db.scalar(
        select(Organization).where(
            Organization.slug == config["organization_slug"].strip()
        )
    )
    if organization is None:
        raise LiveChatIngestError("Organization live chat tidak ditemukan.")

    sales_user = db.scalar(
        select(User).where(
            User.organization_id == organization.id,
            User.email == config["sales_user_email"].strip(),
            User.role == "sales",
            User.is_active.is_(True),
        )
    )
    if sales_user is None:
        raise LiveChatIngestError("Sales owner live chat tidak valid.")

    return LiveChatSiteContext(
        site_id=site_id,
        organization=organization,
        sales_user=sales_user,
    )


def _thread_key(site_id: str, external_conversation_id: str) -> str:
    return f"livechat:{site_id}:{external_conversation_id}"


def _message_key(site_id: str, conversation_id: str, message_id: str) -> str:
    digest = hashlib.sha256(
        f"{site_id}|{conversation_id}|{message_id}".encode("utf-8")
    ).hexdigest()
    return f"lcmsg:{digest}"


def _conversation_title(payload: LiveChatEventPayload) -> str:
    conversation = payload.conversation
    if conversation.title and conversation.title.strip():
        return conversation.title.strip()
    if conversation.visitor:
        if conversation.visitor.name and conversation.visitor.name.strip():
            return conversation.visitor.name.strip()
        if conversation.visitor.email and conversation.visitor.email.strip():
            return conversation.visitor.email.strip()
    return "Website Visitor"


def _as_utc(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value.replace(tzinfo=UTC)
    return value.astimezone(UTC)


def _transcript(payload: LiveChatEventPayload) -> str:
    return "\n".join(
        f"[{_as_utc(message.sent_at).isoformat()}] "
        f"{message.sender_name.strip()}: {message.text.strip()}"
        for message in sorted(
            payload.conversation.messages, key=lambda item: item.sent_at
        )
    )


def ingest_live_chat_event(
    db: Session,
    *,
    site_id: str,
    payload: LiveChatEventPayload,
) -> LiveChatIngestResponse:
    context = resolve_live_chat_site_context(db, site_id=site_id)
    messages = sorted(payload.conversation.messages, key=lambda item: item.sent_at)
    external_thread_key = _thread_key(site_id, payload.conversation.id)
    conversation = db.scalar(
        select(Conversation).where(
            Conversation.organization_id == context.organization.id,
            Conversation.provider_key == LIVE_CHAT_PROVIDER_KEY,
            Conversation.external_thread_key == external_thread_key,
        )
    )
    created = conversation is None

    if conversation is None:
        conversation = Conversation(
            organization_id=context.organization.id,
            sales_user_id=context.sales_user.id,
            title=_conversation_title(payload),
            channel=LIVE_CHAT_CHANNEL,
            provider=LIVE_CHAT_PROVIDER,
            provider_key=LIVE_CHAT_PROVIDER_KEY,
            external_thread_id=payload.conversation.id,
            external_thread_key=external_thread_key,
            source=LIVE_CHAT_SOURCE,
            status="api_synced",
            raw_text=_transcript(payload),
            started_at=_as_utc(messages[0].sent_at),
            last_message_at=_as_utc(messages[-1].sent_at),
        )
        db.add(conversation)
        db.flush()
    else:
        conversation.sales_user_id = context.sales_user.id
        conversation.title = _conversation_title(payload)
        conversation.status = "api_synced"
        conversation.raw_text = _transcript(payload)
        conversation.started_at = min(
            _as_utc(conversation.started_at or messages[0].sent_at),
            _as_utc(messages[0].sent_at),
        )
        conversation.last_message_at = max(
            _as_utc(conversation.last_message_at or messages[-1].sent_at),
            _as_utc(messages[-1].sent_at),
        )

    processed_messages = 0
    duplicate_messages = 0
    for message in messages:
        external_message_id = _message_key(site_id, payload.conversation.id, message.id)
        existing = db.scalar(
            select(Message).where(Message.external_message_id == external_message_id)
        )
        if existing is not None:
            duplicate_messages += 1
            continue

        db.add(
            Message(
                conversation_id=conversation.id,
                sender_name=message.sender_name.strip(),
                sender_type=message.sender_type,
                channel=LIVE_CHAT_CHANNEL,
                provider=LIVE_CHAT_PROVIDER,
                external_message_id=external_message_id,
                message_text=message.text.strip(),
                message_timestamp=_as_utc(message.sent_at),
            )
        )
        processed_messages += 1

    db.flush()
    lead = ensure_conversation_lead(
        db=db,
        conversation=conversation,
        preferred_name=_conversation_title(payload),
    )
    lead.assigned_user_id = context.sales_user.id
    lead.last_contact_at = conversation.last_message_at
    db.add(lead)
    db.add(conversation)
    db.commit()

    status = "created" if created else "updated"
    if not created and processed_messages == 0:
        status = "duplicate"
    return LiveChatIngestResponse(
        status=status,
        event_id=payload.event_id,
        conversation_id=conversation.id,
        processed_messages=processed_messages,
        duplicate_messages=duplicate_messages,
        received_at=datetime.now(UTC),
    )

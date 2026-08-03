from __future__ import annotations

import hashlib
import hmac
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Protocol

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.conversation import Conversation
from app.models.message import Message
from app.models.organization import Organization
from app.models.user import User
from app.schemas.webhook_schema import (
    MetaWebhookEnvelope,
    MetaWebhookMessagePayload,
    WhatsAppWebhookIngestResponse,
)
from app.services.business_segmentation_service import normalize_account_category
from app.services.lead_service import ensure_conversation_lead

WHATSAPP_WEBHOOK_SOURCE = "whatsapp_webhook"


class WhatsAppWebhookError(RuntimeError):
    pass


class WhatsAppWebhookAuthError(WhatsAppWebhookError):
    pass


@dataclass(frozen=True)
class ResolvedWebhookContext:
    organization: Organization
    sales_user: User


class WhatsAppWebhookProvider(Protocol):
    provider_key: str

    def verify_handshake(
        self,
        *,
        mode: str | None,
        verify_token: str | None,
        challenge: str | None,
    ) -> str: ...

    def validate_signature(self, *, body: bytes, signature_header: str | None) -> None: ...

    def ingest(
        self,
        db: Session,
        *,
        body: MetaWebhookEnvelope,
    ) -> WhatsAppWebhookIngestResponse: ...


def _require_meta_configuration() -> None:
    if not settings.whatsapp_meta_verify_token:
        raise WhatsAppWebhookError("WHATSAPP_META_VERIFY_TOKEN belum dikonfigurasi.")
    if not settings.whatsapp_meta_app_secret:
        raise WhatsAppWebhookError("WHATSAPP_META_APP_SECRET belum dikonfigurasi.")
    if not settings.whatsapp_meta_default_organization_slug:
        raise WhatsAppWebhookError(
            "WHATSAPP_META_DEFAULT_ORGANIZATION_SLUG belum dikonfigurasi."
        )
    if not settings.whatsapp_meta_default_sales_user_email:
        raise WhatsAppWebhookError(
            "WHATSAPP_META_DEFAULT_SALES_USER_EMAIL belum dikonfigurasi."
        )


def _parse_unix_timestamp(value: str) -> datetime:
    try:
        timestamp = int(value)
    except ValueError as exc:
        raise WhatsAppWebhookError("Timestamp webhook WhatsApp tidak valid.") from exc
    return datetime.fromtimestamp(timestamp, tz=timezone.utc)


def _resolve_webhook_context(db: Session) -> ResolvedWebhookContext:
    _require_meta_configuration()

    organization = db.scalars(
        select(Organization).where(
            Organization.slug == settings.whatsapp_meta_default_organization_slug
        )
    ).first()
    if organization is None:
        raise WhatsAppWebhookError("Organization default webhook WhatsApp tidak ditemukan.")

    sales_user = db.scalars(
        select(User).where(
            User.email == settings.whatsapp_meta_default_sales_user_email,
            User.organization_id == organization.id,
            User.is_active.is_(True),
        )
    ).first()
    if sales_user is None:
        raise WhatsAppWebhookError("User default webhook WhatsApp tidak ditemukan.")

    return ResolvedWebhookContext(organization=organization, sales_user=sales_user)


def _build_external_thread_key(
    *,
    phone_number_id: str | None,
    wa_id: str,
) -> str:
    normalized_phone_number_id = (phone_number_id or "unknown_phone_number").strip()
    normalized_wa_id = wa_id.strip()
    return f"meta:{normalized_phone_number_id}:{normalized_wa_id}"


def _find_or_create_conversation(
    db: Session,
    *,
    context: ResolvedWebhookContext,
    external_thread_key: str,
    display_name: str,
    started_at: datetime,
) -> Conversation:
    conversation = db.scalars(
        select(Conversation).where(
            Conversation.organization_id == context.organization.id,
            Conversation.sales_user_id == context.sales_user.id,
            Conversation.provider_key == "meta",
            Conversation.external_thread_key == external_thread_key,
        )
    ).first()
    if conversation is not None:
        return conversation

    conversation = Conversation(
        organization_id=context.organization.id,
        sales_user_id=context.sales_user.id,
        title=display_name,
        channel="whatsapp",
        provider="official_api",
        provider_key="meta",
        external_thread_id=external_thread_key,
        external_thread_key=external_thread_key,
        source=WHATSAPP_WEBHOOK_SOURCE,
        status="webhook_synced",
        started_at=started_at,
        last_message_at=started_at,
    )
    db.add(conversation)
    db.flush()
    return conversation


def _apply_message_to_conversation(
    db: Session,
    *,
    conversation: Conversation,
    message: MetaWebhookMessagePayload,
    display_name: str,
) -> bool:
    if message.type != "text" or message.text is None:
        return False

    existing_message = db.scalars(
        select(Message).where(
            Message.provider == "official_api",
            Message.channel == "whatsapp",
            Message.external_message_id == message.id,
        )
    ).first()
    if existing_message is not None:
        return False

    message_timestamp = _parse_unix_timestamp(message.timestamp)
    conversation.last_message_at = message_timestamp
    if conversation.started_at is None or message_timestamp < conversation.started_at:
        conversation.started_at = message_timestamp

    db.add(
        Message(
            conversation_id=conversation.id,
            sender_name=display_name,
            sender_type="customer",
            channel="whatsapp",
            provider="official_api",
            external_message_id=message.id,
            message_text=message.text.body.strip(),
            message_timestamp=message_timestamp,
        )
    )
    db.add(conversation)
    return True


class MetaWhatsAppWebhookProvider:
    provider_key = "meta"

    def verify_handshake(
        self,
        *,
        mode: str | None,
        verify_token: str | None,
        challenge: str | None,
    ) -> str:
        _require_meta_configuration()

        if mode != "subscribe":
            raise WhatsAppWebhookAuthError("Webhook mode tidak valid.")
        if not challenge:
            raise WhatsAppWebhookAuthError("Challenge webhook tidak ada.")
        if verify_token != settings.whatsapp_meta_verify_token:
            raise WhatsAppWebhookAuthError("Verify token webhook tidak valid.")

        return challenge

    def validate_signature(self, *, body: bytes, signature_header: str | None) -> None:
        _require_meta_configuration()

        if not signature_header:
            raise WhatsAppWebhookAuthError("Header signature webhook tidak ada.")
        expected_prefix = "sha256="
        if not signature_header.startswith(expected_prefix):
            raise WhatsAppWebhookAuthError("Format signature webhook tidak valid.")

        expected_signature = hmac.new(
            settings.whatsapp_meta_app_secret.encode("utf-8"),
            body,
            hashlib.sha256,
        ).hexdigest()

        provided_signature = signature_header[len(expected_prefix) :].strip()
        if not hmac.compare_digest(expected_signature, provided_signature):
            raise WhatsAppWebhookAuthError("Signature webhook tidak valid.")

    def ingest(
        self,
        db: Session,
        *,
        body: MetaWebhookEnvelope,
    ) -> WhatsAppWebhookIngestResponse:
        context = _resolve_webhook_context(db)
        processed_messages = 0
        duplicate_messages = 0
        ignored_events = 0
        conversation_ids: set = set()

        for entry in body.entry:
            for change in entry.changes:
                if change.field != "messages":
                    ignored_events += 1
                    continue

                phone_number_id = (
                    change.value.metadata.phone_number_id
                    if change.value.metadata is not None
                    else None
                )
                account_category = normalize_account_category(
                    change.value.clara_context.account_category
                    if change.value.clara_context is not None
                    else None
                )

                for message in change.value.messages:
                    if message.type != "text" or message.text is None:
                        ignored_events += 1
                        continue

                    contact = next(
                        (
                            item
                            for item in change.value.contacts
                            if item.wa_id == message.from_
                        ),
                        None,
                    )
                    display_name = (
                        contact.profile.name
                        if contact and contact.profile and contact.profile.name
                        else message.from_
                    )
                    external_thread_key = _build_external_thread_key(
                        phone_number_id=phone_number_id,
                        wa_id=message.from_,
                    )
                    conversation = _find_or_create_conversation(
                        db,
                        context=context,
                        external_thread_key=external_thread_key,
                        display_name=display_name,
                        started_at=_parse_unix_timestamp(message.timestamp),
                    )

                    was_created = _apply_message_to_conversation(
                        db,
                        conversation=conversation,
                        message=message,
                        display_name=display_name,
                    )
                    if not was_created:
                        duplicate_messages += 1
                        continue

                    lead = ensure_conversation_lead(
                        db=db,
                        conversation=conversation,
                        preferred_name=display_name,
                        account_category=account_category,
                    )
                    if account_category != lead.account_category:
                        lead.account_category = account_category
                        db.add(lead)

                    processed_messages += 1
                    conversation_ids.add(conversation.id)

        db.commit()

        return WhatsAppWebhookIngestResponse(
            provider=self.provider_key,
            processed_messages=processed_messages,
            duplicate_messages=duplicate_messages,
            ignored_events=ignored_events,
            conversation_ids=sorted(conversation_ids),
            received_at=datetime.now(timezone.utc),
        )


def get_whatsapp_webhook_provider(provider_key: str) -> WhatsAppWebhookProvider:
    normalized = provider_key.strip().lower()
    if normalized == "meta":
        return MetaWhatsAppWebhookProvider()

    raise WhatsAppWebhookError("Provider webhook WhatsApp tidak didukung.")

from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, Field


class MetaWebhookTextPayload(BaseModel):
    body: str = Field(min_length=1, max_length=5000)


class MetaWebhookMessagePayload(BaseModel):
    id: str = Field(min_length=1, max_length=255)
    from_: str = Field(alias="from", min_length=1, max_length=64)
    timestamp: str = Field(min_length=1, max_length=32)
    type: str = Field(min_length=1, max_length=50)
    text: MetaWebhookTextPayload | None = None


class MetaWebhookContactProfilePayload(BaseModel):
    name: str | None = Field(default=None, max_length=255)


class MetaWebhookContactPayload(BaseModel):
    wa_id: str = Field(min_length=1, max_length=64)
    profile: MetaWebhookContactProfilePayload | None = None


class MetaWebhookMetadataPayload(BaseModel):
    display_phone_number: str | None = Field(default=None, max_length=64)
    phone_number_id: str | None = Field(default=None, max_length=64)


class MetaWebhookClaraContextPayload(BaseModel):
    account_category: str | None = Field(default=None, max_length=20)


class MetaWebhookValuePayload(BaseModel):
    messaging_product: str | None = Field(default=None, max_length=50)
    metadata: MetaWebhookMetadataPayload | None = None
    contacts: list[MetaWebhookContactPayload] = Field(default_factory=list)
    messages: list[MetaWebhookMessagePayload] = Field(default_factory=list)
    clara_context: MetaWebhookClaraContextPayload | None = Field(
        alias="clara_context",
        default=None,
    )


class MetaWebhookChangePayload(BaseModel):
    field: str = Field(min_length=1, max_length=100)
    value: MetaWebhookValuePayload


class MetaWebhookEntryPayload(BaseModel):
    id: str | None = Field(default=None, max_length=100)
    changes: list[MetaWebhookChangePayload] = Field(default_factory=list)


class MetaWebhookEnvelope(BaseModel):
    object: str = Field(min_length=1, max_length=100)
    entry: list[MetaWebhookEntryPayload] = Field(default_factory=list)


class WhatsAppWebhookIngestResponse(BaseModel):
    ok: bool = True
    provider: str
    processed_messages: int
    duplicate_messages: int
    ignored_events: int
    conversation_ids: list[UUID]
    received_at: datetime


class TawkWebhookPropertyPayload(BaseModel):
    id: str = Field(min_length=1, max_length=100)
    name: str | None = Field(default=None, max_length=255)


class TawkWebhookVisitorPayload(BaseModel):
    name: str | None = Field(default=None, max_length=255)
    email: str | None = Field(default=None, max_length=255)
    city: str | None = Field(default=None, max_length=255)
    country: str | None = Field(default=None, max_length=10)


class TawkWebhookSenderPayload(BaseModel):
    t: str | None = Field(default=None, max_length=10)
    n: str | None = Field(default=None, max_length=255)
    id: str | None = Field(default=None, max_length=100)


class TawkWebhookFileAttachmentPayload(BaseModel):
    url: str | None = Field(default=None, max_length=2000)
    name: str | None = Field(default=None, max_length=255)
    mime_type: str | None = Field(default=None, alias="mimeType", max_length=255)
    size: int | None = None
    extension: str | None = Field(default=None, max_length=50)


class TawkWebhookAttachmentContentPayload(BaseModel):
    file: TawkWebhookFileAttachmentPayload | None = None


class TawkWebhookAttachmentPayload(BaseModel):
    type: str | None = Field(default=None, max_length=50)
    content: TawkWebhookAttachmentContentPayload | None = None


class TawkWebhookTranscriptMessagePayload(BaseModel):
    sender: TawkWebhookSenderPayload | None = None
    type: str | None = Field(default=None, max_length=50)
    msg: str | None = None
    time: datetime
    attchs: list[TawkWebhookAttachmentPayload] = Field(default_factory=list)


class TawkWebhookChatPayload(BaseModel):
    id: str = Field(min_length=1, max_length=100)
    visitor: TawkWebhookVisitorPayload | None = None
    messages: list[TawkWebhookTranscriptMessagePayload] = Field(default_factory=list)


class TawkWebhookMessageSenderPayload(BaseModel):
    type: str | None = Field(default=None, max_length=50)


class TawkWebhookMessagePayload(BaseModel):
    text: str | None = None
    type: str | None = Field(default=None, max_length=50)
    sender: TawkWebhookMessageSenderPayload | None = None


class TawkWebhookRequesterPayload(BaseModel):
    name: str | None = Field(default=None, max_length=255)
    email: str | None = Field(default=None, max_length=255)
    type: str | None = Field(default=None, max_length=50)


class TawkWebhookTicketPayload(BaseModel):
    id: str = Field(min_length=1, max_length=100)
    human_id: int | None = Field(default=None, alias="humanId")
    subject: str | None = Field(default=None, max_length=255)
    message: str | None = None


class TawkWebhookEnvelope(BaseModel):
    event: Literal[
        "chat:start",
        "chat:end",
        "chat:transcript_created",
        "ticket:create",
    ]
    time: datetime
    domain: str | None = Field(default=None, max_length=255)
    referrer: str | None = Field(default=None, max_length=2000)
    chat_id: str | None = Field(default=None, alias="chatId", max_length=100)
    message: TawkWebhookMessagePayload | None = None
    visitor: TawkWebhookVisitorPayload | None = None
    requester: TawkWebhookRequesterPayload | None = None
    property: TawkWebhookPropertyPayload
    chat: TawkWebhookChatPayload | None = None
    ticket: TawkWebhookTicketPayload | None = None


class TawkWebhookIngestResponse(BaseModel):
    ok: bool = True
    provider: str
    event: str
    event_id: str | None = None
    property_id: str | None = None
    chat_id: str | None = None
    processed_messages: int = 0
    duplicate_messages: int = 0
    ignored_events: int = 0
    conversation_ids: list[UUID] = Field(default_factory=list)
    transcript_message_count: int = 0
    received_at: datetime

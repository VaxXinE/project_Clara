from datetime import datetime
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

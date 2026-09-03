from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import AwareDatetime, BaseModel, ConfigDict, Field


class LiveChatPayload(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)


class LiveChatVisitorPayload(LiveChatPayload):
    name: str | None = Field(default=None, max_length=255)
    email: str | None = Field(default=None, max_length=255)


class LiveChatMessagePayload(LiveChatPayload):
    id: str = Field(min_length=1, max_length=255)
    sender_type: Literal["customer", "sales"] = Field(alias="senderType")
    sender_name: str = Field(alias="senderName", min_length=1, max_length=255)
    text: str = Field(min_length=1, max_length=5000)
    sent_at: AwareDatetime = Field(alias="sentAt")


class LiveChatConversationPayload(LiveChatPayload):
    id: str = Field(min_length=1, max_length=100)
    title: str | None = Field(default=None, max_length=255)
    visitor: LiveChatVisitorPayload | None = None
    messages: list[LiveChatMessagePayload] = Field(min_length=1, max_length=1000)


class LiveChatEventPayload(LiveChatPayload):
    event: Literal["conversation.upserted"]
    event_id: str = Field(alias="eventId", min_length=1, max_length=128)
    occurred_at: AwareDatetime = Field(alias="occurredAt")
    conversation: LiveChatConversationPayload


class LiveChatIngestResponse(LiveChatPayload):
    ok: bool = True
    status: Literal["created", "updated", "duplicate"]
    event_id: str
    conversation_id: UUID
    processed_messages: int
    duplicate_messages: int
    received_at: datetime

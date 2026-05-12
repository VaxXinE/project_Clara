from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field


class WhatsAppExtensionMessage(BaseModel):
    id: str = Field(min_length=1, max_length=255)
    author: str = Field(min_length=1, max_length=255)
    direction: str = Field(pattern="^(incoming|outgoing)$")
    text: str = Field(min_length=1, max_length=5000)
    timestamp_label: str = Field(alias="timestampLabel", default="", max_length=255)


class WhatsAppExtensionChatSnapshot(BaseModel):
    captured_at: str = Field(alias="capturedAt", min_length=1, max_length=255)
    chat_title: str = Field(alias="chatTitle", min_length=1, max_length=255)
    chat_subtitle: str = Field(alias="chatSubtitle", default="", max_length=255)
    messages: list[WhatsAppExtensionMessage] = Field(default_factory=list)


class WhatsAppExtensionSnapshotSyncRequest(BaseModel):
    chat_data: WhatsAppExtensionChatSnapshot | None = Field(
        alias="chatData",
        default=None,
    )


class WhatsAppExtensionSnapshotSyncResponse(BaseModel):
    ok: bool = True
    status: str
    duplicate: bool = False
    conversation_id: UUID | None = None
    message_count: int = 0
    source: str = "whatsapp_extension"


class WhatsAppExtensionReplySuggestionItem(BaseModel):
    tone: str
    text: str
    reasoning: str


class WhatsAppExtensionReplySuggestionsResponse(BaseModel):
    ok: bool = True
    status: str
    duplicate: bool = False
    cached: bool = False
    conversation_id: UUID
    reply_suggestion_id: UUID
    message_count: int = 0
    source: str = "whatsapp_extension"
    suggestions: list[str] = Field(default_factory=list)
    suggestion_details: list[WhatsAppExtensionReplySuggestionItem] = Field(
        default_factory=list
    )
    risk_level: str | None = None
    action_mode: str | None = None
    next_best_action: str | None = None
    customer_summary: str | None = None

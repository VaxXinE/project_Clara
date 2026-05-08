from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class MarkReplySentRequest(BaseModel):
    sent_by_name: str = Field(default="sales_user", max_length=255)


class SentMessageResponse(BaseModel):
    id: UUID
    conversation_id: UUID
    reply_suggestion_id: UUID | None
    send_mode: str
    message_text: str
    sent_by_name: str
    external_message_id: str | None
    sent_at: datetime
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
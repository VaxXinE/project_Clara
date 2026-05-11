from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class MessageResponse(BaseModel):
    id: UUID
    sender_name: str
    sender_type: str
    message_text: str
    message_timestamp: datetime

    model_config = ConfigDict(from_attributes=True)


class ConversationListItem(BaseModel):
    id: UUID
    organization_id: UUID | None
    sales_user_id: UUID | None
    title: str
    source: str
    status: str
    raw_filename: str | None
    started_at: datetime | None
    last_message_at: datetime | None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ConversationDetail(ConversationListItem):
    messages: list[MessageResponse]

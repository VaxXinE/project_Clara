from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class LeadListItem(BaseModel):
    id: UUID
    organization_id: UUID | None
    assigned_user_id: UUID | None
    display_name: str
    source: str
    current_stage: str
    lead_temperature: str
    summary: str | None
    notes: str | None
    last_contact_at: datetime | None
    next_follow_up_at: datetime | None
    created_at: datetime
    updated_at: datetime
    conversation_count: int
    latest_conversation_id: UUID | None

    model_config = ConfigDict(from_attributes=True)


class LeadDetail(LeadListItem):
    conversation_ids: list[UUID]


class LeadUpdateRequest(BaseModel):
    current_stage: str | None = None
    lead_temperature: str | None = None
    summary: str | None = None
    notes: str | None = None
    next_follow_up_at: datetime | None = None

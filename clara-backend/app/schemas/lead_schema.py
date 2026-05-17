from datetime import date, datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class LeadDealItem(BaseModel):
    id: UUID
    lead_id: UUID
    organization_id: UUID | None
    owner_user_id: UUID | None
    owner_user_name: str | None
    status: str
    currency: str
    expected_value: float
    deposit_amount: float
    expected_close_date: date | None
    closed_at: datetime | None
    notes: str | None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class LeadTaskItem(BaseModel):
    id: UUID
    lead_id: UUID
    organization_id: UUID | None
    assigned_user_id: UUID | None
    assigned_user_name: str | None
    completed_by_user_id: UUID | None
    completed_by_user_name: str | None
    task_type: str
    status: str
    title: str
    description: str | None
    due_at: datetime | None
    completed_at: datetime | None
    last_status_changed_at: datetime
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class LeadTaskEventItem(BaseModel):
    id: UUID
    task_id: UUID
    actor_user_id: UUID | None
    actor_user_name: str | None
    event_type: str
    from_status: str | None
    to_status: str | None
    previous_due_at: datetime | None
    next_due_at: datetime | None
    notes: str | None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class LeadListItem(BaseModel):
    id: UUID
    organization_id: UUID | None
    assigned_user_id: UUID | None
    assigned_user_name: str | None
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
    deal: LeadDealItem | None
    tasks: list[LeadTaskItem]


class LeadUpdateRequest(BaseModel):
    current_stage: str | None = None
    lead_temperature: str | None = None
    summary: str | None = None
    notes: str | None = None
    next_follow_up_at: datetime | None = None
    assigned_user_id: UUID | None = None


class LeadTaskCreateRequest(BaseModel):
    task_type: str = "manual_follow_up"
    title: str
    description: str | None = None
    due_at: datetime | None = None
    assigned_user_id: UUID | None = None


class LeadTaskUpdateRequest(BaseModel):
    status: str | None = None
    title: str | None = None
    description: str | None = None
    due_at: datetime | None = None
    assigned_user_id: UUID | None = None
    notes: str | None = None


class LeadDealUpsertRequest(BaseModel):
    status: str | None = None
    currency: str | None = None
    expected_value: float | None = None
    deposit_amount: float | None = None
    expected_close_date: date | None = None
    closed_at: datetime | None = None
    notes: str | None = None

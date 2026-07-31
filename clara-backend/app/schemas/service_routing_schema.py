from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class SupportArticleCreate(BaseModel):
    organization_id: UUID | None = None
    title: str = Field(min_length=1, max_length=200)
    topic: str = Field(max_length=50)
    support_level: str = Field(pattern="^(LEVEL_0|LEVEL_1|HUMAN_REQUIRED)$")
    content: str = Field(min_length=1, max_length=50000)
    customer_safe: bool = False
    source: str = Field(max_length=50)
    source_reference: str = Field(max_length=500)
    risk_class: str = Field(default="LOW", pattern="^(LOW|MEDIUM|HIGH)$")


class SupportArticleResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    organization_id: UUID | None
    title: str
    topic: str
    support_level: str
    customer_safe: bool
    lifecycle_status: str
    source: str
    source_reference: str
    source_hash: str
    version: int
    effective_from: datetime | None
    effective_until: datetime | None
    last_verified_at: datetime | None
    risk_class: str
    created_at: datetime
    updated_at: datetime


class ComplaintCaseResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    organization_id: UUID | None
    customer_profile_id: UUID | None
    conversation_id: UUID
    lead_id: UUID | None
    source_channel: str | None
    category: str
    severity: str
    status: str
    safe_summary: str
    requested_outcome: str | None
    assigned_user_id: UUID | None
    reviewer_requirement: str
    first_seen_at: datetime
    last_seen_at: datetime
    resolved_at: datetime | None
    closed_at: datetime | None
    version: int


class ComplaintTransitionRequest(BaseModel):
    expected_version: int = Field(gt=0)
    reason_codes: list[str] = Field(min_length=1, max_length=10)


class ComplaintAssignRequest(BaseModel):
    expected_version: int = Field(gt=0)
    assigned_user_id: UUID

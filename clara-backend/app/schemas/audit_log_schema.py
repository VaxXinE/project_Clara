from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class AuditLogResponse(BaseModel):
    id: UUID
    organization_id: str | None
    actor_user_id: str | None
    actor_email: str | None
    actor_role: str | None
    action: str
    resource_type: str
    resource_id: str | None
    ip_address: str | None
    user_agent: str | None
    metadata_json: dict
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ReplySuggestionHealthTopFailure(BaseModel):
    action: str
    count: int


class ReplySuggestionHealthSummaryResponse(BaseModel):
    organization_id: str | None
    window_hours: int
    generated_total: int
    generated_success: int
    generated_failed: int
    extension_generated_total: int
    extension_generated_success: int
    extension_generated_failed: int
    cached_hits: int
    duplicate_snapshot_hits: int
    send_success: int
    send_failed: int
    latest_success_at: datetime | None
    latest_failure_at: datetime | None
    top_failures: list[ReplySuggestionHealthTopFailure]

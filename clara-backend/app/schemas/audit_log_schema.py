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

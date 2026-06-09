from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class SalesUnitResponse(BaseModel):
    id: UUID
    organization_id: UUID
    organization_name: str | None = None
    name: str
    code: str
    created_at: datetime
    team_count: int = 0
    model_config = ConfigDict(from_attributes=True)


class CreateSalesUnitRequest(BaseModel):
    organization_id: UUID | None = None
    name: str = Field(min_length=1, max_length=255)
    code: str = Field(min_length=1, max_length=100)


class UpdateSalesUnitRequest(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    code: str | None = Field(default=None, min_length=1, max_length=100)


class SalesTeamResponse(BaseModel):
    id: UUID
    organization_id: UUID
    organization_name: str | None = None
    unit_id: UUID | None
    unit_name: str | None = None
    manager_user_id: UUID | None
    manager_user_name: str | None = None
    name: str
    code: str
    created_at: datetime
    member_count: int = 0
    model_config = ConfigDict(from_attributes=True)


class CreateSalesTeamRequest(BaseModel):
    organization_id: UUID | None = None
    unit_id: UUID | None = None
    manager_user_id: UUID | None = None
    name: str = Field(min_length=1, max_length=255)
    code: str = Field(min_length=1, max_length=100)


class UpdateSalesTeamRequest(BaseModel):
    unit_id: UUID | None = None
    manager_user_id: UUID | None = None
    name: str | None = Field(default=None, min_length=1, max_length=255)
    code: str | None = Field(default=None, min_length=1, max_length=100)

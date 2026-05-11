from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class ProductKnowledgeCreateRequest(BaseModel):
    title: str = Field(min_length=1, max_length=255)
    category: str = Field(default="general", min_length=1, max_length=100)
    content: str = Field(min_length=1, max_length=5000)
    source_type: str = Field(default="manual_note", min_length=1, max_length=50)
    is_active: bool = True


class ProductKnowledgeUpdateRequest(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=255)
    category: str | None = Field(default=None, min_length=1, max_length=100)
    content: str | None = Field(default=None, min_length=1, max_length=5000)
    source_type: str | None = Field(default=None, min_length=1, max_length=50)
    is_active: bool | None = None


class ProductKnowledgeResponse(BaseModel):
    id: UUID
    organization_id: UUID
    title: str
    category: str
    content: str
    source_type: str
    is_active: bool
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)

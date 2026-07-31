from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


AIPersonaVariant = Literal["mini", "reguler"]
AIPersonaSectionKey = Literal[
    "instruction",
    "guardrail",
    "flow",
    "personality_mode",
    "auto_adapt",
]
AIPersonaVersionStatus = Literal["draft", "published", "archived"]


class AIPersonaDraftCreateRequest(BaseModel):
    content: str = Field(min_length=1, max_length=20_000)


class AIPersonaConfigVersionResponse(BaseModel):
    id: UUID
    variant: AIPersonaVariant
    section_key: AIPersonaSectionKey
    version_number: int
    status: AIPersonaVersionStatus
    content: str
    content_sha256: str
    created_by_user_id: UUID | None
    published_by_user_id: UUID | None
    source_version_id: UUID | None
    created_at: datetime
    published_at: datetime | None

    model_config = ConfigDict(from_attributes=True)


class AIPersonaEffectiveSectionResponse(BaseModel):
    variant: AIPersonaVariant
    section_key: AIPersonaSectionKey
    content: str
    source: Literal["database", "markdown"]
    version_id: UUID | None
    version_number: int | None

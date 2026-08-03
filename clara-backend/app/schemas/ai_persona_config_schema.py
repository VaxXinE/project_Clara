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
AIPersonaBundleStatus = Literal[
    "draft", "validated", "published", "archived", "rejected"
]


class AIPersonaDraftCreateRequest(BaseModel):
    content: str = Field(min_length=1, max_length=50_000)


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


class AIPersonaBundleCreateRequest(BaseModel):
    variant: Literal["mini"] = "mini"
    section_version_ids: dict[AIPersonaSectionKey, UUID] = Field(default_factory=dict)


class AIPersonaBundleSectionUpdateRequest(BaseModel):
    persona_config_version_id: UUID


class AIPersonaBundlePublishRequest(BaseModel):
    expected_current_bundle_hash: str | None = Field(
        default=None, pattern=r"^[a-f0-9]{64}$"
    )
    acknowledged_warning_codes: list[str] = Field(default_factory=list, max_length=100)


class AIPersonaBundleArchiveRequest(BaseModel):
    disposition: Literal["archived", "rejected"]


class AIPersonaBundleSectionResponse(BaseModel):
    id: UUID
    section_key: AIPersonaSectionKey
    persona_config_version_id: UUID
    position: int
    content_sha256: str
    character_count: int
    source_type: str
    source_identifier: str | None
    version_number: int
    content: str
    published_at: datetime | None


class AIPersonaBundleResponse(BaseModel):
    id: UUID
    variant: AIPersonaVariant
    bundle_version: int
    status: AIPersonaBundleStatus
    bundle_sha256: str | None
    source_type: str
    source_bundle_id: UUID | None
    validation_status: Literal["pending", "valid", "invalid"]
    validation_report: dict
    validation_report_hash: str | None
    validation_contract_version: str | None
    created_by_user_id: UUID | None
    validated_by_user_id: UUID | None
    published_by_user_id: UUID | None
    created_at: datetime
    validated_at: datetime | None
    published_at: datetime | None
    archived_at: datetime | None
    sections: list[AIPersonaBundleSectionResponse]


class AIPersonaBundleValidationResponse(BaseModel):
    bundle_id: UUID
    variant: AIPersonaVariant
    complete: bool
    section_results: list[dict]
    blocking_errors: list[dict]
    warnings: list[dict]
    bundle_hash: str
    current_effective_bundle_hash: str | None
    changed_section_keys: list[AIPersonaSectionKey]
    unchanged_section_keys: list[AIPersonaSectionKey]
    validation_contract_version: str
    validation_report_hash: str
    validated_at: datetime


class AIPersonaBundlePreviewResponse(BaseModel):
    bundle: AIPersonaBundleResponse
    runtime_order: list[AIPersonaSectionKey]
    roadmap_review_order: list[AIPersonaSectionKey]
    current_effective_bundle_id: UUID | None
    current_effective_bundle_hash: str | None
    current_persona_authority_mode: str
    legacy_overlay_present: bool
    fallback_reason: str | None
    supporting_knowledge_count: int
    response_example_count: int
    authority_boundaries: dict[str, str]


class AIPersonaBundleDiffRequest(BaseModel):
    old_bundle_id: UUID | None = None
    new_bundle_id: UUID


class AIPersonaBundleDiffResponse(BaseModel):
    old_bundle_id: UUID | None
    new_bundle_id: UUID
    old_bundle_hash: str | None
    new_bundle_hash: str | None
    changed_section_keys: list[AIPersonaSectionKey]
    sections: list[dict]
    truncated: bool


class AIPersonaBundleEffectiveResponse(BaseModel):
    bundle: AIPersonaBundleResponse | None
    effective_source: str
    fallback_reason: str | None
    persona_authority_mode: str
    legacy_overlay_present: bool

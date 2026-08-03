from typing import Literal
from uuid import UUID

from pydantic import BaseModel, Field, field_validator, model_validator


def _safe_reason_codes(values: list[str]) -> list[str]:
    if any(not value or len(value) > 64 or not value.replace("_", "").isalnum() for value in values):
        raise ValueError("Reason codes must contain only letters, numbers, and underscores.")
    return sorted(set(values))


class RolloutPlanCreateRequest(BaseModel):
    name: str = Field(min_length=1, max_length=150)
    candidate_bundle_id: UUID
    candidate_profile: dict
    cohort_seed: str = Field(min_length=8, max_length=128)
    shadow_sample_percentage: int = Field(default=0, ge=0, le=100)
    daily_shadow_limit: int = Field(default=0, ge=0, le=10000)
    promotion_thresholds: dict[str, float] = Field(default_factory=dict)
    required_sample_size: int = Field(default=0, ge=0, le=100000)


class VersionedRequest(BaseModel):
    expected_version: int = Field(ge=1)
    reason_codes: list[str] = Field(default_factory=list, max_length=20)

    _validate_reason_codes = field_validator("reason_codes")(_safe_reason_codes)


class PromoteRequest(VersionedRequest):
    target_stage: Literal[
        "SHADOW", "REVIEWER_CANARY_10", "REVIEWER_CANARY_30", "SEMI_AUTOMATIC_100"
    ]


class IncidentResolutionRequest(BaseModel):
    resolution_note: str = Field(min_length=1, max_length=500)


class QualityLabelRequest(BaseModel):
    outcome: Literal["APPROVED", "REJECTED"]
    reason_codes: list[str] = Field(default_factory=list, max_length=20)
    escalation_expected: bool | None = None
    escalation_selected: bool | None = None
    customer_movement: Literal["POSITIVE", "NEUTRAL", "NEGATIVE", "UNKNOWN"] | None = None

    _validate_reason_codes = field_validator("reason_codes")(_safe_reason_codes)

    @model_validator(mode="after")
    def validate_escalation_pair(self):
        if (self.escalation_expected is None) != (self.escalation_selected is None):
            raise ValueError("Escalation expected and selected labels must be submitted together.")
        return self

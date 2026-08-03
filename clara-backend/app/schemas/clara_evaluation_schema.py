from typing import Literal
from uuid import UUID

from pydantic import BaseModel, Field, field_validator


class EvaluationRunCreateRequest(BaseModel):
    persona_bundle_id: UUID
    configuration_profile: Literal[
        "PRODUCTION_BASELINE", "GOVERNED_OFFLINE_SIMULATION"
    ] = "GOVERNED_OFFLINE_SIMULATION"


class EvaluationExecuteRequest(BaseModel):
    fixture_mode: bool = True
    outputs_by_mode: dict[str, dict[str, dict]] | None = None

    @field_validator("outputs_by_mode")
    @classmethod
    def external_outputs_require_payload(cls, value, info):
        if info.data.get("fixture_mode") is False and not value:
            raise ValueError("outputs_by_mode is required outside fixture mode")
        return value


class HumanReviewRequest(BaseModel):
    scores: dict[str, int]
    hard_fail: bool = False
    reason_codes: list[str] = Field(default_factory=list, max_length=20)
    safe_note: str | None = Field(default=None, max_length=500)


class ReconcileReviewRequest(BaseModel):
    reconciled_scores: dict[str, int]


class CertificationDecisionRequest(BaseModel):
    decision: Literal["CERTIFY", "REJECT"]

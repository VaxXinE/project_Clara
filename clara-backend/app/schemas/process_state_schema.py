from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field

from app.core.clara_runtime_contract import ProcessState


class ProcessStateEventItem(BaseModel):
    id: UUID
    previous_state: str
    proposed_state: str
    applied_state: str
    decision: str
    transition_type: str
    source_type: str
    evidence_codes: list[str]
    confidence_score: float
    source_trust_level: str
    actor_user_id: UUID | None
    reason_codes: list[str]
    created_at: datetime


class CustomerProcessStateItem(BaseModel):
    customer_profile_id: UUID
    current_state: str
    state_rank: int
    confidence_score: float
    source_type: str
    source_trust_level: str
    version: int
    manual_lock: bool
    last_confirmed_at: datetime | None
    last_transition_at: datetime | None
    reconciliation_required: bool = False


class ProcessStateTransitionRequest(BaseModel):
    proposed_state: ProcessState
    expected_version: int = Field(ge=1)
    reason_code: str = Field(
        min_length=1,
        max_length=100,
        pattern=r"^[A-Z][A-Z0-9_]*$",
    )


class ProcessStateTransitionResponse(BaseModel):
    current: CustomerProcessStateItem
    decision: str
    reason_codes: list[str]
    decision_hash: str


class ReconciliationRequiredItem(BaseModel):
    customer_profile_id: UUID
    customer_display_name: str
    current_state: str
    event_id: UUID
    reason_codes: list[str]
    created_at: datetime

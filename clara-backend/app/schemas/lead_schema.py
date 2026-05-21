from datetime import date, datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class LeadDealItem(BaseModel):
    id: UUID
    lead_id: UUID
    organization_id: UUID | None
    owner_user_id: UUID | None
    owner_user_name: str | None
    status: str
    currency: str
    expected_value: float
    deposit_amount: float
    expected_close_date: date | None
    closed_at: datetime | None
    notes: str | None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class LeadTaskItem(BaseModel):
    id: UUID
    lead_id: UUID
    organization_id: UUID | None
    assigned_user_id: UUID | None
    assigned_user_name: str | None
    completed_by_user_id: UUID | None
    completed_by_user_name: str | None
    task_type: str
    status: str
    title: str
    description: str | None
    due_at: datetime | None
    completed_at: datetime | None
    last_status_changed_at: datetime
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class LeadTaskEventItem(BaseModel):
    id: UUID
    task_id: UUID
    actor_user_id: UUID | None
    actor_user_name: str | None
    event_type: str
    from_status: str | None
    to_status: str | None
    previous_due_at: datetime | None
    next_due_at: datetime | None
    notes: str | None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class LeadActivityEventItem(BaseModel):
    id: UUID
    lead_id: UUID
    organization_id: UUID | None
    actor_user_id: UUID | None
    actor_user_name: str | None
    event_type: str
    title: str
    description: str | None
    from_value: str | None
    to_value: str | None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class LeadDisciplineLogItem(BaseModel):
    id: UUID
    lead_id: UUID
    organization_id: UUID | None
    actor_user_id: UUID | None
    actor_user_name: str | None
    log_date: date
    activity_type: str
    result_status: str
    main_objection: str | None
    customer_mood: str | None
    notes: str | None
    next_follow_up_at: datetime | None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class LeadDisciplineSummaryItem(BaseModel):
    latest_log_date: date | None
    latest_activity_type: str | None
    latest_result_status: str | None
    log_count: int
    logs_today_count: int
    days_since_latest_log: int | None
    compliance_status: str


class CustomerRelatedLeadItem(BaseModel):
    id: UUID
    display_name: str
    source_channel: str
    source_label: str
    current_stage: str
    lead_temperature: str
    last_contact_at: datetime | None
    latest_conversation_id: UUID | None


class CustomerMergeCandidateItem(BaseModel):
    id: UUID
    display_name: str
    canonical_key: str
    identity_confidence: float
    match_strategy: str
    match_score: float
    overlap_reason: str
    lead_count: int
    conversation_count: int
    source_labels: list[str]
    last_contact_at: datetime | None


class CustomerProfileSummaryItem(BaseModel):
    id: UUID
    organization_id: UUID | None
    assigned_user_id: UUID | None
    assigned_user_name: str | None
    display_name: str
    canonical_key: str
    identity_confidence: float
    match_strategy: str
    merge_notes: str | None
    merged_into_profile_id: UUID | None
    lead_count: int
    conversation_count: int
    source_channels: list[str]
    source_labels: list[str]
    last_contact_at: datetime | None
    created_at: datetime
    updated_at: datetime
    merge_candidates: list[CustomerMergeCandidateItem] = []
    related_leads: list[CustomerRelatedLeadItem]


class CustomerProfileMergeRequest(BaseModel):
    source_profile_id: UUID
    target_profile_id: UUID
    merge_notes: str | None = None


class LeadListItem(BaseModel):
    id: UUID
    organization_id: UUID | None
    assigned_user_id: UUID | None
    assigned_user_name: str | None
    customer_profile_id: UUID | None
    customer_profile_name: str | None
    display_name: str
    source: str
    source_channel: str
    source_label: str
    account_category: str
    current_stage: str
    lead_temperature: str
    summary: str | None
    notes: str | None
    last_contact_at: datetime | None
    next_follow_up_at: datetime | None
    created_at: datetime
    updated_at: datetime
    conversation_count: int
    latest_conversation_id: UUID | None

    model_config = ConfigDict(from_attributes=True)


class LeadDetail(LeadListItem):
    conversation_ids: list[UUID]
    customer_profile: CustomerProfileSummaryItem | None
    deal: LeadDealItem | None
    tasks: list[LeadTaskItem]
    timeline: list[LeadActivityEventItem]
    discipline_summary: LeadDisciplineSummaryItem
    discipline_logs: list[LeadDisciplineLogItem]


class LeadUpdateRequest(BaseModel):
    account_category: str | None = None
    current_stage: str | None = None
    lead_temperature: str | None = None
    summary: str | None = None
    notes: str | None = None
    next_follow_up_at: datetime | None = None
    assigned_user_id: UUID | None = None


class LeadTaskCreateRequest(BaseModel):
    task_type: str = "manual_follow_up"
    title: str
    description: str | None = None
    due_at: datetime | None = None
    assigned_user_id: UUID | None = None


class LeadTaskUpdateRequest(BaseModel):
    status: str | None = None
    title: str | None = None
    description: str | None = None
    due_at: datetime | None = None
    assigned_user_id: UUID | None = None
    notes: str | None = None


class LeadQueueActionRequest(BaseModel):
    action: str
    duration: str | None = None
    reason_tag: str
    reason_note: str | None = None


class LeadDealUpsertRequest(BaseModel):
    status: str | None = None
    currency: str | None = None
    expected_value: float | None = None
    deposit_amount: float | None = None
    expected_close_date: date | None = None
    closed_at: datetime | None = None
    notes: str | None = None


class LeadDisciplineLogCreateRequest(BaseModel):
    log_date: date | None = None
    activity_type: str
    result_status: str
    main_objection: str | None = None
    customer_mood: str | None = None
    notes: str | None = None
    next_follow_up_at: datetime | None = None


class LeadDisciplineLogUpdateRequest(BaseModel):
    log_date: date | None = None
    activity_type: str | None = None
    result_status: str | None = None
    main_objection: str | None = None
    customer_mood: str | None = None
    notes: str | None = None
    next_follow_up_at: datetime | None = None


class LeadDisciplineSuggestionResponse(BaseModel):
    activity_type: str
    result_status: str
    main_objection: str | None
    customer_mood: str | None
    notes: str
    next_follow_up_at: datetime | None
    confidence_score: float
    source_summary: str

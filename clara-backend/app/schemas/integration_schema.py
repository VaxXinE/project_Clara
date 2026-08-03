from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

from app.schemas.ai_extraction_schema import AIExtractionCreate
from app.schemas.dashboard_schema import (
    ExecutiveRecommendationItem,
    KpiAlertItem,
    KpiSummaryCard,
    MarketingExecutionSummary,
    OrganizationPerformanceRow,
    SalesPerformanceRow,
    SourcePerformanceRow,
)
from app.schemas.reply_suggestion_schema import SuggestedReply


class IntegrationMessageInput(BaseModel):
    sender_type: Literal["customer", "sales", "system"] = "customer"
    sender_name: str = Field(min_length=1, max_length=255)
    message_text: str = Field(min_length=1, max_length=4000)
    message_timestamp: datetime | None = None


class SGCCConversationAnalysisRequest(BaseModel):
    external_conversation_id: str | None = Field(default=None, max_length=255)
    source_channel: Literal["whatsapp", "telegram", "other"] = "whatsapp"
    customer_name: str | None = Field(default=None, max_length=255)
    sales_name: str | None = Field(default=None, max_length=255)
    account_category: str | None = Field(default=None, max_length=100)
    extra_context: str | None = Field(default=None, max_length=2000)
    messages: list[IntegrationMessageInput] = Field(min_length=1, max_length=120)


class SGCCConversationAnalysisResponse(BaseModel):
    provider: Literal["clara"] = "clara"
    integration_client: Literal["sgcc"] = "sgcc"
    model_name: str
    schema_version: str = "v1"
    analysis: AIExtractionCreate


class SGCCReplySuggestionRequest(SGCCConversationAnalysisRequest):
    analysis: AIExtractionCreate | None = None
    knowledge_snippets: list[str] = Field(default_factory=list, max_length=20)


class SGCCReplySuggestionResponse(BaseModel):
    provider: Literal["clara"] = "clara"
    integration_client: Literal["sgcc"] = "sgcc"
    model_name: str
    schema_version: str = "v1"
    analysis: AIExtractionCreate
    action_mode: str
    policy_reasons: list[str]
    suggested_replies: list[SuggestedReply]


class SGCCInsightConversationInput(BaseModel):
    external_conversation_id: str | None = Field(default=None, max_length=255)
    source_channel: Literal["whatsapp", "telegram", "other"] = "whatsapp"
    customer_name: str | None = Field(default=None, max_length=255)
    sales_name: str | None = Field(default=None, max_length=255)
    account_category: str | None = Field(default=None, max_length=100)
    analysis: AIExtractionCreate


class SGCCObjectionInsightsRequest(BaseModel):
    period_label: str | None = Field(default=None, max_length=120)
    conversations: list[SGCCInsightConversationInput] = Field(
        min_length=1,
        max_length=200,
    )


class SGCCObjectionInsightItem(BaseModel):
    topic: str
    count: int


class SGCCContentRecommendationItem(BaseModel):
    title: str
    rationale: str
    suggested_format: str
    priority: str


class SGCCObjectionInsightsResponse(BaseModel):
    provider: Literal["clara"] = "clara"
    integration_client: Literal["sgcc"] = "sgcc"
    schema_version: str = "v1"
    period_label: str | None = None
    total_conversations: int
    top_objections: list[SGCCObjectionInsightItem]
    risk_level_breakdown: dict[str, int]
    sentiment_breakdown: dict[str, int]
    lead_temperature_breakdown: dict[str, int]
    pipeline_stage_breakdown: dict[str, int]
    content_recommendations: list[SGCCContentRecommendationItem]


class SGCCFollowUpRecommendationRequest(SGCCConversationAnalysisRequest):
    analysis: AIExtractionCreate | None = None
    current_stage: str | None = Field(default=None, max_length=120)
    next_follow_up_at: datetime | None = None
    last_contact_at: datetime | None = None


class SGCCFollowUpRecommendationResponse(BaseModel):
    provider: Literal["clara"] = "clara"
    integration_client: Literal["sgcc"] = "sgcc"
    model_name: str
    schema_version: str = "v1"
    analysis: AIExtractionCreate
    action_mode: str
    policy_reasons: list[str]
    priority_score: int
    urgency_level: Literal["low", "medium", "high", "critical"]
    task_type: str
    reason: str
    recommended_action: str
    suggested_next_follow_up_at: datetime


class SGCCIdentityProfileInput(BaseModel):
    external_customer_id: str | None = Field(default=None, max_length=255)
    display_name: str = Field(min_length=1, max_length=255)
    phone_number: str | None = Field(default=None, max_length=50)
    email: str | None = Field(default=None, max_length=255)
    source_channel: Literal["whatsapp", "telegram", "other"] = "other"
    assigned_user_name: str | None = Field(default=None, max_length=255)


class SGCCIdentityMatchCandidateItem(BaseModel):
    external_customer_id: str | None = None
    display_name: str
    canonical_key: str
    identity_confidence: float
    match_strategy: str
    match_score: float
    overlap_reason: str
    shared_signals: list[str]
    source_channel: str


class SGCCCustomerIdentityMatchRequest(BaseModel):
    primary_profile: SGCCIdentityProfileInput
    candidate_profiles: list[SGCCIdentityProfileInput] = Field(
        min_length=1,
        max_length=100,
    )
    match_threshold: float = Field(default=0.45, ge=0, le=1)


class SGCCCustomerIdentityMatchResponse(BaseModel):
    provider: Literal["clara"] = "clara"
    integration_client: Literal["sgcc"] = "sgcc"
    schema_version: str = "v1"
    primary_profile: SGCCIdentityMatchCandidateItem
    recommended_match: SGCCIdentityMatchCandidateItem | None
    match_candidates: list[SGCCIdentityMatchCandidateItem]
    should_merge: bool
    merge_reason: str


class SGCCKpiEnrichmentRequest(BaseModel):
    period_label: str | None = Field(default=None, max_length=120)
    source_channel: str | None = Field(default=None, max_length=50)
    summary: KpiSummaryCard
    marketing_execution_summary: MarketingExecutionSummary
    sales_performance: list[SalesPerformanceRow] = Field(default_factory=list, max_length=100)
    organization_performance: list[OrganizationPerformanceRow] = Field(
        default_factory=list,
        max_length=100,
    )
    source_performance: list[SourcePerformanceRow] = Field(default_factory=list, max_length=100)


class SGCCKpiEnrichmentResponse(BaseModel):
    provider: Literal["clara"] = "clara"
    integration_client: Literal["sgcc"] = "sgcc"
    schema_version: str = "v1"
    period_label: str | None = None
    source_channel: str | None = None
    health_status: Literal["healthy", "attention", "critical"]
    key_observations: list[str]
    alerts: list[KpiAlertItem]
    recommendations: list[ExecutiveRecommendationItem]
    top_priorities: list[str]

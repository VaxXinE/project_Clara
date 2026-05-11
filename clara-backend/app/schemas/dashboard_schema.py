from __future__ import annotations

from datetime import date, datetime
from uuid import UUID

from pydantic import BaseModel


class DashboardLatestMessage(BaseModel):
    sender_name: str
    sender_type: str
    message_text: str
    message_timestamp: datetime


class DashboardAIExtractionSummary(BaseModel):
    id: UUID
    lead_temperature: str
    pipeline_stage: str
    buying_intent: str
    sentiment: str
    risk_level: str
    main_objections: list[str]
    next_best_action: str
    confidence_score: float
    created_at: datetime


class DashboardReplySuggestionSummary(BaseModel):
    id: UUID
    action_mode: str
    approval_status: str
    risk_level: str
    suggested_replies: list[dict]
    policy_reasons: list[str]
    created_at: datetime


class DashboardSentMessageSummary(BaseModel):
    id: UUID
    reply_suggestion_id: UUID | None
    send_mode: str
    message_text: str
    sent_by_name: str
    sent_at: datetime


class SalesInboxItem(BaseModel):
    conversation_id: UUID
    organization_id: UUID | None
    title: str
    source: str
    status: str
    started_at: datetime | None
    last_message_at: datetime | None
    created_at: datetime
    sales_user_id: UUID | None
    latest_message: DashboardLatestMessage | None
    latest_ai_extraction: DashboardAIExtractionSummary | None
    latest_reply_suggestion: DashboardReplySuggestionSummary | None
    latest_sent_message: DashboardSentMessageSummary | None

    ui_status: str
    priority_score: int


class SalesConversationDetail(BaseModel):
    conversation_id: UUID
    organization_id: UUID | None
    title: str
    source: str
    status: str
    started_at: datetime | None
    last_message_at: datetime | None
    sales_user_id: UUID | None
    messages: list[dict]
    latest_ai_extraction: DashboardAIExtractionSummary | None
    latest_reply_suggestion: DashboardReplySuggestionSummary | None
    sent_messages: list[DashboardSentMessageSummary]


class MarketingObjectionInsight(BaseModel):
    topic: str
    count: int


class MarketingBreakdownItem(BaseModel):
    label: str
    count: int


class MarketingContentRecommendation(BaseModel):
    title: str
    rationale: str
    suggested_format: str
    priority: str


class MarketingKpiSummary(BaseModel):
    reply_sent_rate: float
    analysis_coverage_rate: float
    approved_reply_rate: float
    high_risk_conversation_count: int


class MarketingInsightsPreview(BaseModel):
    total_conversations: int
    total_analyzed_conversations: int
    top_objections: list[MarketingObjectionInsight]
    lead_temperature_breakdown: dict[str, int]
    risk_level_breakdown: dict[str, int]
    buying_intent_breakdown: list[MarketingBreakdownItem]
    sentiment_breakdown: list[MarketingBreakdownItem]
    pipeline_stage_breakdown: list[MarketingBreakdownItem]
    top_content_recommendations: list[MarketingContentRecommendation]
    kpi_summary: MarketingKpiSummary
    generated_at: datetime


class MarketingInsightSnapshotComparison(BaseModel):
    conversation_delta: int
    analyzed_delta: int
    reply_sent_rate_delta: float
    approved_reply_rate_delta: float


class MarketingInsightSnapshotResponse(BaseModel):
    id: UUID
    organization_id: UUID | None
    scope_type: str
    snapshot_type: str
    period_start: datetime | date
    period_end: datetime | date
    total_conversations: int
    total_analyzed_conversations: int
    top_objections: list[dict]
    top_content_recommendations: list[dict]
    kpi_summary: MarketingKpiSummary
    generated_at: datetime
    created_at: datetime
    comparison: MarketingInsightSnapshotComparison | None


class OpsTableCountItem(BaseModel):
    label: str
    count: int


class OpsUserRow(BaseModel):
    id: UUID
    organization_id: UUID | None
    created_by_user_id: UUID | None
    created_by_user_name: str | None
    name: str
    email: str
    role: str
    is_active: bool
    created_at: datetime


class OpsOrganizationRow(BaseModel):
    id: UUID
    name: str
    slug: str
    created_at: datetime


class OpsConversationRow(BaseModel):
    id: UUID
    organization_id: UUID | None
    sales_user_id: UUID | None
    sales_owner_name: str | None
    title: str
    source: str
    status: str
    raw_filename: str | None
    last_message_at: datetime | None
    created_at: datetime


class OpsAuditLogRow(BaseModel):
    id: UUID
    organization_id: str | None
    actor_email: str | None
    actor_role: str | None
    action: str
    resource_type: str
    resource_id: str | None
    created_at: datetime


class OpsProductKnowledgeRow(BaseModel):
    id: UUID
    organization_id: UUID
    title: str
    category: str
    source_type: str
    is_active: bool
    updated_at: datetime


class OpsSnapshotRow(BaseModel):
    id: UUID
    organization_id: UUID | None
    scope_type: str
    snapshot_type: str
    period_start: date
    period_end: date
    total_conversations: int
    total_analyzed_conversations: int
    created_at: datetime


class OpsDatabaseOverviewResponse(BaseModel):
    scope_type: str
    organization_id: UUID | None
    table_counts: list[OpsTableCountItem]
    recent_users: list[OpsUserRow]
    recent_organizations: list[OpsOrganizationRow]
    recent_conversations: list[OpsConversationRow]
    recent_audit_logs: list[OpsAuditLogRow]
    recent_product_knowledge: list[OpsProductKnowledgeRow]
    recent_snapshots: list[OpsSnapshotRow]

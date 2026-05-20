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
    source_channel: str
    source_label: str
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
    source_channel: str
    source_label: str
    status: str
    started_at: datetime | None
    last_message_at: datetime | None
    sales_user_id: UUID | None
    messages: list[dict]
    latest_ai_extraction: DashboardAIExtractionSummary | None
    latest_reply_suggestion: DashboardReplySuggestionSummary | None
    sent_messages: list[DashboardSentMessageSummary]


class SalesWorklistItem(BaseModel):
    task_id: UUID | None
    lead_id: UUID
    conversation_id: UUID | None
    lead_name: str
    assigned_user_name: str | None
    current_stage: str
    lead_temperature: str
    priority_score: int
    task_type: str
    task_status: str | None
    task_label: str
    reason: str
    recommended_action: str
    last_contact_at: datetime | None
    next_follow_up_at: datetime | None


class SalesWorklistResponse(BaseModel):
    generated_at: datetime
    overdue_count: int
    hot_lead_count: int
    ready_to_send_count: int
    pending_analysis_count: int
    snoozed_count: int
    completed_today_count: int
    due_today_count: int
    overdue_24h_count: int
    overdue_72h_count: int
    open_task_count: int
    completion_rate_today: float
    items: list[SalesWorklistItem]


class SalesApprovalQueueItem(BaseModel):
    reply_suggestion_id: UUID
    conversation_id: UUID
    lead_id: UUID | None
    lead_name: str
    conversation_title: str
    current_stage: str
    lead_temperature: str
    risk_level: str
    action_mode: str
    approval_status: str
    suggested_reply_preview: str | None
    recommended_action: str
    created_at: datetime


class SalesApprovalQueueResponse(BaseModel):
    generated_at: datetime
    pending_count: int
    escalation_count: int
    high_risk_count: int
    stale_count: int
    items: list[SalesApprovalQueueItem]


class ChatReviewQueueItem(BaseModel):
    conversation_id: UUID
    lead_id: UUID | None
    lead_name: str
    conversation_title: str
    sales_user_id: UUID | None
    sales_owner_name: str | None
    source_channel: str
    source_label: str
    current_stage: str
    lead_temperature: str
    risk_level: str | None
    review_bucket: str
    review_label: str
    recommended_action: str
    latest_message_preview: str | None
    latest_message_at: datetime | None
    queue_since_at: datetime | None
    age_bucket: str
    priority_score: int
    latest_ai_extraction: DashboardAIExtractionSummary | None
    latest_reply_suggestion: DashboardReplySuggestionSummary | None
    latest_sent_message: DashboardSentMessageSummary | None


class ChatReviewCenterResponse(BaseModel):
    generated_at: datetime
    total_items: int
    needs_analysis_count: int
    needs_reply_suggestion_count: int
    pending_approval_count: int
    escalation_count: int
    ready_to_send_count: int
    stale_count: int
    items: list[ChatReviewQueueItem]


class OpsNotificationItem(BaseModel):
    id: UUID
    organization_id: UUID | None
    user_id: UUID | None
    source_type: str
    source_key: str
    severity: str
    title: str
    body: str
    target_href: str | None
    status: str
    delivery_channel: str
    delivery_status: str
    escalation_level: str
    resolution_note: str | None
    age_bucket: str
    acknowledged_by_user_id: UUID | None
    acknowledged_at: datetime | None
    delivered_at: datetime | None
    escalated_at: datetime | None
    resolved_at: datetime | None
    created_at: datetime
    updated_at: datetime


class OpsNotificationResponse(BaseModel):
    generated_at: datetime
    active_count: int
    acknowledged_count: int
    resolved_count: int
    escalated_count: int
    items: list[OpsNotificationItem]


class OpsNotificationResolveRequest(BaseModel):
    resolution_note: str | None = None


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


class MarketingContentBrief(BaseModel):
    title: str
    audience_segment: str
    key_message: str
    suggested_format: str
    tone: str
    call_to_action: str
    urgency: str


class MarketingAdsSignal(BaseModel):
    title: str
    observation: str
    recommendation: str
    budget_shift: str
    urgency: str


class MarketingExecutionItem(BaseModel):
    id: UUID
    organization_id: UUID | None
    created_by_user_id: UUID | None
    created_by_user_name: str | None
    assigned_user_id: UUID | None
    assigned_user_name: str | None
    item_type: str
    source_kind: str
    status: str
    priority: str
    title: str
    summary: str
    recommended_action: str
    campaign_name: str | None
    notes: str | None
    result_notes: str | None
    published_at: datetime | None
    leads_generated: int
    qualified_leads: int
    won_leads: int
    attributed_pipeline_value: float
    attributed_won_value: float
    attributed_deposit_amount: float
    created_at: datetime
    updated_at: datetime


class MarketingExecutionItemCreateRequest(BaseModel):
    item_type: str
    source_kind: str
    title: str
    summary: str
    recommended_action: str
    priority: str = "medium"
    assigned_user_id: UUID | None = None
    campaign_name: str | None = None
    notes: str | None = None


class MarketingExecutionItemUpdateRequest(BaseModel):
    status: str | None = None
    assigned_user_id: UUID | None = None
    campaign_name: str | None = None
    notes: str | None = None
    result_notes: str | None = None
    published_at: datetime | None = None
    leads_generated: int | None = None
    qualified_leads: int | None = None
    won_leads: int | None = None
    attributed_pipeline_value: float | None = None
    attributed_won_value: float | None = None
    attributed_deposit_amount: float | None = None


class MarketingExecutionSummary(BaseModel):
    total_items: int
    done_items: int
    published_items: int
    leads_generated: int
    qualified_leads: int
    won_leads: int
    attributed_pipeline_value: float
    attributed_won_value: float
    attributed_deposit_amount: float


class MarketingPlanningItem(BaseModel):
    window_label: str
    theme: str
    objective: str
    suggested_format: str
    primary_metric: str


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
    content_briefs: list[MarketingContentBrief]
    ads_signals: list[MarketingAdsSignal]
    monthly_content_plan: list[MarketingPlanningItem]
    execution_items: list[MarketingExecutionItem]
    execution_summary: MarketingExecutionSummary
    kpi_summary: MarketingKpiSummary
    generated_at: datetime


class KpiSummaryCard(BaseModel):
    total_organizations: int
    total_sales_users: int
    total_leads: int
    hot_leads: int
    closing_leads: int
    analyzed_conversations: int
    reply_sent_rate: float
    approved_reply_rate: float
    overdue_follow_ups: int
    pipeline_value: float
    won_value: float
    deposit_amount: float
    win_rate: float


class SalesPerformanceRow(BaseModel):
    user_id: UUID
    user_name: str
    organization_id: UUID | None
    organization_name: str | None
    assigned_leads: int
    hot_leads: int
    closing_leads: int
    conversations_owned: int
    analyzed_conversations: int
    approved_drafts: int
    replies_sent: int
    overdue_follow_ups: int
    won_leads: int
    pipeline_value: float
    won_value: float
    deposit_amount: float


class OrganizationPerformanceRow(BaseModel):
    organization_id: UUID
    organization_name: str
    total_leads: int
    hot_leads: int
    closing_leads: int
    conversations: int
    analyzed_conversations: int
    reply_sent_rate: float
    approved_reply_rate: float
    overdue_follow_ups: int
    won_leads: int
    pipeline_value: float
    won_value: float
    deposit_amount: float


class SourcePerformanceRow(BaseModel):
    source_key: str
    source_channel: str
    source_label: str
    lead_count: int
    conversation_count: int
    analyzed_conversations: int
    hot_leads: int
    reply_sent_rate: float
    pipeline_value: float
    won_value: float


class KpiAlertItem(BaseModel):
    severity: str
    title: str
    description: str
    recommended_action: str
    target_href: str | None


class ExecutiveRecommendationItem(BaseModel):
    title: str
    rationale: str
    owner_role: str
    next_step: str
    target_href: str | None


class PersistedKpiAlertRecord(BaseModel):
    id: UUID
    organization_id: UUID | None
    scope_type: str
    severity: str
    title: str
    description: str
    recommended_action: str
    target_href: str | None
    status: str
    acknowledged_by_user_id: UUID | None
    resolved_by_user_id: UUID | None
    first_detected_at: datetime
    last_detected_at: datetime
    acknowledged_at: datetime | None
    resolved_at: datetime | None
    resolution_note: str | None
    created_at: datetime
    updated_at: datetime


class KpiAlertHistoryResponse(BaseModel):
    generated_at: datetime
    active_count: int
    acknowledged_count: int
    resolved_count: int
    items: list[PersistedKpiAlertRecord]


class KpiAlertResolveRequest(BaseModel):
    resolution_note: str | None = None


class KpiSnapshotItem(BaseModel):
    id: UUID
    organization_id: UUID | None
    scope_type: str
    snapshot_type: str
    metrics_json: dict
    observations_json: list[str]
    created_at: datetime


class KpiSnapshotHistoryResponse(BaseModel):
    generated_at: datetime
    items: list[KpiSnapshotItem]


class KpiCommandCenterResponse(BaseModel):
    scope_type: str
    generated_at: datetime
    summary: KpiSummaryCard
    key_observations: list[str]
    alerts: list[KpiAlertItem]
    persisted_alerts: list[PersistedKpiAlertRecord]
    recommendations: list[ExecutiveRecommendationItem]
    sales_performance: list[SalesPerformanceRow]
    organization_performance: list[OrganizationPerformanceRow]
    source_performance: list[SourcePerformanceRow]
    marketing_execution_summary: MarketingExecutionSummary


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
    organization_name: str | None
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
    organization_name: str | None
    actor_email: str | None
    actor_role: str | None
    action: str
    resource_type: str
    resource_id: str | None
    created_at: datetime


class OpsProductKnowledgeRow(BaseModel):
    id: UUID
    organization_id: UUID | None
    organization_name: str | None
    title: str
    category: str
    source_type: str
    is_active: bool
    updated_at: datetime


class OpsSnapshotRow(BaseModel):
    id: UUID
    organization_id: UUID | None
    organization_name: str | None
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

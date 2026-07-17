from __future__ import annotations

from datetime import date, datetime
from uuid import UUID

from pydantic import BaseModel, Field


class DashboardLatestMessage(BaseModel):
    sender_name: str
    sender_type: str
    message_text: str
    reply_context_text: str | None = None
    reply_context_sender_name: str | None = None
    reply_context_sender_type: str | None = None
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


class ChatReviewNoteItem(BaseModel):
    id: UUID
    author_user_id: UUID | None
    author_user_name: str | None
    note_type: str
    body: str
    created_at: datetime


class ChatReviewCaseItem(BaseModel):
    id: UUID
    conversation_id: UUID
    organization_id: UUID | None
    lead_id: UUID | None
    submitted_by_user_id: UUID | None
    submitted_by_user_name: str | None
    reviewer_user_id: UUID | None
    reviewer_user_name: str | None
    workflow_scope: str
    feedback_status: str
    status: str
    review_label: str
    review_summary: str | None
    coaching_focus: str | None
    recommended_action: str | None
    reviewed_at: datetime | None
    feedback_sent_at: datetime | None
    feedback_acknowledged_at: datetime | None
    feedback_resolved_at: datetime | None
    created_at: datetime
    updated_at: datetime
    notes: list[ChatReviewNoteItem]


class KnowledgeUpdateProposalItem(BaseModel):
    id: UUID
    organization_id: UUID | None
    conversation_id: UUID
    conversation_title: str | None
    chat_review_case_id: UUID | None
    lead_id: UUID | None
    proposed_by_user_id: UUID | None
    proposed_by_user_name: str | None
    reviewed_by_user_id: UUID | None
    reviewed_by_user_name: str | None
    published_product_knowledge_id: UUID | None
    published_product_knowledge_title: str | None
    title: str
    category: str
    proposed_content: str
    source_type: str
    rationale: str | None
    status: str
    review_decision_note: str | None
    submitted_at: datetime | None
    reviewed_at: datetime | None
    published_at: datetime | None
    created_at: datetime
    updated_at: datetime


class SalesInboxItem(BaseModel):
    conversation_id: UUID
    organization_id: UUID | None
    title: str
    source: str
    source_channel: str
    source_label: str
    account_category: str
    status: str
    started_at: datetime | None
    last_message_at: datetime | None
    created_at: datetime
    sales_user_id: UUID | None
    sales_owner_name: str | None
    latest_message: DashboardLatestMessage | None
    latest_ai_extraction: DashboardAIExtractionSummary | None
    latest_reply_suggestion: DashboardReplySuggestionSummary | None
    latest_sent_message: DashboardSentMessageSummary | None

    ui_status: str
    priority_score: int
    is_archived: bool


class SalesConversationDetail(BaseModel):
    conversation_id: UUID
    organization_id: UUID | None
    title: str
    source: str
    source_channel: str
    source_label: str
    account_category: str
    status: str
    started_at: datetime | None
    last_message_at: datetime | None
    sales_user_id: UUID | None
    messages: list[dict]
    latest_ai_extraction: DashboardAIExtractionSummary | None
    latest_reply_suggestion: DashboardReplySuggestionSummary | None
    sent_messages: list[DashboardSentMessageSummary]
    chat_review_case: ChatReviewCaseItem | None
    knowledge_update_proposal: KnowledgeUpdateProposalItem | None


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
    latest_discipline_log_date: date | None = None


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
    missing_discipline_log_count: int
    stale_discipline_log_count: int
    completion_rate_today: float
    items: list[SalesWorklistItem]
    upcoming_items: list[SalesWorklistItem]


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
    account_category: str
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
    active_review_case_id: UUID | None = None
    active_review_status: str | None = None
    active_review_label: str | None = None
    active_review_reviewer_name: str | None = None


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


class ManagerTeamMemberItem(BaseModel):
    id: UUID
    name: str
    role: str
    is_active: bool


class ManagerTeamDisciplineRow(BaseModel):
    team_id: UUID | None
    team_name: str
    unit_id: UUID | None
    unit_name: str | None
    manager_user_name: str | None
    member_count: int
    members: list[ManagerTeamMemberItem]
    lead_count: int
    missing_or_stale_logs: int
    overdue_follow_ups: int
    open_coaching_cases: int
    pending_knowledge_proposals: int
    discipline_compliance_rate: float
    follow_up_compliance_rate: float


class ManagerCoachingPriorityItem(BaseModel):
    review_case_id: UUID
    conversation_id: UUID
    lead_id: UUID | None
    lead_name: str
    conversation_title: str
    sales_owner_name: str | None
    reviewer_user_name: str | None
    review_status: str
    review_label: str
    risk_level: str | None
    latest_message_at: datetime | None
    priority_score: int
    recommended_action: str | None


class ManagerObjectionTrendItem(BaseModel):
    objection: str
    count: int


class ManagerBoundaryAlertItem(BaseModel):
    team_id: UUID | None
    team_name: str
    unit_id: UUID | None
    unit_name: str | None
    severity: str
    title: str
    description: str
    target_href: str | None


class ManagerSalesPerformanceSummary(BaseModel):
    sales_count: int
    total_active_leads: int
    total_needs_reply: int
    total_overdue_follow_up: int
    range_label: str = "7d"
    previous_range_label: str = "prev_7d"
    delta_total_needs_reply: int = 0
    delta_total_overdue_follow_up: int = 0


class SalesPerformanceTrend(BaseModel):
    range_label: str
    previous_range_label: str
    delta_active_leads: int
    delta_needs_reply: int
    delta_overdue_follow_up: int
    delta_hot_leads: int
    delta_analyzed_conversations: int
    delta_won_deals: int
    momentum_label: str


class WeeklyPerformanceSnapshotItem(BaseModel):
    snapshot_date: date
    snapshot_granularity: str
    member_count: int | None = None
    active_leads_count: int
    needs_reply_count: int
    overdue_follow_up_count: int
    hot_leads_count: int
    analyzed_conversations_count: int
    needs_analysis_count: int
    won_deals_count: int
    lost_deals_count: int | None = None
    open_deals_count: int | None = None
    avg_response_sla_status: str
    crm_discipline_status: str
    coaching_priority_score: int
    coaching_priority_label: str


class HistoricalPerformanceSummary(BaseModel):
    trend_label: str
    delta_needs_reply: int
    delta_overdue_follow_up: int
    delta_won_deals: int
    latest_snapshot_date: date | None
    previous_snapshot_date: date | None


class OperationalScorecard(BaseModel):
    overall_score: int
    score_label: str
    response_discipline_score: int
    follow_up_discipline_score: int
    hot_lead_handling_score: int
    pipeline_movement_score: int
    crm_hygiene_score: int
    primary_reason: str
    secondary_reason: str | None = None
    recommended_action: str
    score_delta_vs_previous: int = 0
    score_trend_label: str = "stable"


class ManagerHistoricalSummary(BaseModel):
    trend_label: str
    delta_total_needs_reply: int
    delta_total_overdue_follow_up: int
    latest_snapshot_date: date | None
    previous_snapshot_date: date | None


class SalesCoachingSignal(BaseModel):
    priority_score: int
    priority_label: str
    primary_reason: str
    recommended_action: str
    focus_area: str


class TopCoachingTargetItem(BaseModel):
    sales_user_id: UUID
    sales_name: str
    priority_label: str
    primary_reason: str
    recommended_action: str


class TeamTopContributorItem(BaseModel):
    sales_user_id: UUID
    sales_name: str
    priority_label: str
    primary_reason: str


class TeamPerformanceSummary(BaseModel):
    team_count: int
    range_label: str
    previous_range_label: str
    total_overdue_follow_up: int
    total_needs_reply: int


class TeamPerformanceItem(BaseModel):
    team_id: UUID | None
    team_name: str
    unit_id: UUID | None
    unit_name: str | None
    manager_user_name: str | None
    member_count: int
    active_leads_count: int
    needs_reply_count: int
    overdue_follow_up_count: int
    hot_leads_count: int
    analyzed_conversations_count: int
    needs_analysis_count: int
    won_deals_count: int
    latest_activity_at: datetime | None
    avg_response_sla_status: str
    crm_discipline_status: str
    trend: SalesPerformanceTrend
    scorecard: OperationalScorecard
    coaching_signal: SalesCoachingSignal
    top_sales_contributors: list[TeamTopContributorItem]
    weekly_history: list[WeeklyPerformanceSnapshotItem] = Field(default_factory=list)
    history_summary: HistoricalPerformanceSummary | None = None


class PerformanceActionCreateRequest(BaseModel):
    assigned_to_user_id: UUID
    team_id: UUID | None = None
    sales_user_id: UUID | None = None
    source_type: str
    source_reference_id: UUID | None = None
    title: str
    description: str
    action_type: str
    priority_label: str
    due_at: datetime | None = None


class PerformanceActionUpdateRequest(BaseModel):
    status: str
    resolution_note: str | None = None


class PerformanceActionItem(BaseModel):
    id: UUID
    organization_id: UUID | None
    created_by_user_id: UUID | None
    created_by_user_name: str | None
    assigned_to_user_id: UUID | None
    assigned_to_user_name: str | None
    team_id: UUID | None
    team_name: str | None
    sales_user_id: UUID | None
    sales_name: str | None
    source_type: str
    source_reference_id: UUID | None
    title: str
    description: str
    action_type: str
    status: str
    priority_label: str
    due_at: datetime | None
    resolution_note: str | None
    completed_at: datetime | None
    created_at: datetime
    updated_at: datetime


class PerformanceActionListResponse(BaseModel):
    generated_at: datetime
    open_count: int
    in_progress_count: int
    done_count: int
    skipped_count: int
    items: list[PerformanceActionItem]


class WeeklyReviewEntityItem(BaseModel):
    scope_type: str
    sales_user_id: UUID | None = None
    team_id: UUID | None = None
    label: str
    team_name: str | None = None
    score: int
    score_label: str
    trend_label: str
    score_delta: int
    backlog_count: int
    overdue_count: int
    action_open_count: int
    critical_alert_count: int
    summary: str
    target_href: str | None = None


class WeeklyReviewAlertItem(BaseModel):
    notification_id: UUID
    alert_type: str | None = None
    title: str
    description: str
    severity: str
    status: str
    team_name: str | None = None
    sales_name: str | None = None
    target_href: str | None = None
    triggered_at: datetime | None = None


class WeeklyReviewSummaryResponse(BaseModel):
    generated_at: datetime
    review_start: date
    review_end: date
    scope_label: str
    healthy_team_count: int
    teams_needing_attention_count: int
    unresolved_action_count: int
    critical_alert_open_count: int
    top_improvers: list[WeeklyReviewEntityItem]
    biggest_risks: list[WeeklyReviewEntityItem]
    teams_needing_intervention: list[WeeklyReviewEntityItem]
    unresolved_actions: list[PerformanceActionItem]
    critical_alerts_open: list[WeeklyReviewAlertItem]


class ManagerSalesPerformanceItem(BaseModel):
    sales_user_id: UUID
    sales_name: str
    role: str
    active_leads_count: int
    needs_reply_count: int
    overdue_follow_up_count: int
    hot_leads_count: int
    analyzed_conversations_count: int
    needs_analysis_count: int
    won_deals_count: int
    lost_deals_count: int
    open_deals_count: int
    latest_activity_at: datetime | None
    avg_response_sla_status: str
    crm_discipline_status: str
    trend: SalesPerformanceTrend
    scorecard: OperationalScorecard
    coaching_signal: SalesCoachingSignal
    weekly_history: list[WeeklyPerformanceSnapshotItem] = Field(default_factory=list)
    history_summary: HistoricalPerformanceSummary | None = None


class SalesPerformanceDetailUser(BaseModel):
    id: UUID
    name: str
    role: str
    team_name: str | None
    unit_name: str | None
    is_active: bool


class SalesPerformanceDetailSummary(BaseModel):
    range_label: str
    previous_range_label: str
    active_leads_count: int
    needs_reply_count: int
    overdue_follow_up_count: int
    hot_leads_count: int
    analyzed_conversations_count: int
    needs_analysis_count: int
    won_deals_count: int
    lost_deals_count: int
    open_deals_count: int
    latest_activity_at: datetime | None
    avg_response_sla_status: str
    crm_discipline_status: str
    trend: SalesPerformanceTrend
    scorecard: OperationalScorecard
    coaching_signal: SalesCoachingSignal
    weekly_history: list[WeeklyPerformanceSnapshotItem] = Field(default_factory=list)
    history_summary: HistoricalPerformanceSummary | None = None


class SalesPerformanceLeadItem(BaseModel):
    lead_id: UUID
    lead_name: str
    current_stage: str
    lead_temperature: str
    next_follow_up_at: datetime | None
    last_contact_at: datetime | None
    discipline_status: str
    target_href: str


class SalesPerformanceConversationItem(BaseModel):
    conversation_id: UUID
    conversation_title: str
    ui_status: str
    source_channel: str
    risk_level: str | None
    last_message_at: datetime | None
    target_href: str


class SalesPerformanceFollowUpItem(BaseModel):
    lead_id: UUID
    lead_name: str
    task_type: str
    due_at: datetime | None
    priority_label: str
    target_href: str


class SalesPerformanceDetailResponse(BaseModel):
    generated_at: datetime
    sales_user: SalesPerformanceDetailUser
    summary: SalesPerformanceDetailSummary
    lead_items: list[SalesPerformanceLeadItem]
    conversation_items: list[SalesPerformanceConversationItem]
    follow_up_items: list[SalesPerformanceFollowUpItem]


class ManagerInsightsResponse(BaseModel):
    generated_at: datetime
    scope_label: str
    scope_team_count: int
    scope_member_count: int
    total_leads: int
    stale_lead_ratio: float
    follow_up_compliance_rate: float
    missing_or_stale_log_count: int
    overdue_follow_up_count: int
    open_coaching_case_count: int
    pending_knowledge_proposal_count: int
    team_discipline: list[ManagerTeamDisciplineRow]
    coaching_priority: list[ManagerCoachingPriorityItem]
    objection_trends: list[ManagerObjectionTrendItem]
    boundary_alerts: list[ManagerBoundaryAlertItem]
    historical_summary: ManagerHistoricalSummary | None = None
    weekly_review: WeeklyReviewSummaryResponse | None = None
    sales_performance_summary: ManagerSalesPerformanceSummary
    sales_performance: list[ManagerSalesPerformanceItem]
    top_coaching_targets: list[TopCoachingTargetItem]
    team_performance_summary: TeamPerformanceSummary
    team_performance: list[TeamPerformanceItem]


class SalesPerformanceHistoryResponse(BaseModel):
    generated_at: datetime
    sales_user: SalesPerformanceDetailUser
    history_summary: HistoricalPerformanceSummary
    weekly_history: list[WeeklyPerformanceSnapshotItem]


class TeamPerformanceHistoryResponse(BaseModel):
    generated_at: datetime
    team_id: UUID
    team_name: str
    unit_id: UUID | None
    unit_name: str | None
    manager_user_name: str | None
    history_summary: HistoricalPerformanceSummary
    weekly_history: list[WeeklyPerformanceSnapshotItem]


class PerformanceSnapshotGenerationResponse(BaseModel):
    generated_at: datetime
    snapshot_granularity: str
    weeks: int
    snapshot_dates: list[date]
    sales_snapshot_count: int
    team_snapshot_count: int


class ChatReviewCaseUpsertRequest(BaseModel):
    reviewer_user_id: UUID | None = None
    status: str
    review_label: str
    review_summary: str | None = None
    coaching_focus: str | None = None
    recommended_action: str | None = None


class ChatReviewCaseSuggestionResponse(BaseModel):
    status: str
    review_label: str
    review_summary: str
    coaching_focus: str
    recommended_action: str
    confidence_score: float
    source_summary: str


class ChatReviewNoteCreateRequest(BaseModel):
    note_type: str = "manager_note"
    body: str


class ChatReviewerCandidateItem(BaseModel):
    id: UUID
    name: str
    role: str


class OpsNotificationItem(BaseModel):
    id: UUID
    organization_id: UUID | None
    user_id: UUID | None
    team_id: UUID | None = None
    team_name: str | None = None
    sales_user_id: UUID | None = None
    source_type: str
    source_key: str
    source_reference_id: UUID | None = None
    alert_type: str | None = None
    workflow_scope: str
    owner_role: str
    target_role: str
    lead_id: UUID | None = None
    lead_name: str | None = None
    sales_owner_name: str | None = None
    severity: str
    title: str
    body: str
    target_href: str | None
    status: str
    delivery_channel: str
    delivery_status: str
    escalation_level: str
    resolution_note: str | None
    metadata_json: dict | None = None
    age_bucket: str
    acknowledged_by_user_id: UUID | None
    acknowledged_at: datetime | None
    resolved_by_user_id: UUID | None = None
    delivered_at: datetime | None
    escalated_at: datetime | None
    resolved_at: datetime | None
    ignored_by_user_id: UUID | None = None
    ignored_at: datetime | None = None
    triggered_at: datetime | None = None
    created_at: datetime
    updated_at: datetime


class OpsNotificationResponse(BaseModel):
    generated_at: datetime
    active_count: int
    acknowledged_count: int
    resolved_count: int
    ignored_count: int = 0
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

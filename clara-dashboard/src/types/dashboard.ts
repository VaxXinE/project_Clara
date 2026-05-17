export type DashboardLatestMessage = {
  sender_name: string;
  sender_type: string;
  message_text: string;
  message_timestamp: string;
};

export type DashboardAIExtractionSummary = {
  id: string;
  lead_temperature: string;
  pipeline_stage: string;
  buying_intent: string;
  sentiment: string;
  risk_level: string;
  main_objections: string[];
  next_best_action: string;
  confidence_score: number;
  created_at: string;
};

export type DashboardReplySuggestionSummary = {
  id: string;
  action_mode: string;
  approval_status: string;
  risk_level: string;
  suggested_replies: SuggestedReply[];
  policy_reasons: string[];
  created_at: string;
};

export type SuggestedReply = {
  tone: "friendly" | "professional" | "empathetic" | "urgent";
  text: string;
  reasoning: string;
};

export type SalesInboxItem = {
  conversation_id: string;
  organization_id: string | null;
  title: string;
  source: string;
  status: string;
  started_at: string | null;
  last_message_at: string | null;
  created_at: string;
  latest_message: DashboardLatestMessage | null;
  latest_ai_extraction: DashboardAIExtractionSummary | null;
  latest_reply_suggestion: DashboardReplySuggestionSummary | null;
  ui_status: string;
  priority_score: number;
  latest_sent_message: DashboardSentMessageSummary | null;
  sales_user_id: string | null;
};

export type SalesConversationMessage = {
  id: string;
  sender_name: string;
  sender_type: string;
  message_text: string;
  message_timestamp: string;
};

export type SalesConversationDetail = {
  conversation_id: string;
  organization_id: string | null;
  title: string;
  source: string;
  status: string;
  started_at: string | null;
  last_message_at: string | null;
  messages: SalesConversationMessage[];
  latest_ai_extraction: DashboardAIExtractionSummary | null;
  latest_reply_suggestion: DashboardReplySuggestionSummary | null;
  sent_messages: DashboardSentMessageSummary[];
  sales_user_id: string | null;
};

export type LeadListItem = {
  id: string;
  organization_id: string | null;
  assigned_user_id: string | null;
  assigned_user_name: string | null;
  display_name: string;
  source: string;
  current_stage: string;
  lead_temperature: string;
  summary: string | null;
  notes: string | null;
  last_contact_at: string | null;
  next_follow_up_at: string | null;
  created_at: string;
  updated_at: string;
  conversation_count: number;
  latest_conversation_id: string | null;
};

export type LeadTaskItem = {
  id: string;
  lead_id: string;
  organization_id: string | null;
  assigned_user_id: string | null;
  assigned_user_name: string | null;
  completed_by_user_id: string | null;
  completed_by_user_name: string | null;
  task_type: string;
  status: string;
  title: string;
  description: string | null;
  due_at: string | null;
  completed_at: string | null;
  last_status_changed_at: string;
  created_at: string;
  updated_at: string;
};

export type LeadActivityEventItem = {
  id: string;
  lead_id: string;
  organization_id: string | null;
  actor_user_id: string | null;
  actor_user_name: string | null;
  event_type: string;
  title: string;
  description: string | null;
  from_value: string | null;
  to_value: string | null;
  created_at: string;
};

export type LeadDealItem = {
  id: string;
  lead_id: string;
  organization_id: string | null;
  owner_user_id: string | null;
  owner_user_name: string | null;
  status: string;
  currency: string;
  expected_value: number;
  deposit_amount: number;
  expected_close_date: string | null;
  closed_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type LeadDetail = LeadListItem & {
  conversation_ids: string[];
  deal: LeadDealItem | null;
  tasks: LeadTaskItem[];
  timeline: LeadActivityEventItem[];
};

export type LeadUpdateRequest = {
  current_stage?: string;
  lead_temperature?: string;
  summary?: string | null;
  notes?: string | null;
  next_follow_up_at?: string | null;
  assigned_user_id?: string | null;
};

export type LeadTaskCreateRequest = {
  task_type?: string;
  title: string;
  description?: string | null;
  due_at?: string | null;
  assigned_user_id?: string | null;
};

export type LeadTaskUpdateRequest = {
  status?: string;
  title?: string;
  description?: string | null;
  due_at?: string | null;
  assigned_user_id?: string | null;
  notes?: string | null;
};

export type LeadDealUpsertRequest = {
  status?: string;
  currency?: string;
  expected_value?: number;
  deposit_amount?: number;
  expected_close_date?: string | null;
  closed_at?: string | null;
  notes?: string | null;
};

export type SalesWorklistItem = {
  task_id: string | null;
  lead_id: string;
  conversation_id: string | null;
  lead_name: string;
  assigned_user_name: string | null;
  current_stage: string;
  lead_temperature: string;
  priority_score: number;
  task_type: string;
  task_status: string | null;
  task_label: string;
  reason: string;
  recommended_action: string;
  last_contact_at: string | null;
  next_follow_up_at: string | null;
};

export type SalesWorklistResponse = {
  generated_at: string;
  overdue_count: number;
  hot_lead_count: number;
  ready_to_send_count: number;
  pending_analysis_count: number;
  snoozed_count: number;
  completed_today_count: number;
  items: SalesWorklistItem[];
};

export type SalesApprovalQueueItem = {
  reply_suggestion_id: string;
  conversation_id: string;
  lead_id: string | null;
  lead_name: string;
  conversation_title: string;
  current_stage: string;
  lead_temperature: string;
  risk_level: string;
  action_mode: string;
  approval_status: string;
  suggested_reply_preview: string | null;
  recommended_action: string;
  created_at: string;
};

export type SalesApprovalQueueResponse = {
  generated_at: string;
  pending_count: number;
  escalation_count: number;
  items: SalesApprovalQueueItem[];
};

export type KpiSummaryCard = {
  total_organizations: number;
  total_sales_users: number;
  total_leads: number;
  hot_leads: number;
  closing_leads: number;
  analyzed_conversations: number;
  reply_sent_rate: number;
  approved_reply_rate: number;
  overdue_follow_ups: number;
  pipeline_value: number;
  won_value: number;
  deposit_amount: number;
  win_rate: number;
};

export type SalesPerformanceRow = {
  user_id: string;
  user_name: string;
  organization_id: string | null;
  organization_name: string | null;
  assigned_leads: number;
  hot_leads: number;
  closing_leads: number;
  conversations_owned: number;
  analyzed_conversations: number;
  approved_drafts: number;
  replies_sent: number;
  overdue_follow_ups: number;
  won_leads: number;
  pipeline_value: number;
  won_value: number;
  deposit_amount: number;
};

export type OrganizationPerformanceRow = {
  organization_id: string;
  organization_name: string;
  total_leads: number;
  hot_leads: number;
  closing_leads: number;
  conversations: number;
  analyzed_conversations: number;
  reply_sent_rate: number;
  approved_reply_rate: number;
  overdue_follow_ups: number;
  won_leads: number;
  pipeline_value: number;
  won_value: number;
  deposit_amount: number;
};

export type KpiCommandCenterResponse = {
  scope_type: string;
  generated_at: string;
  summary: KpiSummaryCard;
  key_observations: string[];
  alerts: {
    severity: string;
    title: string;
    description: string;
    recommended_action: string;
    target_href: string | null;
  }[];
  recommendations: {
    title: string;
    rationale: string;
    owner_role: string;
    next_step: string;
    target_href: string | null;
  }[];
  persisted_alerts: PersistedKpiAlertRecord[];
  sales_performance: SalesPerformanceRow[];
  organization_performance: OrganizationPerformanceRow[];
};

export type PersistedKpiAlertRecord = {
  id: string;
  organization_id: string | null;
  scope_type: string;
  severity: string;
  title: string;
  description: string;
  recommended_action: string;
  target_href: string | null;
  status: string;
  acknowledged_by_user_id: string | null;
  first_detected_at: string;
  last_detected_at: string;
  acknowledged_at: string | null;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
};

export type KpiAlertHistoryResponse = {
  generated_at: string;
  active_count: number;
  acknowledged_count: number;
  resolved_count: number;
  items: PersistedKpiAlertRecord[];
};

export type KpiSnapshotItem = {
  id: string;
  organization_id: string | null;
  scope_type: string;
  snapshot_type: string;
  metrics_json: {
    total_organizations: number;
    total_sales_users: number;
    total_leads: number;
    hot_leads: number;
    closing_leads: number;
    analyzed_conversations: number;
    reply_sent_rate: number;
    approved_reply_rate: number;
    overdue_follow_ups: number;
    pipeline_value: number;
    won_value: number;
    deposit_amount: number;
    win_rate: number;
  };
  observations_json: string[];
  created_at: string;
};

export type KpiSnapshotHistoryResponse = {
  generated_at: string;
  items: KpiSnapshotItem[];
};

export type MarketingInsightsPreview = {
  total_conversations: number;
  total_analyzed_conversations: number;
  top_objections: {
    topic: string;
    count: number;
  }[];
  lead_temperature_breakdown: Record<string, number>;
  risk_level_breakdown: Record<string, number>;
  buying_intent_breakdown: {
    label: string;
    count: number;
  }[];
  sentiment_breakdown: {
    label: string;
    count: number;
  }[];
  pipeline_stage_breakdown: {
    label: string;
    count: number;
  }[];
  top_content_recommendations: {
    title: string;
    rationale: string;
    suggested_format: string;
    priority: string;
  }[];
  content_briefs: {
    title: string;
    audience_segment: string;
    key_message: string;
    suggested_format: string;
    tone: string;
    call_to_action: string;
    urgency: string;
  }[];
  ads_signals: {
    title: string;
    observation: string;
    recommendation: string;
    budget_shift: string;
    urgency: string;
  }[];
  execution_items: MarketingExecutionItem[];
  monthly_content_plan: {
    window_label: string;
    theme: string;
    objective: string;
    suggested_format: string;
    primary_metric: string;
  }[];
  kpi_summary: {
    reply_sent_rate: number;
    analysis_coverage_rate: number;
    approved_reply_rate: number;
    high_risk_conversation_count: number;
  };
  generated_at: string;
};

export type MarketingExecutionItem = {
  id: string;
  organization_id: string | null;
  created_by_user_id: string | null;
  created_by_user_name: string | null;
  assigned_user_id: string | null;
  assigned_user_name: string | null;
  item_type: string;
  source_kind: string;
  status: string;
  priority: string;
  title: string;
  summary: string;
  recommended_action: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type MarketingExecutionItemCreateRequest = {
  item_type: string;
  source_kind: string;
  title: string;
  summary: string;
  recommended_action: string;
  priority?: string;
  assigned_user_id?: string | null;
  notes?: string | null;
};

export type MarketingExecutionItemUpdateRequest = {
  status?: string;
  assigned_user_id?: string | null;
  notes?: string | null;
};

export type MarketingInsightSnapshot = {
  id: string;
  organization_id: string | null;
  scope_type: string;
  snapshot_type: string;
  period_start: string;
  period_end: string;
  total_conversations: number;
  total_analyzed_conversations: number;
  top_objections: {
    topic: string;
    count: number;
  }[];
  top_content_recommendations: {
    title: string;
    rationale: string;
    suggested_format: string;
    priority: string;
  }[];
  kpi_summary: {
    reply_sent_rate: number;
    analysis_coverage_rate: number;
    approved_reply_rate: number;
    high_risk_conversation_count: number;
  };
  generated_at: string;
  created_at: string;
  comparison: {
    conversation_delta: number;
    analyzed_delta: number;
    reply_sent_rate_delta: number;
    approved_reply_rate_delta: number;
  } | null;
};

export type UploadWhatsAppResponse = {
  conversation_id: string;
  message_count: number;
  status: string;
};

export type DashboardSentMessageSummary = {
  id: string;
  reply_suggestion_id: string | null;
  send_mode: string;
  message_text: string;
  sent_by_name: string;
  sent_at: string;
};

export type ProductKnowledgeItem = {
  id: string;
  organization_id: string | null;
  scope_type: string;
  created_by_user_id: string | null;
  created_by_user_name: string | null;
  title: string;
  category: string;
  content: string;
  source_type: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type ProductKnowledgeCreateRequest = {
  title: string;
  category: string;
  content: string;
  source_type: string;
  is_active: boolean;
};

export type ProductKnowledgeListFilters = {
  q?: string;
  category?: string;
  is_active?: boolean;
};

export type CurrentUser = {
  id: string;
  name: string;
  email: string;
  role: string;
  is_active: boolean;
  created_at: string;
  organization_id: string | null;
  organization_name: string | null;
  created_by_user_id: string | null;
  created_by_user_name: string | null;
};

export type OrganizationItem = {
  id: string;
  name: string;
  slug: string;
  created_at: string;
};

export type CreateOrganizationRequest = {
  name: string;
  slug: string;
};

export type CreateUserRequest = {
  name: string;
  email: string;
  password: string;
  role: string;
  organization_id: string | null;
};

export type UpdateUserRequest = {
  name?: string;
  email?: string;
  role?: string;
  organization_id?: string | null;
};

export type ResetUserPasswordRequest = {
  password: string;
};

export type ChangePasswordRequest = {
  current_password: string;
  new_password: string;
};

export type OpsDatabaseOverview = {
  scope_type: string;
  organization_id: string | null;
  table_counts: {
    label: string;
    count: number;
  }[];
  recent_users: {
    id: string;
    organization_id: string | null;
    created_by_user_id: string | null;
    created_by_user_name: string | null;
    name: string;
    email: string;
    role: string;
    is_active: boolean;
    created_at: string;
  }[];
  recent_organizations: {
    id: string;
    name: string;
    slug: string;
    created_at: string;
  }[];
  recent_conversations: {
    id: string;
    organization_id: string | null;
    organization_name: string | null;
    sales_user_id: string | null;
    sales_owner_name: string | null;
    title: string;
    source: string;
    status: string;
    raw_filename: string | null;
    last_message_at: string | null;
    created_at: string;
  }[];
  recent_audit_logs: {
    id: string;
    organization_id: string | null;
    organization_name: string | null;
    actor_email: string | null;
    actor_role: string | null;
    action: string;
    resource_type: string;
    resource_id: string | null;
    created_at: string;
  }[];
  recent_product_knowledge: {
    id: string;
    organization_id: string | null;
    organization_name: string | null;
    title: string;
    category: string;
    source_type: string;
    is_active: boolean;
    updated_at: string;
  }[];
  recent_snapshots: {
    id: string;
    organization_id: string | null;
    organization_name: string | null;
    scope_type: string;
    snapshot_type: string;
    period_start: string;
    period_end: string;
    total_conversations: number;
    total_analyzed_conversations: number;
    created_at: string;
  }[];
};

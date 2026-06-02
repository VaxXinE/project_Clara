export type DashboardLatestMessage = {
  sender_name: string;
  sender_type: string;
  message_text: string;
  message_timestamp: string;
};

export type ChannelDefinitionItem = {
  key: string;
  label: string;
  description: string;
  supports_file_upload: boolean;
  supports_text_paste: boolean;
  supports_live_sync: boolean;
  file_endpoint: string | null;
  text_endpoint: string | null;
  supported_sources: string[];
  sample_hint: string;
};

export type ChannelDetectCandidate = {
  channel: string;
  label: string;
  confidence: number;
  matched_message_count: number;
  reason: string;
};

export type ChannelDetectResponse = {
  detected_channel: string | null;
  candidates: ChannelDetectCandidate[];
};

export type ChannelOverviewItem = {
  key: string;
  label: string;
  description: string;
  supports_file_upload: boolean;
  supports_text_paste: boolean;
  supports_live_sync: boolean;
  supported_sources: string[];
  conversation_count: number;
  lead_count: number;
  latest_activity_at: string | null;
};

export type ChannelOverviewResponse = {
  generated_at: string;
  scope_type: string;
  items: ChannelOverviewItem[];
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
  source_channel: string;
  source_label: string;
  account_category: string;
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
  sales_owner_name: string | null;
  is_archived: boolean;
};

export type SalesConversationMessage = {
  id: string;
  sender_name: string;
  sender_type: string;
  message_text: string;
  message_timestamp: string;
};

export type ChatReviewNoteItem = {
  id: string;
  author_user_id: string | null;
  author_user_name: string | null;
  note_type: string;
  body: string;
  created_at: string;
};

export type ChatReviewCaseItem = {
  id: string;
  conversation_id: string;
  organization_id: string | null;
  lead_id: string | null;
  submitted_by_user_id: string | null;
  submitted_by_user_name: string | null;
  reviewer_user_id: string | null;
  reviewer_user_name: string | null;
  workflow_scope: string;
  feedback_status: string;
  status: string;
  review_label: string;
  review_summary: string | null;
  coaching_focus: string | null;
  recommended_action: string | null;
  reviewed_at: string | null;
  feedback_sent_at: string | null;
  feedback_acknowledged_at: string | null;
  feedback_resolved_at: string | null;
  created_at: string;
  updated_at: string;
  notes: ChatReviewNoteItem[];
};

export type KnowledgeUpdateProposalItem = {
  id: string;
  organization_id: string | null;
  conversation_id: string;
  conversation_title: string | null;
  chat_review_case_id: string | null;
  lead_id: string | null;
  proposed_by_user_id: string | null;
  proposed_by_user_name: string | null;
  reviewed_by_user_id: string | null;
  reviewed_by_user_name: string | null;
  published_product_knowledge_id: string | null;
  published_product_knowledge_title: string | null;
  title: string;
  category: string;
  proposed_content: string;
  source_type: string;
  rationale: string | null;
  status: string;
  review_decision_note: string | null;
  submitted_at: string | null;
  reviewed_at: string | null;
  published_at: string | null;
  created_at: string;
  updated_at: string;
};

export type ChatReviewerCandidateItem = {
  id: string;
  name: string;
  role: string;
};

export type SalesConversationDetail = {
  conversation_id: string;
  organization_id: string | null;
  title: string;
  source: string;
  source_channel: string;
  source_label: string;
  account_category: string;
  status: string;
  started_at: string | null;
  last_message_at: string | null;
  messages: SalesConversationMessage[];
  latest_ai_extraction: DashboardAIExtractionSummary | null;
  latest_reply_suggestion: DashboardReplySuggestionSummary | null;
  sent_messages: DashboardSentMessageSummary[];
  sales_user_id: string | null;
  chat_review_case: ChatReviewCaseItem | null;
  knowledge_update_proposal: KnowledgeUpdateProposalItem | null;
};

export type LeadListItem = {
  id: string;
  organization_id: string | null;
  assigned_user_id: string | null;
  assigned_user_name: string | null;
  customer_profile_id: string | null;
  customer_profile_name: string | null;
  display_name: string;
  source: string;
  source_channel: string;
  source_label: string;
  account_category: string;
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
  deal_status: string | null;
  discipline_compliance_status: string;
  needs_deal_sync: boolean;
};

export type LeadTaskItem = {
  id: string;
  lead_id: string;
  organization_id: string | null;
  assigned_user_id: string | null;
  assigned_user_name: string | null;
  completed_by_user_id: string | null;
  completed_by_user_name: string | null;
  workflow_scope: string;
  requested_by_role: string | null;
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

export type LeadDisciplineLogItem = {
  id: string;
  lead_id: string;
  organization_id: string | null;
  actor_user_id: string | null;
  actor_user_name: string | null;
  log_date: string;
  activity_type: string;
  result_status: string;
  main_objection: string | null;
  customer_mood: string | null;
  notes: string | null;
  next_follow_up_at: string | null;
  created_at: string;
  updated_at: string;
};

export type LeadDisciplineSummaryItem = {
  latest_log_date: string | null;
  latest_activity_type: string | null;
  latest_result_status: string | null;
  log_count: number;
  logs_today_count: number;
  days_since_latest_log: number | null;
  compliance_status: string;
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

export type CustomerRelatedLeadItem = {
  id: string;
  display_name: string;
  source_channel: string;
  source_label: string;
  account_category: string;
  current_stage: string;
  lead_temperature: string;
  last_contact_at: string | null;
  latest_conversation_id: string | null;
};

export type CustomerMergeCandidateItem = {
  id: string;
  display_name: string;
  canonical_key: string;
  identity_confidence: number;
  match_strategy: string;
  match_score: number;
  overlap_reason: string;
  lead_count: number;
  conversation_count: number;
  source_labels: string[];
  last_contact_at: string | null;
};

export type CustomerProfileListItem = {
  id: string;
  assigned_user_id: string | null;
  assigned_user_name: string | null;
  display_name: string;
  phone: string | null;
  email: string | null;
  status: string;
  lead_count: number;
  active_lead_count: number;
  conversation_count: number;
  hot_lead_count: number;
  source_labels: string[];
  last_contact_at: string | null;
  identity_confidence: number;
};

export type CustomerProfileSummaryItem = {
  id: string;
  organization_id: string | null;
  assigned_user_id: string | null;
  assigned_user_name: string | null;
  display_name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  status: string;
  canonical_key: string;
  identity_confidence: number;
  match_strategy: string;
  merge_notes: string | null;
  merged_into_profile_id: string | null;
  lead_count: number;
  conversation_count: number;
  source_channels: string[];
  source_labels: string[];
  last_contact_at: string | null;
  created_at: string;
  updated_at: string;
  merge_candidates: CustomerMergeCandidateItem[];
  related_leads: CustomerRelatedLeadItem[];
};

export type CustomerProfileUpdateRequest = {
  display_name: string;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  status: string;
  account_category?: string | null;
};

export type CustomerProfileMergeRequest = {
  source_profile_id: string;
  target_profile_id: string;
  merge_notes?: string | null;
};

export type LeadDetail = LeadListItem & {
  conversation_ids: string[];
  customer_profile: CustomerProfileSummaryItem | null;
  deal: LeadDealItem | null;
  tasks: LeadTaskItem[];
  timeline: LeadActivityEventItem[];
  discipline_summary: LeadDisciplineSummaryItem;
  discipline_logs: LeadDisciplineLogItem[];
};

export type LeadDisciplineLogCreateRequest = {
  log_date?: string | null;
  activity_type: string;
  result_status: string;
  main_objection?: string | null;
  customer_mood?: string | null;
  notes?: string | null;
  next_follow_up_at?: string | null;
};

export type LeadDisciplineSuggestionResponse = {
  activity_type: string;
  result_status: string;
  main_objection: string | null;
  customer_mood: string | null;
  notes: string;
  next_follow_up_at: string | null;
  confidence_score: number;
  source_summary: string;
};

export type LeadUpdateRequest = {
  account_category?: string;
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

export type LeadQueueActionRequest = {
  action: "done" | "snooze" | "dismiss" | "reopen";
  duration?: "30m" | "2h" | "tomorrow" | null;
  reason_tag: string;
  reason_note?: string | null;
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
  due_today_count: number;
  overdue_24h_count: number;
  overdue_72h_count: number;
  open_task_count: number;
  completion_rate_today: number;
  items: SalesWorklistItem[];
  upcoming_items: SalesWorklistItem[];
};

export type ManagerTeamDisciplineRow = {
  team_id: string | null;
  team_name: string;
  unit_id: string | null;
  unit_name: string | null;
  manager_user_name: string | null;
  member_count: number;
  members: ManagerTeamMemberItem[];
  lead_count: number;
  missing_or_stale_logs: number;
  overdue_follow_ups: number;
  open_coaching_cases: number;
  pending_knowledge_proposals: number;
  discipline_compliance_rate: number;
  follow_up_compliance_rate: number;
};

export type ManagerTeamMemberItem = {
  id: string;
  name: string;
  role: string;
  is_active: boolean;
};

export type ManagerCoachingPriorityItem = {
  review_case_id: string;
  conversation_id: string;
  lead_id: string | null;
  lead_name: string;
  conversation_title: string;
  sales_owner_name: string | null;
  reviewer_user_name: string | null;
  review_status: string;
  review_label: string;
  risk_level: string | null;
  latest_message_at: string | null;
  priority_score: number;
  recommended_action: string | null;
};

export type ManagerObjectionTrendItem = {
  objection: string;
  count: number;
};

export type ManagerBoundaryAlertItem = {
  team_id: string | null;
  team_name: string;
  unit_id: string | null;
  unit_name: string | null;
  severity: string;
  title: string;
  description: string;
  target_href: string | null;
};

export type ManagerInsightsResponse = {
  generated_at: string;
  scope_label: string;
  scope_team_count: number;
  scope_member_count: number;
  total_leads: number;
  stale_lead_ratio: number;
  follow_up_compliance_rate: number;
  missing_or_stale_log_count: number;
  overdue_follow_up_count: number;
  open_coaching_case_count: number;
  pending_knowledge_proposal_count: number;
  team_discipline: ManagerTeamDisciplineRow[];
  coaching_priority: ManagerCoachingPriorityItem[];
  objection_trends: ManagerObjectionTrendItem[];
  boundary_alerts: ManagerBoundaryAlertItem[];
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
  high_risk_count: number;
  stale_count: number;
  items: SalesApprovalQueueItem[];
};

export type ChatReviewCaseUpsertRequest = {
  reviewer_user_id?: string | null;
  status: string;
  review_label: string;
  review_summary?: string | null;
  coaching_focus?: string | null;
  recommended_action?: string | null;
};

export type ChatReviewCaseSuggestionResponse = {
  status: string;
  review_label: string;
  review_summary: string;
  coaching_focus: string;
  recommended_action: string;
  confidence_score: number;
  source_summary: string;
};

export type ChatReviewNoteCreateRequest = {
  note_type?: string;
  body: string;
};

export type ChatReviewQueueItem = {
  conversation_id: string;
  lead_id: string | null;
  lead_name: string;
  conversation_title: string;
  sales_user_id: string | null;
  sales_owner_name: string | null;
  source_channel: string;
  source_label: string;
  account_category: string;
  current_stage: string;
  lead_temperature: string;
  risk_level: string | null;
  review_bucket: string;
  review_label: string;
  recommended_action: string;
  latest_message_preview: string | null;
  latest_message_at: string | null;
  queue_since_at: string | null;
  age_bucket: string;
  priority_score: number;
  latest_ai_extraction: DashboardAIExtractionSummary | null;
  latest_reply_suggestion: DashboardReplySuggestionSummary | null;
  latest_sent_message: DashboardSentMessageSummary | null;
  active_review_case_id: string | null;
  active_review_status: string | null;
  active_review_label: string | null;
  active_review_reviewer_name: string | null;
};

export type ChatReviewCenterResponse = {
  generated_at: string;
  total_items: number;
  needs_analysis_count: number;
  needs_reply_suggestion_count: number;
  pending_approval_count: number;
  escalation_count: number;
  ready_to_send_count: number;
  stale_count: number;
  items: ChatReviewQueueItem[];
};

export type OpsNotificationItem = {
  id: string;
  organization_id: string | null;
  user_id: string | null;
  source_type: string;
  source_key: string;
  workflow_scope: string;
  owner_role: string;
  target_role: string;
  lead_id: string | null;
  lead_name: string | null;
  sales_owner_name: string | null;
  severity: string;
  title: string;
  body: string;
  target_href: string | null;
  status: string;
  delivery_channel: string;
  delivery_status: string;
  escalation_level: string;
  resolution_note: string | null;
  age_bucket: string;
  acknowledged_by_user_id: string | null;
  acknowledged_at: string | null;
  delivered_at: string | null;
  escalated_at: string | null;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
};

export type OpsNotificationResponse = {
  generated_at: string;
  active_count: number;
  acknowledged_count: number;
  resolved_count: number;
  escalated_count: number;
  items: OpsNotificationItem[];
};

export type OpsNotificationResolveRequest = {
  resolution_note?: string | null;
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

export type SourcePerformanceRow = {
  source_key: string;
  source_channel: string;
  source_label: string;
  lead_count: number;
  conversation_count: number;
  analyzed_conversations: number;
  hot_leads: number;
  reply_sent_rate: number;
  pipeline_value: number;
  won_value: number;
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
  source_performance: SourcePerformanceRow[];
  marketing_execution_summary: MarketingExecutionSummary;
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
  resolved_by_user_id: string | null;
  first_detected_at: string;
  last_detected_at: string;
  acknowledged_at: string | null;
  resolved_at: string | null;
  resolution_note: string | null;
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
  execution_summary: MarketingExecutionSummary;
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

export type MarketingExecutionSummary = {
  total_items: number;
  done_items: number;
  published_items: number;
  leads_generated: number;
  qualified_leads: number;
  won_leads: number;
  attributed_pipeline_value: number;
  attributed_won_value: number;
  attributed_deposit_amount: number;
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
  campaign_name: string | null;
  notes: string | null;
  result_notes: string | null;
  published_at: string | null;
  leads_generated: number;
  qualified_leads: number;
  won_leads: number;
  attributed_pipeline_value: number;
  attributed_won_value: number;
  attributed_deposit_amount: number;
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
  campaign_name?: string | null;
  notes?: string | null;
};

export type MarketingExecutionItemUpdateRequest = {
  status?: string;
  assigned_user_id?: string | null;
  campaign_name?: string | null;
  notes?: string | null;
  result_notes?: string | null;
  published_at?: string | null;
  leads_generated?: number | null;
  qualified_leads?: number | null;
  won_leads?: number | null;
  attributed_pipeline_value?: number | null;
  attributed_won_value?: number | null;
  attributed_deposit_amount?: number | null;
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

export type UploadConversationResponse = {
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

export type KnowledgeUpdateProposalUpsertRequest = {
  title: string;
  category: string;
  proposed_content: string;
  source_type: string;
  rationale: string | null;
  status: string;
};

export type KnowledgeUpdateProposalReviewRequest = {
  status: string;
  review_decision_note: string | null;
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
  team_id: string | null;
  team_name: string | null;
  unit_id: string | null;
  unit_name: string | null;
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

export type SalesUnitItem = {
  id: string;
  organization_id: string;
  organization_name: string | null;
  name: string;
  code: string;
  created_at: string;
  team_count: number;
};

export type CreateSalesUnitRequest = {
  organization_id?: string | null;
  name: string;
  code: string;
};

export type SalesTeamItem = {
  id: string;
  organization_id: string;
  organization_name: string | null;
  unit_id: string | null;
  unit_name: string | null;
  manager_user_id: string | null;
  manager_user_name: string | null;
  name: string;
  code: string;
  created_at: string;
  member_count: number;
};

export type CreateSalesTeamRequest = {
  organization_id?: string | null;
  unit_id?: string | null;
  manager_user_id?: string | null;
  name: string;
  code: string;
};

export type CreateUserRequest = {
  name: string;
  email: string;
  password: string;
  role: string;
  organization_id: string | null;
  team_id: string | null;
};

export type UpdateUserRequest = {
  name?: string;
  email?: string;
  role?: string;
  organization_id?: string | null;
  team_id?: string | null;
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

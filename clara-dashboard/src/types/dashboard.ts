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
  kpi_summary: {
    reply_sent_rate: number;
    analysis_coverage_rate: number;
    approved_reply_rate: number;
    high_risk_conversation_count: number;
  };
  generated_at: string;
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
    actor_email: string | null;
    actor_role: string | null;
    action: string;
    resource_type: string;
    resource_id: string | null;
    created_at: string;
  }[];
  recent_product_knowledge: {
    id: string;
    organization_id: string;
    title: string;
    category: string;
    source_type: string;
    is_active: boolean;
    updated_at: string;
  }[];
  recent_snapshots: {
    id: string;
    organization_id: string | null;
    scope_type: string;
    snapshot_type: string;
    period_start: string;
    period_end: string;
    total_conversations: number;
    total_analyzed_conversations: number;
    created_at: string;
  }[];
};

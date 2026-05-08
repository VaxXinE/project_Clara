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
  title: string;
  source: string;
  status: string;
  started_at: string | null;
  last_message_at: string | null;
  messages: SalesConversationMessage[];
  latest_ai_extraction: DashboardAIExtractionSummary | null;
  latest_reply_suggestion: DashboardReplySuggestionSummary | null;
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
};

export type UploadWhatsAppResponse = {
  conversation_id: string;
  message_count: number;
  status: string;
};
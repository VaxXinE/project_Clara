from datetime import datetime
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


class SalesInboxItem(BaseModel):
    conversation_id: UUID
    title: str
    source: str
    status: str
    started_at: datetime | None
    last_message_at: datetime | None
    created_at: datetime

    latest_message: DashboardLatestMessage | None
    latest_ai_extraction: DashboardAIExtractionSummary | None
    latest_reply_suggestion: DashboardReplySuggestionSummary | None

    ui_status: str
    priority_score: int


class SalesConversationDetail(BaseModel):
    conversation_id: UUID
    title: str
    source: str
    status: str
    started_at: datetime | None
    last_message_at: datetime | None

    messages: list[dict]
    latest_ai_extraction: DashboardAIExtractionSummary | None
    latest_reply_suggestion: DashboardReplySuggestionSummary | None


class MarketingObjectionInsight(BaseModel):
    topic: str
    count: int


class MarketingInsightsPreview(BaseModel):
    total_conversations: int
    total_analyzed_conversations: int
    top_objections: list[MarketingObjectionInsight]
    lead_temperature_breakdown: dict[str, int]
    risk_level_breakdown: dict[str, int]
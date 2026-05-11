from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class BudgetSignal(BaseModel):
    detected: bool
    amount_text: str | None = None
    notes: str


class RecommendedReplyStrategy(BaseModel):
    tone: Literal["friendly", "professional", "empathetic", "urgent"]
    key_points: list[str] = Field(default_factory=list)
    avoid_topics: list[str] = Field(default_factory=list)


class AIExtractionCreate(BaseModel):
    lead_temperature: Literal["cold", "warm", "hot"]
    pipeline_stage: Literal[
        "new_lead",
        "qualification",
        "education",
        "objection",
        "negotiation",
        "closing",
        "won",
        "lost",
        "unknown",
    ]
    buying_intent: Literal["low", "medium", "high"]
    sentiment: Literal["positive", "neutral", "cautious", "negative", "angry"]
    risk_level: Literal["low", "medium", "high"]

    main_objections: list[str] = Field(default_factory=list, max_length=10)
    budget_signal: BudgetSignal
    recommended_reply_strategy: RecommendedReplyStrategy

    customer_summary: str = Field(min_length=1, max_length=1000)
    next_best_action: str = Field(min_length=1, max_length=1000)
    content_insight: str = Field(min_length=1, max_length=1000)
    internal_notes: str = Field(min_length=1, max_length=1000)

    confidence_score: float = Field(ge=0.0, le=1.0)


class AIExtractionResponse(BaseModel):
    id: UUID
    conversation_id: UUID
    model_name: str
    schema_version: str

    lead_temperature: str
    pipeline_stage: str
    buying_intent: str
    sentiment: str
    risk_level: str

    main_objections: list[str]
    budget_signal: dict
    recommended_reply_strategy: dict

    customer_summary: str
    next_best_action: str
    content_insight: str
    internal_notes: str

    confidence_score: float
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
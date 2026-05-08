from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class SuggestedReply(BaseModel):
    tone: Literal["friendly", "professional", "empathetic", "urgent"]
    text: str = Field(min_length=1, max_length=2000)
    reasoning: str = Field(min_length=1, max_length=1000)


class ReplySuggestionCreate(BaseModel):
    suggested_replies: list[SuggestedReply] = Field(min_length=1, max_length=3)


class ReplySuggestionResponse(BaseModel):
    id: UUID
    conversation_id: UUID
    ai_extraction_id: UUID
    model_name: str
    schema_version: str

    risk_level: str
    action_mode: str
    approval_status: str

    suggested_replies: list[dict]
    policy_reasons: list[str]

    selected_reply_text: str | None
    final_reply_text: str | None

    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ApproveReplyRequest(BaseModel):
    selected_reply_text: str = Field(min_length=1, max_length=2000)
    final_reply_text: str = Field(min_length=1, max_length=2000)
    reviewer_name: str = Field(default="sales_user", max_length=255)


class RejectReplyRequest(BaseModel):
    reason: str = Field(min_length=1, max_length=1000)
    reviewer_name: str = Field(default="sales_user", max_length=255)


class ApprovalLogResponse(BaseModel):
    id: UUID
    reply_suggestion_id: UUID
    reviewer_name: str
    action: str
    before_text: str | None
    after_text: str | None
    reason: str | None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
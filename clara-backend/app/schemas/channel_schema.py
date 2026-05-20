from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel


class ChannelDefinitionItem(BaseModel):
    key: str
    label: str
    description: str
    supports_file_upload: bool
    supports_text_paste: bool
    supports_live_sync: bool
    file_endpoint: str | None
    text_endpoint: str | None
    supported_sources: list[str]
    sample_hint: str


class ChannelDetectRequest(BaseModel):
    raw_text: str


class ChannelDetectCandidate(BaseModel):
    channel: str
    label: str
    confidence: float
    matched_message_count: int
    reason: str


class ChannelDetectResponse(BaseModel):
    detected_channel: str | None
    candidates: list[ChannelDetectCandidate]


class ChannelOverviewItem(BaseModel):
    key: str
    label: str
    description: str
    supports_file_upload: bool
    supports_text_paste: bool
    supports_live_sync: bool
    supported_sources: list[str]
    conversation_count: int
    lead_count: int
    latest_activity_at: datetime | None


class ChannelOverviewResponse(BaseModel):
    generated_at: datetime
    scope_type: str
    items: list[ChannelOverviewItem]

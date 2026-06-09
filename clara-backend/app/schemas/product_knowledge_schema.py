from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class ProductKnowledgeCreateRequest(BaseModel):
    title: str = Field(min_length=1, max_length=255)
    category: str = Field(default="general", min_length=1, max_length=100)
    content: str = Field(min_length=1, max_length=5000)
    source_type: str = Field(default="manual_note", min_length=1, max_length=50)
    is_active: bool = True


class ProductKnowledgeUpdateRequest(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=255)
    category: str | None = Field(default=None, min_length=1, max_length=100)
    content: str | None = Field(default=None, min_length=1, max_length=5000)
    source_type: str | None = Field(default=None, min_length=1, max_length=50)
    is_active: bool | None = None


class ProductKnowledgeResponse(BaseModel):
    id: UUID
    organization_id: UUID | None
    scope_type: str
    created_by_user_id: UUID | None
    created_by_user_name: str | None
    title: str
    category: str
    content: str
    source_type: str
    is_active: bool
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class KnowledgeUpdateProposalUpsertRequest(BaseModel):
    title: str = Field(min_length=1, max_length=255)
    category: str = Field(default="general", min_length=1, max_length=100)
    proposed_content: str = Field(min_length=1, max_length=5000)
    source_type: str = Field(default="coaching_case", min_length=1, max_length=50)
    rationale: str | None = Field(default=None, min_length=1, max_length=3000)
    status: str = Field(default="draft", min_length=1, max_length=50)


class KnowledgeUpdateProposalReviewRequest(BaseModel):
    status: str = Field(min_length=1, max_length=50)
    review_decision_note: str | None = Field(
        default=None,
        min_length=1,
        max_length=3000,
    )


class KnowledgeUpdateProposalResponse(BaseModel):
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

    model_config = ConfigDict(from_attributes=True)

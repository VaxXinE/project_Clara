from datetime import datetime, timezone
from uuid import UUID, uuid4

from sqlalchemy import DateTime, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base


class KnowledgeUpdateProposal(Base):
    __tablename__ = "knowledge_update_proposals"

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    organization_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("organizations.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    conversation_id: Mapped[UUID] = mapped_column(
        ForeignKey("conversations.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
        index=True,
    )
    chat_review_case_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("chat_review_cases.id", ondelete="SET NULL"),
        nullable=True,
        unique=True,
        index=True,
    )
    lead_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("leads.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    proposed_by_user_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    reviewed_by_user_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    published_product_knowledge_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("product_knowledge.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    category: Mapped[str] = mapped_column(String(100), nullable=False, default="general")
    proposed_content: Mapped[str] = mapped_column(Text, nullable=False)
    source_type: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        default="coaching_case",
    )
    rationale: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        default="draft",
    )
    review_decision_note: Mapped[str | None] = mapped_column(Text, nullable=True)
    submitted_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    reviewed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    published_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    organization = relationship("Organization", back_populates="knowledge_update_proposals")
    conversation = relationship("Conversation", back_populates="knowledge_update_proposal")
    chat_review_case = relationship(
        "ChatReviewCase",
        back_populates="knowledge_update_proposal",
    )
    lead = relationship("Lead", back_populates="knowledge_update_proposals")
    proposed_by_user = relationship(
        "User",
        foreign_keys=[proposed_by_user_id],
        back_populates="submitted_knowledge_update_proposals",
    )
    reviewed_by_user = relationship(
        "User",
        foreign_keys=[reviewed_by_user_id],
        back_populates="reviewed_knowledge_update_proposals",
    )
    published_product_knowledge = relationship(
        "ProductKnowledge",
        back_populates="source_proposals",
    )

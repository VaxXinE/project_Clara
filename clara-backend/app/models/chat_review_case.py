from datetime import datetime, timezone
from uuid import UUID, uuid4

from sqlalchemy import DateTime, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base


class ChatReviewCase(Base):
    __tablename__ = "chat_review_cases"

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    conversation_id: Mapped[UUID] = mapped_column(
        ForeignKey("conversations.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
        index=True,
    )
    organization_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("organizations.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    lead_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("leads.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    submitted_by_user_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    reviewer_user_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    workflow_scope: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        default="admin_quality_check",
        index=True,
    )
    feedback_status: Mapped[str] = mapped_column(
        String(30),
        nullable=False,
        default="draft",
        index=True,
    )
    status: Mapped[str] = mapped_column(String(50), nullable=False, default="draft")
    review_label: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        default="needs_coaching",
    )
    review_summary: Mapped[str | None] = mapped_column(Text, nullable=True)
    coaching_focus: Mapped[str | None] = mapped_column(Text, nullable=True)
    recommended_action: Mapped[str | None] = mapped_column(Text, nullable=True)
    reviewed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    feedback_sent_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    feedback_acknowledged_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    feedback_resolved_at: Mapped[datetime | None] = mapped_column(
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

    conversation = relationship("Conversation", back_populates="chat_review_case")
    organization = relationship("Organization", back_populates="chat_review_cases")
    lead = relationship("Lead", back_populates="chat_review_cases")
    submitted_by_user = relationship(
        "User",
        foreign_keys=[submitted_by_user_id],
        back_populates="submitted_chat_review_cases",
    )
    reviewer_user = relationship(
        "User",
        foreign_keys=[reviewer_user_id],
        back_populates="assigned_chat_review_cases",
    )
    notes = relationship(
        "ChatReviewNote",
        back_populates="review_case",
        cascade="all, delete-orphan",
        order_by="desc(ChatReviewNote.created_at)",
    )
    knowledge_update_proposal = relationship(
        "KnowledgeUpdateProposal",
        back_populates="chat_review_case",
        uselist=False,
    )

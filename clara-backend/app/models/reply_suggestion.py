from datetime import datetime, timezone
from uuid import UUID, uuid4

from sqlalchemy import DateTime, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base


class ReplySuggestion(Base):
    __tablename__ = "reply_suggestions"

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)

    conversation_id: Mapped[UUID] = mapped_column(
        ForeignKey("conversations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    ai_extraction_id: Mapped[UUID] = mapped_column(
        ForeignKey("ai_extractions.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    model_name: Mapped[str] = mapped_column(String(100), nullable=False)
    schema_version: Mapped[str] = mapped_column(String(50), nullable=False, default="v1")

    risk_level: Mapped[str] = mapped_column(String(20), nullable=False)
    action_mode: Mapped[str] = mapped_column(String(50), nullable=False)
    approval_status: Mapped[str] = mapped_column(String(50), nullable=False, default="pending")

    suggested_replies: Mapped[list[dict]] = mapped_column(JSONB, nullable=False, default=list)
    policy_reasons: Mapped[list[str]] = mapped_column(JSONB, nullable=False, default=list)

    selected_reply_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    final_reply_text: Mapped[str | None] = mapped_column(Text, nullable=True)

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

    conversation = relationship("Conversation", back_populates="reply_suggestions")
    approval_logs = relationship(
        "ApprovalLog",
        back_populates="reply_suggestion",
        cascade="all, delete-orphan",
    )

from datetime import datetime
from uuid import UUID, uuid4

from sqlalchemy import DateTime, Float, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base


class AIExtraction(Base):
    __tablename__ = "ai_extractions"

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)

    conversation_id: Mapped[UUID] = mapped_column(
        ForeignKey("conversations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    model_name: Mapped[str] = mapped_column(String(100), nullable=False)
    schema_version: Mapped[str] = mapped_column(String(50), nullable=False, default="v1")

    lead_temperature: Mapped[str] = mapped_column(String(20), nullable=False)
    pipeline_stage: Mapped[str] = mapped_column(String(50), nullable=False)
    buying_intent: Mapped[str] = mapped_column(String(20), nullable=False)
    sentiment: Mapped[str] = mapped_column(String(30), nullable=False)
    risk_level: Mapped[str] = mapped_column(String(20), nullable=False)

    main_objections: Mapped[list[str]] = mapped_column(JSONB, nullable=False, default=list)
    budget_signal: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    recommended_reply_strategy: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)

    customer_summary: Mapped[str] = mapped_column(Text, nullable=False)
    next_best_action: Mapped[str] = mapped_column(Text, nullable=False)
    content_insight: Mapped[str] = mapped_column(Text, nullable=False)
    internal_notes: Mapped[str] = mapped_column(Text, nullable=False)

    confidence_score: Mapped[float] = mapped_column(Float, nullable=False)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=datetime.utcnow,
        nullable=False,
    )

    conversation = relationship("Conversation", back_populates="ai_extractions")
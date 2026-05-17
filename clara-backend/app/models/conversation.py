from datetime import datetime, timezone
from uuid import UUID, uuid4

from sqlalchemy import DateTime, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base


class Conversation(Base):
    __tablename__ = "conversations"

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)

    organization_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("organizations.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    sales_user_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    lead_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("leads.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    source: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        default="whatsapp_txt",
    )
    status: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        default="uploaded",
    )

    current_stage: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        default="unknown",
    )
    lead_temperature: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        default="unknown",
    )

    raw_filename: Mapped[str | None] = mapped_column(String(255), nullable=True)
    raw_text: Mapped[str | None] = mapped_column(Text, nullable=True)

    started_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    last_message_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
    organization = relationship("Organization", back_populates="conversations")
    sales_user = relationship(
        "User",
        back_populates="conversations_owned",
        foreign_keys=[sales_user_id],
        overlaps="conversations_owned",
    )
    lead = relationship("Lead", back_populates="conversations")

    messages = relationship(
        "Message",
        back_populates="conversation",
        cascade="all, delete-orphan",
    )
    ai_extractions = relationship(
        "AIExtraction",
        back_populates="conversation",
        cascade="all, delete-orphan",
    )
    reply_suggestions = relationship(
        "ReplySuggestion",
        back_populates="conversation",
        cascade="all, delete-orphan",
    )

    sent_messages = relationship(
        "SentMessage",
        back_populates="conversation",
        cascade="all, delete-orphan",
    )

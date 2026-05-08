from datetime import datetime
from uuid import UUID, uuid4

from sqlalchemy import DateTime, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base


class Conversation(Base):
    __tablename__ = "conversations"

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)

    title: Mapped[str] = mapped_column(String(255), nullable=False)
    source: Mapped[str] = mapped_column(String(50), nullable=False, default="whatsapp_txt")
    status: Mapped[str] = mapped_column(String(50), nullable=False, default="uploaded")

    current_stage: Mapped[str] = mapped_column(String(50), nullable=False, default="unknown")
    lead_temperature: Mapped[str] = mapped_column(String(20), nullable=False, default="unknown")

    raw_filename: Mapped[str | None] = mapped_column(String(255), nullable=True)
    raw_text: Mapped[str | None] = mapped_column(Text, nullable=True)

    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    last_message_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=datetime.utcnow,
        nullable=False,
    )

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
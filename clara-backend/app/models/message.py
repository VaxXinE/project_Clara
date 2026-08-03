from datetime import datetime, timezone
from uuid import UUID, uuid4

from sqlalchemy import DateTime, ForeignKey, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base


class Message(Base):
    __tablename__ = "messages"
    __table_args__ = (
        UniqueConstraint(
            "provider",
            "channel",
            "external_message_id",
            name="uq_messages_provider_channel_external_message_id",
        ),
    )

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)

    conversation_id: Mapped[UUID] = mapped_column(
        ForeignKey("conversations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    sender_name: Mapped[str] = mapped_column(String(255), nullable=False)
    sender_type: Mapped[str] = mapped_column(String(50), nullable=False)
    channel: Mapped[str | None] = mapped_column(String(50), nullable=True, index=True)
    provider: Mapped[str | None] = mapped_column(String(50), nullable=True, index=True)
    external_message_id: Mapped[str | None] = mapped_column(
        String(255),
        nullable=True,
        index=True,
    )
    fingerprint: Mapped[str | None] = mapped_column(String(255), nullable=True, index=True)
    message_text: Mapped[str] = mapped_column(Text, nullable=False)
    reply_context_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    reply_context_sender_name: Mapped[str | None] = mapped_column(
        String(255),
        nullable=True,
    )
    reply_context_sender_type: Mapped[str | None] = mapped_column(
        String(50),
        nullable=True,
    )
    message_timestamp: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    conversation = relationship("Conversation", back_populates="messages")

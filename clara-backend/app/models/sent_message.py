from datetime import datetime
from uuid import UUID, uuid4

from sqlalchemy import DateTime, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base


class SentMessage(Base):
    __tablename__ = "sent_messages"

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)

    conversation_id: Mapped[UUID] = mapped_column(
        ForeignKey("conversations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    reply_suggestion_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("reply_suggestions.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    send_mode: Mapped[str] = mapped_column(String(50), nullable=False, default="manual_simulation")
    message_text: Mapped[str] = mapped_column(Text, nullable=False)

    sent_by_name: Mapped[str] = mapped_column(String(255), nullable=False, default="sales_user")
    external_message_id: Mapped[str | None] = mapped_column(String(255), nullable=True)

    sent_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=datetime.utcnow,
        nullable=False,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=datetime.utcnow,
        nullable=False,
    )

    conversation = relationship("Conversation", back_populates="sent_messages")
from datetime import datetime, timezone
from uuid import UUID, uuid4

from sqlalchemy import DateTime, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base


class ChatReviewNote(Base):
    __tablename__ = "chat_review_notes"

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    review_case_id: Mapped[UUID] = mapped_column(
        ForeignKey("chat_review_cases.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    author_user_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    note_type: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        default="manager_note",
    )
    body: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    review_case = relationship("ChatReviewCase", back_populates="notes")
    author_user = relationship("User", back_populates="chat_review_notes")

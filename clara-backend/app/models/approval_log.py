from datetime import datetime
from uuid import UUID, uuid4

from sqlalchemy import DateTime, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base


class ApprovalLog(Base):
    __tablename__ = "approval_logs"

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)

    reply_suggestion_id: Mapped[UUID] = mapped_column(
        ForeignKey("reply_suggestions.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    reviewer_name: Mapped[str] = mapped_column(String(255), nullable=False, default="sales_user")
    action: Mapped[str] = mapped_column(String(50), nullable=False)

    before_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    after_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    reason: Mapped[str | None] = mapped_column(Text, nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=datetime.utcnow,
        nullable=False,
    )

    reply_suggestion = relationship("ReplySuggestion", back_populates="approval_logs")
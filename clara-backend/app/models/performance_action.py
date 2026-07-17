from datetime import datetime, timezone
from uuid import UUID, uuid4

from sqlalchemy import DateTime, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base


class PerformanceAction(Base):
    __tablename__ = "performance_actions"

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)

    organization_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("organizations.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )
    created_by_user_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    assigned_to_user_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    team_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("sales_teams.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    sales_user_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    source_type: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    source_reference_id: Mapped[UUID | None] = mapped_column(nullable=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    action_type: Mapped[str] = mapped_column(String(50), nullable=False)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="open", index=True)
    priority_label: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        default="normal",
        index=True,
    )
    due_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    resolution_note: Mapped[str | None] = mapped_column(Text, nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
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

    organization = relationship("Organization", back_populates="performance_actions")
    created_by_user = relationship(
        "User",
        foreign_keys=[created_by_user_id],
        back_populates="created_performance_actions",
    )
    assigned_to_user = relationship(
        "User",
        foreign_keys=[assigned_to_user_id],
        back_populates="assigned_performance_actions",
    )
    sales_user = relationship(
        "User",
        foreign_keys=[sales_user_id],
        back_populates="performance_actions_for_sales",
    )
    team = relationship("SalesTeam", back_populates="performance_actions")

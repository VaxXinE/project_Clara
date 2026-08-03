from datetime import datetime, timezone
from uuid import UUID, uuid4

from sqlalchemy import JSON, DateTime, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base


class OpsNotification(Base):
    __tablename__ = "ops_notifications"

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)

    organization_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("organizations.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )
    user_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )
    acknowledged_by_user_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    resolved_by_user_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    ignored_by_user_id: Mapped[UUID | None] = mapped_column(
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
    source_key: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    source_reference_id: Mapped[UUID | None] = mapped_column(nullable=True, index=True)
    alert_type: Mapped[str | None] = mapped_column(String(50), nullable=True, index=True)
    workflow_scope: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        default="ops_oversight",
        index=True,
    )
    owner_role: Mapped[str] = mapped_column(
        String(30),
        nullable=False,
        default="sales",
    )
    target_role: Mapped[str] = mapped_column(
        String(30),
        nullable=False,
        default="sales",
    )
    severity: Mapped[str] = mapped_column(String(20), nullable=False, default="medium")
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    body: Mapped[str] = mapped_column(Text, nullable=False)
    target_href: Mapped[str | None] = mapped_column(String(255), nullable=True)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="active")
    delivery_channel: Mapped[str] = mapped_column(String(30), nullable=False, default="in_app")
    delivery_status: Mapped[str] = mapped_column(String(20), nullable=False, default="pending")
    escalation_level: Mapped[str] = mapped_column(String(20), nullable=False, default="none")
    resolution_note: Mapped[str | None] = mapped_column(Text, nullable=True)
    metadata_json: Mapped[dict | None] = mapped_column(JSON, nullable=True)

    acknowledged_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    triggered_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    delivered_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    escalated_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    resolved_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    ignored_at: Mapped[datetime | None] = mapped_column(
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

    organization = relationship("Organization", back_populates="ops_notifications")
    user = relationship(
        "User",
        foreign_keys=[user_id],
        back_populates="ops_notifications",
    )
    acknowledged_by_user = relationship(
        "User",
        foreign_keys=[acknowledged_by_user_id],
        back_populates="acknowledged_ops_notifications",
    )

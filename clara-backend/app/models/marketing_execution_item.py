from datetime import datetime, timezone
from uuid import UUID, uuid4

from sqlalchemy import DateTime, ForeignKey, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base


class MarketingExecutionItem(Base):
    __tablename__ = "marketing_execution_items"

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    organization_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("organizations.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    created_by_user_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    assigned_user_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    item_type: Mapped[str] = mapped_column(String(50), nullable=False)
    source_kind: Mapped[str] = mapped_column(String(50), nullable=False)
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="draft")
    priority: Mapped[str] = mapped_column(String(20), nullable=False, default="medium")
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    summary: Mapped[str] = mapped_column(Text, nullable=False)
    recommended_action: Mapped[str] = mapped_column(Text, nullable=False)
    campaign_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    result_notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    published_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    leads_generated: Mapped[int] = mapped_column(nullable=False, default=0)
    qualified_leads: Mapped[int] = mapped_column(nullable=False, default=0)
    won_leads: Mapped[int] = mapped_column(nullable=False, default=0)
    attributed_pipeline_value: Mapped[float] = mapped_column(
        Numeric(18, 2),
        nullable=False,
        default=0,
    )
    attributed_won_value: Mapped[float] = mapped_column(
        Numeric(18, 2),
        nullable=False,
        default=0,
    )
    attributed_deposit_amount: Mapped[float] = mapped_column(
        Numeric(18, 2),
        nullable=False,
        default=0,
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

    organization = relationship("Organization", back_populates="marketing_execution_items")
    created_by_user = relationship(
        "User",
        back_populates="created_marketing_execution_items",
        foreign_keys=[created_by_user_id],
    )
    assigned_user = relationship(
        "User",
        back_populates="assigned_marketing_execution_items",
        foreign_keys=[assigned_user_id],
    )

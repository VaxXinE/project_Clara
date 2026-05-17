from datetime import datetime, timezone
from uuid import UUID, uuid4

from sqlalchemy import Boolean, DateTime, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base


class User(Base):
    __tablename__ = "users"

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

    name: Mapped[str] = mapped_column(String(255), nullable=False)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)

    role: Mapped[str] = mapped_column(String(50), nullable=False, default="marketing")
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    organization = relationship("Organization", back_populates="users")
    created_by_user = relationship(
        "User",
        back_populates="created_users",
        remote_side=[id],
        foreign_keys=[created_by_user_id],
    )
    created_users = relationship(
        "User",
        back_populates="created_by_user",
        foreign_keys=[created_by_user_id],
        overlaps="created_by_user",
    )
    conversations_owned = relationship(
        "Conversation",
        back_populates="sales_user",
        foreign_keys="Conversation.sales_user_id",
        overlaps="sales_user",
    )
    assigned_leads = relationship(
        "Lead",
        back_populates="assigned_user",
        foreign_keys="Lead.assigned_user_id",
    )
    assigned_tasks = relationship(
        "LeadTask",
        foreign_keys="LeadTask.assigned_user_id",
        back_populates="assigned_user",
    )
    completed_tasks = relationship(
        "LeadTask",
        foreign_keys="LeadTask.completed_by_user_id",
        back_populates="completed_by_user",
    )
    lead_task_events = relationship(
        "LeadTaskEvent",
        foreign_keys="LeadTaskEvent.actor_user_id",
        back_populates="actor_user",
    )
    lead_activity_events = relationship(
        "LeadActivityEvent",
        foreign_keys="LeadActivityEvent.actor_user_id",
        back_populates="actor_user",
    )
    owned_lead_deals = relationship(
        "LeadDeal",
        foreign_keys="LeadDeal.owner_user_id",
        back_populates="owner_user",
    )
    created_marketing_execution_items = relationship(
        "MarketingExecutionItem",
        foreign_keys="MarketingExecutionItem.created_by_user_id",
        back_populates="created_by_user",
    )
    assigned_marketing_execution_items = relationship(
        "MarketingExecutionItem",
        foreign_keys="MarketingExecutionItem.assigned_user_id",
        back_populates="assigned_user",
    )

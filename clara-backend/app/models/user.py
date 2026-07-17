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
    team_id: Mapped[UUID | None] = mapped_column(
        ForeignKey(
            "sales_teams.id",
            ondelete="SET NULL",
            use_alter=True,
            name="fk_users_team_id_sales_teams",
        ),
        nullable=True,
        index=True,
    )

    name: Mapped[str] = mapped_column(String(255), nullable=False)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)

    role: Mapped[str] = mapped_column(String(50), nullable=False, default="sales")
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    organization = relationship("Organization", back_populates="users")
    sales_team = relationship(
        "SalesTeam",
        back_populates="members",
        foreign_keys=[team_id],
    )
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
    customer_profiles = relationship(
        "CustomerProfile",
        foreign_keys="CustomerProfile.assigned_user_id",
        back_populates="assigned_user",
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
    lead_discipline_logs = relationship(
        "LeadDisciplineLog",
        foreign_keys="LeadDisciplineLog.actor_user_id",
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
    ops_notifications = relationship(
        "OpsNotification",
        foreign_keys="OpsNotification.user_id",
        back_populates="user",
    )
    acknowledged_ops_notifications = relationship(
        "OpsNotification",
        foreign_keys="OpsNotification.acknowledged_by_user_id",
        back_populates="acknowledged_by_user",
    )
    created_performance_actions = relationship(
        "PerformanceAction",
        foreign_keys="PerformanceAction.created_by_user_id",
        back_populates="created_by_user",
    )
    assigned_performance_actions = relationship(
        "PerformanceAction",
        foreign_keys="PerformanceAction.assigned_to_user_id",
        back_populates="assigned_to_user",
    )
    performance_actions_for_sales = relationship(
        "PerformanceAction",
        foreign_keys="PerformanceAction.sales_user_id",
        back_populates="sales_user",
    )
    sales_performance_snapshots = relationship(
        "SalesPerformanceSnapshot",
        foreign_keys="SalesPerformanceSnapshot.sales_user_id",
        back_populates="sales_user",
    )
    managed_sales_teams = relationship(
        "SalesTeam",
        back_populates="manager_user",
        foreign_keys="SalesTeam.manager_user_id",
    )
    submitted_chat_review_cases = relationship(
        "ChatReviewCase",
        foreign_keys="ChatReviewCase.submitted_by_user_id",
        back_populates="submitted_by_user",
    )
    assigned_chat_review_cases = relationship(
        "ChatReviewCase",
        foreign_keys="ChatReviewCase.reviewer_user_id",
        back_populates="reviewer_user",
    )
    chat_review_notes = relationship(
        "ChatReviewNote",
        foreign_keys="ChatReviewNote.author_user_id",
        back_populates="author_user",
    )
    submitted_knowledge_update_proposals = relationship(
        "KnowledgeUpdateProposal",
        foreign_keys="KnowledgeUpdateProposal.proposed_by_user_id",
        back_populates="proposed_by_user",
    )
    reviewed_knowledge_update_proposals = relationship(
        "KnowledgeUpdateProposal",
        foreign_keys="KnowledgeUpdateProposal.reviewed_by_user_id",
        back_populates="reviewed_by_user",
    )

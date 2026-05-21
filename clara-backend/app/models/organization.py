from datetime import datetime, timezone
from uuid import UUID, uuid4

from sqlalchemy import DateTime, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base


class Organization(Base):
    __tablename__ = "organizations"

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)

    name: Mapped[str] = mapped_column(String(255), nullable=False)
    slug: Mapped[str] = mapped_column(String(100), unique=True, index=True, nullable=False)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    users = relationship("User", back_populates="organization")
    sales_units = relationship(
        "SalesUnit",
        back_populates="organization",
        cascade="all, delete-orphan",
    )
    sales_teams = relationship(
        "SalesTeam",
        back_populates="organization",
        cascade="all, delete-orphan",
    )
    customer_profiles = relationship("CustomerProfile", back_populates="organization")
    leads = relationship("Lead", back_populates="organization")
    lead_deals = relationship("LeadDeal", back_populates="organization")
    lead_activity_events = relationship(
        "LeadActivityEvent",
        back_populates="organization",
    )
    lead_discipline_logs = relationship(
        "LeadDisciplineLog",
        back_populates="organization",
    )
    chat_review_cases = relationship(
        "ChatReviewCase",
        back_populates="organization",
    )
    knowledge_update_proposals = relationship(
        "KnowledgeUpdateProposal",
        back_populates="organization",
    )
    marketing_execution_items = relationship(
        "MarketingExecutionItem",
        back_populates="organization",
    )
    conversations = relationship("Conversation", back_populates="organization")
    lead_tasks = relationship("LeadTask", back_populates="organization")
    ops_notifications = relationship(
        "OpsNotification",
        back_populates="organization",
        cascade="all, delete-orphan",
    )

from datetime import date, datetime, timezone
from uuid import UUID, uuid4

from sqlalchemy import Date, DateTime, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base


class TeamPerformanceSnapshot(Base):
    __tablename__ = "team_performance_snapshots"
    __table_args__ = (
        UniqueConstraint(
            "organization_id",
            "team_id",
            "snapshot_date",
            "snapshot_granularity",
            name="uq_team_performance_snapshots_scope",
        ),
    )

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    organization_id: Mapped[UUID] = mapped_column(
        ForeignKey("organizations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    team_id: Mapped[UUID] = mapped_column(
        ForeignKey("sales_teams.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    unit_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("sales_units.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    snapshot_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    snapshot_granularity: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        index=True,
        default="weekly",
    )
    member_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    active_leads_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    needs_reply_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    overdue_follow_up_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    hot_leads_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    analyzed_conversations_count: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=0,
    )
    needs_analysis_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    won_deals_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    avg_response_sla_status: Mapped[str] = mapped_column(String(50), nullable=False)
    crm_discipline_status: Mapped[str] = mapped_column(String(50), nullable=False)
    coaching_priority_score: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    coaching_priority_label: Mapped[str] = mapped_column(String(50), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    organization = relationship("Organization", back_populates="team_performance_snapshots")
    team = relationship("SalesTeam", back_populates="team_performance_snapshots")

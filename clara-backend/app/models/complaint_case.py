from datetime import datetime, timezone
from uuid import UUID, uuid4

from sqlalchemy import DateTime, ForeignKey, Integer, JSON, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base


class ComplaintCase(Base):
    __tablename__ = "complaint_cases"

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    organization_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("organizations.id", ondelete="CASCADE"), nullable=True, index=True
    )
    customer_profile_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("customer_profiles.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    conversation_id: Mapped[UUID] = mapped_column(
        ForeignKey("conversations.id", ondelete="CASCADE"), nullable=False, index=True
    )
    lead_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("leads.id", ondelete="SET NULL"), nullable=True, index=True
    )
    source_channel: Mapped[str | None] = mapped_column(String(50), nullable=True)
    source_reference: Mapped[str | None] = mapped_column(String(255), nullable=True)
    category: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    severity: Mapped[str] = mapped_column(
        String(20), nullable=False, default="MEDIUM", index=True
    )
    status: Mapped[str] = mapped_column(
        String(30), nullable=False, default="OPEN", index=True
    )
    safe_summary: Mapped[str] = mapped_column(Text, nullable=False)
    requested_outcome: Mapped[str | None] = mapped_column(Text, nullable=True)
    affected_process_state: Mapped[str | None] = mapped_column(
        String(40), nullable=True
    )
    assigned_user_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True
    )
    reviewer_requirement: Mapped[str] = mapped_column(String(50), nullable=False)
    policy_decision_hash: Mapped[str | None] = mapped_column(String(64), nullable=True)
    handoff_content_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    fingerprint: Mapped[str] = mapped_column(
        String(64), nullable=False, unique=True, index=True
    )
    issue_signature: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    incident_bucket: Mapped[str] = mapped_column(String(30), nullable=False, index=True)
    first_seen_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )
    last_seen_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )
    resolved_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    closed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    version: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
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
    events = relationship(
        "ComplaintCaseEvent",
        cascade="all, delete-orphan",
        order_by="ComplaintCaseEvent.created_at",
    )


class ComplaintCaseEvent(Base):
    __tablename__ = "complaint_case_events"

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    complaint_case_id: Mapped[UUID] = mapped_column(
        ForeignKey("complaint_cases.id", ondelete="CASCADE"), nullable=False, index=True
    )
    previous_status: Mapped[str | None] = mapped_column(String(30), nullable=True)
    new_status: Mapped[str] = mapped_column(String(30), nullable=False)
    event_type: Mapped[str] = mapped_column(String(50), nullable=False)
    reason_codes: Mapped[list[str]] = mapped_column(JSON, nullable=False, default=list)
    actor_user_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    source_reference: Mapped[str | None] = mapped_column(String(255), nullable=True)
    safe_metadata: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

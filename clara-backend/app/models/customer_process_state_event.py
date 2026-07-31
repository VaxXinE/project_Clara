from datetime import datetime, timezone
from uuid import UUID, uuid4

from sqlalchemy import DateTime, Float, ForeignKey, JSON, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base


class CustomerProcessStateEvent(Base):
    __tablename__ = "customer_process_state_events"

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    process_state_id: Mapped[UUID] = mapped_column(
        ForeignKey("customer_process_states.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    customer_profile_id: Mapped[UUID] = mapped_column(
        ForeignKey("customer_profiles.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    organization_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("organizations.id", ondelete="CASCADE"), nullable=True, index=True
    )
    previous_state: Mapped[str] = mapped_column(String(40), nullable=False)
    proposed_state: Mapped[str] = mapped_column(String(40), nullable=False)
    applied_state: Mapped[str] = mapped_column(String(40), nullable=False)
    decision: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    transition_type: Mapped[str] = mapped_column(String(50), nullable=False)
    source_type: Mapped[str] = mapped_column(String(50), nullable=False)
    source_reference_type: Mapped[str | None] = mapped_column(String(50), nullable=True)
    source_reference_id: Mapped[UUID | None] = mapped_column(nullable=True)
    evidence_codes: Mapped[list[str]] = mapped_column(JSON, nullable=False, default=list)
    confidence_score: Mapped[float] = mapped_column(Float, nullable=False)
    source_trust_level: Mapped[str] = mapped_column(String(20), nullable=False)
    actor_user_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    reason_codes: Mapped[list[str]] = mapped_column(JSON, nullable=False, default=list)
    correlation_id: Mapped[str | None] = mapped_column(String(100), nullable=True, index=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    process_state = relationship("CustomerProcessState", back_populates="events")

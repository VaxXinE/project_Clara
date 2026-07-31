from datetime import datetime, timezone
from uuid import UUID, uuid4

from sqlalchemy import (
    Boolean,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base


class CustomerProcessState(Base):
    __tablename__ = "customer_process_states"
    __table_args__ = (
        UniqueConstraint(
            "customer_profile_id",
            name="uq_customer_process_states_customer_profile_id",
        ),
    )

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    organization_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("organizations.id", ondelete="CASCADE"), nullable=True, index=True
    )
    customer_profile_id: Mapped[UUID] = mapped_column(
        ForeignKey("customer_profiles.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    current_state: Mapped[str] = mapped_column(
        String(40), nullable=False, default="UNKNOWN"
    )
    state_rank: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    confidence_score: Mapped[float] = mapped_column(Float, nullable=False, default=0)
    source_type: Mapped[str] = mapped_column(
        String(50), nullable=False, default="MIGRATION_BACKFILL"
    )
    source_reference_type: Mapped[str | None] = mapped_column(String(50), nullable=True)
    source_reference_id: Mapped[UUID | None] = mapped_column(nullable=True)
    source_trust_level: Mapped[str] = mapped_column(
        String(20), nullable=False, default="LOW"
    )
    version: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    manual_lock: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    last_confirmed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    last_transition_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
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

    customer_profile = relationship("CustomerProfile", back_populates="process_state")
    events = relationship(
        "CustomerProcessStateEvent",
        back_populates="process_state",
        order_by="desc(CustomerProcessStateEvent.created_at)",
        passive_deletes=True,
    )

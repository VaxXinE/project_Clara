from datetime import datetime, timezone
from uuid import UUID, uuid4

from sqlalchemy import DateTime, Float, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base


class CustomerProfile(Base):
    __tablename__ = "customer_profiles"

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)

    organization_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("organizations.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    assigned_user_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    display_name: Mapped[str] = mapped_column(String(255), nullable=False)
    phone: Mapped[str | None] = mapped_column(String(50), nullable=True)
    email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    address: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="active")
    canonical_key: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    identity_confidence: Mapped[float] = mapped_column(Float, nullable=False, default=0.92)
    match_strategy: Mapped[str] = mapped_column(String(50), nullable=False, default="name_exact")
    merge_notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    merged_into_profile_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("customer_profiles.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    last_contact_at: Mapped[datetime | None] = mapped_column(
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

    organization = relationship("Organization", back_populates="customer_profiles")
    assigned_user = relationship("User", back_populates="customer_profiles")
    leads = relationship("Lead", back_populates="customer_profile")
    merged_into_profile = relationship(
        "CustomerProfile",
        remote_side=[id],
        backref="merged_profiles",
    )

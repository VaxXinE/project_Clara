from datetime import datetime, timezone
from uuid import UUID, uuid4

from sqlalchemy import DateTime, ForeignKey, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base


class SalesUnit(Base):
    __tablename__ = "sales_units"
    __table_args__ = (
        UniqueConstraint("organization_id", "name", name="uq_sales_units_org_name"),
        UniqueConstraint("organization_id", "code", name="uq_sales_units_org_code"),
    )

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    organization_id: Mapped[UUID] = mapped_column(
        ForeignKey("organizations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    code: Mapped[str] = mapped_column(String(100), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    organization = relationship("Organization", back_populates="sales_units")
    teams = relationship(
        "SalesTeam",
        back_populates="unit",
        cascade="all, delete-orphan",
    )

from datetime import datetime, timezone
from uuid import UUID, uuid4

from sqlalchemy import DateTime, ForeignKey, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base


class SalesTeam(Base):
    __tablename__ = "sales_teams"
    __table_args__ = (
        UniqueConstraint("organization_id", "name", name="uq_sales_teams_org_name"),
        UniqueConstraint("organization_id", "code", name="uq_sales_teams_org_code"),
    )

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    organization_id: Mapped[UUID] = mapped_column(
        ForeignKey("organizations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    unit_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("sales_units.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    manager_user_id: Mapped[UUID | None] = mapped_column(
        ForeignKey(
            "users.id",
            ondelete="SET NULL",
            use_alter=True,
            name="fk_sales_teams_manager_user_id_users",
        ),
        nullable=True,
        index=True,
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    code: Mapped[str] = mapped_column(String(100), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    organization = relationship("Organization", back_populates="sales_teams")
    unit = relationship("SalesUnit", back_populates="teams")
    manager_user = relationship(
        "User",
        back_populates="managed_sales_teams",
        foreign_keys=[manager_user_id],
    )
    members = relationship(
        "User",
        back_populates="sales_team",
        foreign_keys="User.team_id",
    )

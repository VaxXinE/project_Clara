from datetime import datetime, timezone
from uuid import UUID, uuid4

from sqlalchemy import DateTime, ForeignKey, String
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.db.session import Base


class KpiCommandSnapshot(Base):
    __tablename__ = "kpi_command_snapshots"

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    organization_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("organizations.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )
    scope_type: Mapped[str] = mapped_column(String(20), nullable=False, index=True)
    snapshot_type: Mapped[str] = mapped_column(
        String(30),
        nullable=False,
        default="manual_refresh",
    )
    metrics_json: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    observations_json: Mapped[list] = mapped_column(JSONB, nullable=False, default=list)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

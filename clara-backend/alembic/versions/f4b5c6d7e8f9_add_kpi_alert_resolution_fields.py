"""add kpi alert resolution fields

Revision ID: f4b5c6d7e8f9
Revises: e3f4a5b6c7d8
Create Date: 2026-05-18 19:40:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql


revision: str = "f4b5c6d7e8f9"
down_revision: str | Sequence[str] | None = "e3f4a5b6c7d8"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "kpi_alert_records",
        sa.Column("resolved_by_user_id", postgresql.UUID(as_uuid=True), nullable=True),
    )
    op.add_column(
        "kpi_alert_records",
        sa.Column("resolution_note", sa.Text(), nullable=True),
    )
    op.create_index(
        op.f("ix_kpi_alert_records_resolved_by_user_id"),
        "kpi_alert_records",
        ["resolved_by_user_id"],
        unique=False,
    )
    op.create_foreign_key(
        "fk_kpi_alert_records_resolved_by_user_id_users",
        "kpi_alert_records",
        "users",
        ["resolved_by_user_id"],
        ["id"],
        ondelete="SET NULL",
    )


def downgrade() -> None:
    op.drop_constraint(
        "fk_kpi_alert_records_resolved_by_user_id_users",
        "kpi_alert_records",
        type_="foreignkey",
    )
    op.drop_index(
        op.f("ix_kpi_alert_records_resolved_by_user_id"),
        table_name="kpi_alert_records",
    )
    op.drop_column("kpi_alert_records", "resolution_note")
    op.drop_column("kpi_alert_records", "resolved_by_user_id")

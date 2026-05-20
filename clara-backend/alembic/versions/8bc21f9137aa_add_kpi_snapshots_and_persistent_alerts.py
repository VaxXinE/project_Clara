"""add kpi snapshots and persistent alerts

Revision ID: 8bc21f9137aa
Revises: 496086df87c4
Create Date: 2026-05-18 01:10:00.000000
"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "8bc21f9137aa"
down_revision: str | Sequence[str] | None = "496086df87c4"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "kpi_command_snapshots",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("organization_id", sa.Uuid(), nullable=True),
        sa.Column("scope_type", sa.String(length=20), nullable=False),
        sa.Column("snapshot_type", sa.String(length=30), nullable=False),
        sa.Column("metrics_json", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("observations_json", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["organization_id"], ["organizations.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_kpi_command_snapshots_organization_id"),
        "kpi_command_snapshots",
        ["organization_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_kpi_command_snapshots_scope_type"),
        "kpi_command_snapshots",
        ["scope_type"],
        unique=False,
    )

    op.create_table(
        "kpi_alert_records",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("organization_id", sa.Uuid(), nullable=True),
        sa.Column("acknowledged_by_user_id", sa.Uuid(), nullable=True),
        sa.Column("scope_type", sa.String(length=20), nullable=False),
        sa.Column("alert_key", sa.String(length=255), nullable=False),
        sa.Column("severity", sa.String(length=20), nullable=False),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("recommended_action", sa.Text(), nullable=False),
        sa.Column("target_href", sa.String(length=255), nullable=True),
        sa.Column("status", sa.String(length=30), nullable=False),
        sa.Column("first_detected_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("last_detected_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("acknowledged_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("resolved_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["acknowledged_by_user_id"], ["users.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["organization_id"], ["organizations.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_kpi_alert_records_acknowledged_by_user_id"),
        "kpi_alert_records",
        ["acknowledged_by_user_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_kpi_alert_records_alert_key"),
        "kpi_alert_records",
        ["alert_key"],
        unique=False,
    )
    op.create_index(
        op.f("ix_kpi_alert_records_organization_id"),
        "kpi_alert_records",
        ["organization_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_kpi_alert_records_scope_type"),
        "kpi_alert_records",
        ["scope_type"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_kpi_alert_records_scope_type"), table_name="kpi_alert_records")
    op.drop_index(op.f("ix_kpi_alert_records_organization_id"), table_name="kpi_alert_records")
    op.drop_index(op.f("ix_kpi_alert_records_alert_key"), table_name="kpi_alert_records")
    op.drop_index(
        op.f("ix_kpi_alert_records_acknowledged_by_user_id"),
        table_name="kpi_alert_records",
    )
    op.drop_table("kpi_alert_records")

    op.drop_index(
        op.f("ix_kpi_command_snapshots_scope_type"),
        table_name="kpi_command_snapshots",
    )
    op.drop_index(
        op.f("ix_kpi_command_snapshots_organization_id"),
        table_name="kpi_command_snapshots",
    )
    op.drop_table("kpi_command_snapshots")

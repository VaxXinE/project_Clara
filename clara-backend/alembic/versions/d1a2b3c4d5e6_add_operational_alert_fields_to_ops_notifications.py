"""add operational alert fields to ops notifications

Revision ID: d1a2b3c4d5e6
Revises: c0d1e2f3a4b5
Create Date: 2026-07-17 11:20:00.000000
"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "d1a2b3c4d5e6"
down_revision: str | Sequence[str] | None = "c0d1e2f3a4b5"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "ops_notifications",
        sa.Column("resolved_by_user_id", postgresql.UUID(as_uuid=True), nullable=True),
    )
    op.add_column(
        "ops_notifications",
        sa.Column("ignored_by_user_id", postgresql.UUID(as_uuid=True), nullable=True),
    )
    op.add_column(
        "ops_notifications",
        sa.Column("team_id", postgresql.UUID(as_uuid=True), nullable=True),
    )
    op.add_column(
        "ops_notifications",
        sa.Column("sales_user_id", postgresql.UUID(as_uuid=True), nullable=True),
    )
    op.add_column(
        "ops_notifications",
        sa.Column("source_reference_id", postgresql.UUID(as_uuid=True), nullable=True),
    )
    op.add_column(
        "ops_notifications",
        sa.Column("alert_type", sa.String(length=50), nullable=True),
    )
    op.add_column(
        "ops_notifications",
        sa.Column("metadata_json", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
    )
    op.add_column(
        "ops_notifications",
        sa.Column("triggered_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "ops_notifications",
        sa.Column("ignored_at", sa.DateTime(timezone=True), nullable=True),
    )

    op.create_foreign_key(
        "fk_ops_notifications_resolved_by_user_id_users",
        "ops_notifications",
        "users",
        ["resolved_by_user_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_foreign_key(
        "fk_ops_notifications_ignored_by_user_id_users",
        "ops_notifications",
        "users",
        ["ignored_by_user_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_foreign_key(
        "fk_ops_notifications_team_id_sales_teams",
        "ops_notifications",
        "sales_teams",
        ["team_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_foreign_key(
        "fk_ops_notifications_sales_user_id_users",
        "ops_notifications",
        "users",
        ["sales_user_id"],
        ["id"],
        ondelete="SET NULL",
    )

    op.create_index(
        "ix_ops_notifications_resolved_by_user_id",
        "ops_notifications",
        ["resolved_by_user_id"],
        unique=False,
    )
    op.create_index(
        "ix_ops_notifications_ignored_by_user_id",
        "ops_notifications",
        ["ignored_by_user_id"],
        unique=False,
    )
    op.create_index(
        "ix_ops_notifications_team_id",
        "ops_notifications",
        ["team_id"],
        unique=False,
    )
    op.create_index(
        "ix_ops_notifications_sales_user_id",
        "ops_notifications",
        ["sales_user_id"],
        unique=False,
    )
    op.create_index(
        "ix_ops_notifications_source_reference_id",
        "ops_notifications",
        ["source_reference_id"],
        unique=False,
    )
    op.create_index(
        "ix_ops_notifications_alert_type",
        "ops_notifications",
        ["alert_type"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("ix_ops_notifications_alert_type", table_name="ops_notifications")
    op.drop_index("ix_ops_notifications_source_reference_id", table_name="ops_notifications")
    op.drop_index("ix_ops_notifications_sales_user_id", table_name="ops_notifications")
    op.drop_index("ix_ops_notifications_team_id", table_name="ops_notifications")
    op.drop_index("ix_ops_notifications_ignored_by_user_id", table_name="ops_notifications")
    op.drop_index("ix_ops_notifications_resolved_by_user_id", table_name="ops_notifications")

    op.drop_constraint(
        "fk_ops_notifications_sales_user_id_users",
        "ops_notifications",
        type_="foreignkey",
    )
    op.drop_constraint(
        "fk_ops_notifications_team_id_sales_teams",
        "ops_notifications",
        type_="foreignkey",
    )
    op.drop_constraint(
        "fk_ops_notifications_ignored_by_user_id_users",
        "ops_notifications",
        type_="foreignkey",
    )
    op.drop_constraint(
        "fk_ops_notifications_resolved_by_user_id_users",
        "ops_notifications",
        type_="foreignkey",
    )

    op.drop_column("ops_notifications", "ignored_at")
    op.drop_column("ops_notifications", "triggered_at")
    op.drop_column("ops_notifications", "metadata_json")
    op.drop_column("ops_notifications", "alert_type")
    op.drop_column("ops_notifications", "source_reference_id")
    op.drop_column("ops_notifications", "sales_user_id")
    op.drop_column("ops_notifications", "team_id")
    op.drop_column("ops_notifications", "ignored_by_user_id")
    op.drop_column("ops_notifications", "resolved_by_user_id")

"""add weekly performance snapshots

Revision ID: c0d1e2f3a4b5
Revises: b9c0d1e2f3a4
Create Date: 2026-07-17 10:00:00.000000
"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "c0d1e2f3a4b5"
down_revision: str | Sequence[str] | None = "b9c0d1e2f3a4"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "sales_performance_snapshots",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("organization_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("sales_user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("team_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("unit_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("snapshot_date", sa.Date(), nullable=False),
        sa.Column("snapshot_granularity", sa.String(length=20), nullable=False),
        sa.Column("active_leads_count", sa.Integer(), nullable=False),
        sa.Column("needs_reply_count", sa.Integer(), nullable=False),
        sa.Column("overdue_follow_up_count", sa.Integer(), nullable=False),
        sa.Column("hot_leads_count", sa.Integer(), nullable=False),
        sa.Column("analyzed_conversations_count", sa.Integer(), nullable=False),
        sa.Column("needs_analysis_count", sa.Integer(), nullable=False),
        sa.Column("won_deals_count", sa.Integer(), nullable=False),
        sa.Column("lost_deals_count", sa.Integer(), nullable=False),
        sa.Column("open_deals_count", sa.Integer(), nullable=False),
        sa.Column("avg_response_sla_status", sa.String(length=50), nullable=False),
        sa.Column("crm_discipline_status", sa.String(length=50), nullable=False),
        sa.Column("coaching_priority_score", sa.Integer(), nullable=False),
        sa.Column("coaching_priority_label", sa.String(length=50), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["organization_id"], ["organizations.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["sales_user_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["team_id"], ["sales_teams.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["unit_id"], ["sales_units.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "organization_id",
            "sales_user_id",
            "snapshot_date",
            "snapshot_granularity",
            name="uq_sales_performance_snapshots_scope",
        ),
    )
    op.create_index(
        "ix_sales_performance_snapshots_organization_id",
        "sales_performance_snapshots",
        ["organization_id"],
        unique=False,
    )
    op.create_index(
        "ix_sales_performance_snapshots_sales_user_id",
        "sales_performance_snapshots",
        ["sales_user_id"],
        unique=False,
    )
    op.create_index(
        "ix_sales_performance_snapshots_team_id",
        "sales_performance_snapshots",
        ["team_id"],
        unique=False,
    )
    op.create_index(
        "ix_sales_performance_snapshots_unit_id",
        "sales_performance_snapshots",
        ["unit_id"],
        unique=False,
    )
    op.create_index(
        "ix_sales_performance_snapshots_snapshot_date",
        "sales_performance_snapshots",
        ["snapshot_date"],
        unique=False,
    )
    op.create_index(
        "ix_sales_performance_snapshots_snapshot_granularity",
        "sales_performance_snapshots",
        ["snapshot_granularity"],
        unique=False,
    )

    op.create_table(
        "team_performance_snapshots",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("organization_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("team_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("unit_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("snapshot_date", sa.Date(), nullable=False),
        sa.Column("snapshot_granularity", sa.String(length=20), nullable=False),
        sa.Column("member_count", sa.Integer(), nullable=False),
        sa.Column("active_leads_count", sa.Integer(), nullable=False),
        sa.Column("needs_reply_count", sa.Integer(), nullable=False),
        sa.Column("overdue_follow_up_count", sa.Integer(), nullable=False),
        sa.Column("hot_leads_count", sa.Integer(), nullable=False),
        sa.Column("analyzed_conversations_count", sa.Integer(), nullable=False),
        sa.Column("needs_analysis_count", sa.Integer(), nullable=False),
        sa.Column("won_deals_count", sa.Integer(), nullable=False),
        sa.Column("avg_response_sla_status", sa.String(length=50), nullable=False),
        sa.Column("crm_discipline_status", sa.String(length=50), nullable=False),
        sa.Column("coaching_priority_score", sa.Integer(), nullable=False),
        sa.Column("coaching_priority_label", sa.String(length=50), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["organization_id"], ["organizations.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["team_id"], ["sales_teams.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["unit_id"], ["sales_units.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "organization_id",
            "team_id",
            "snapshot_date",
            "snapshot_granularity",
            name="uq_team_performance_snapshots_scope",
        ),
    )
    op.create_index(
        "ix_team_performance_snapshots_organization_id",
        "team_performance_snapshots",
        ["organization_id"],
        unique=False,
    )
    op.create_index(
        "ix_team_performance_snapshots_team_id",
        "team_performance_snapshots",
        ["team_id"],
        unique=False,
    )
    op.create_index(
        "ix_team_performance_snapshots_unit_id",
        "team_performance_snapshots",
        ["unit_id"],
        unique=False,
    )
    op.create_index(
        "ix_team_performance_snapshots_snapshot_date",
        "team_performance_snapshots",
        ["snapshot_date"],
        unique=False,
    )
    op.create_index(
        "ix_team_performance_snapshots_snapshot_granularity",
        "team_performance_snapshots",
        ["snapshot_granularity"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("ix_team_performance_snapshots_snapshot_granularity", table_name="team_performance_snapshots")
    op.drop_index("ix_team_performance_snapshots_snapshot_date", table_name="team_performance_snapshots")
    op.drop_index("ix_team_performance_snapshots_unit_id", table_name="team_performance_snapshots")
    op.drop_index("ix_team_performance_snapshots_team_id", table_name="team_performance_snapshots")
    op.drop_index("ix_team_performance_snapshots_organization_id", table_name="team_performance_snapshots")
    op.drop_table("team_performance_snapshots")

    op.drop_index("ix_sales_performance_snapshots_snapshot_granularity", table_name="sales_performance_snapshots")
    op.drop_index("ix_sales_performance_snapshots_snapshot_date", table_name="sales_performance_snapshots")
    op.drop_index("ix_sales_performance_snapshots_unit_id", table_name="sales_performance_snapshots")
    op.drop_index("ix_sales_performance_snapshots_team_id", table_name="sales_performance_snapshots")
    op.drop_index("ix_sales_performance_snapshots_sales_user_id", table_name="sales_performance_snapshots")
    op.drop_index("ix_sales_performance_snapshots_organization_id", table_name="sales_performance_snapshots")
    op.drop_table("sales_performance_snapshots")

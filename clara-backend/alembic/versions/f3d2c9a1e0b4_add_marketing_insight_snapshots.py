"""add marketing insight snapshots

Revision ID: f3d2c9a1e0b4
Revises: e4a7f2c1b9d0
Create Date: 2026-05-11 15:20:00.000000

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "f3d2c9a1e0b4"
down_revision: Union[str, Sequence[str], None] = "e4a7f2c1b9d0"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "marketing_insight_snapshots",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("organization_id", sa.Uuid(), nullable=True),
        sa.Column("scope_type", sa.String(length=20), nullable=False),
        sa.Column("snapshot_type", sa.String(length=20), nullable=False),
        sa.Column("period_start", sa.Date(), nullable=False),
        sa.Column("period_end", sa.Date(), nullable=False),
        sa.Column(
            "metrics_json",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
        ),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(
            ["organization_id"],
            ["organizations.id"],
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_marketing_insight_snapshots_organization_id"),
        "marketing_insight_snapshots",
        ["organization_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_marketing_insight_snapshots_scope_type"),
        "marketing_insight_snapshots",
        ["scope_type"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(
        op.f("ix_marketing_insight_snapshots_scope_type"),
        table_name="marketing_insight_snapshots",
    )
    op.drop_index(
        op.f("ix_marketing_insight_snapshots_organization_id"),
        table_name="marketing_insight_snapshots",
    )
    op.drop_table("marketing_insight_snapshots")

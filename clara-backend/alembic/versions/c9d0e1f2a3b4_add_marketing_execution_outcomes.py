"""add marketing execution outcomes

Revision ID: c9d0e1f2a3b4
Revises: b8c9d0e1f2a3
Create Date: 2026-05-18 04:10:00
"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


revision: str = "c9d0e1f2a3b4"
down_revision: str | Sequence[str] | None = "b8c9d0e1f2a3"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "marketing_execution_items",
        sa.Column("campaign_name", sa.String(length=255), nullable=True),
    )
    op.add_column(
        "marketing_execution_items",
        sa.Column("result_notes", sa.Text(), nullable=True),
    )
    op.add_column(
        "marketing_execution_items",
        sa.Column("published_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "marketing_execution_items",
        sa.Column("leads_generated", sa.Integer(), nullable=False, server_default="0"),
    )
    op.add_column(
        "marketing_execution_items",
        sa.Column("qualified_leads", sa.Integer(), nullable=False, server_default="0"),
    )
    op.add_column(
        "marketing_execution_items",
        sa.Column("won_leads", sa.Integer(), nullable=False, server_default="0"),
    )
    op.add_column(
        "marketing_execution_items",
        sa.Column(
            "attributed_pipeline_value",
            sa.Numeric(18, 2),
            nullable=False,
            server_default="0",
        ),
    )
    op.add_column(
        "marketing_execution_items",
        sa.Column(
            "attributed_won_value",
            sa.Numeric(18, 2),
            nullable=False,
            server_default="0",
        ),
    )
    op.add_column(
        "marketing_execution_items",
        sa.Column(
            "attributed_deposit_amount",
            sa.Numeric(18, 2),
            nullable=False,
            server_default="0",
        ),
    )

    op.alter_column("marketing_execution_items", "leads_generated", server_default=None)
    op.alter_column("marketing_execution_items", "qualified_leads", server_default=None)
    op.alter_column("marketing_execution_items", "won_leads", server_default=None)
    op.alter_column(
        "marketing_execution_items",
        "attributed_pipeline_value",
        server_default=None,
    )
    op.alter_column(
        "marketing_execution_items",
        "attributed_won_value",
        server_default=None,
    )
    op.alter_column(
        "marketing_execution_items",
        "attributed_deposit_amount",
        server_default=None,
    )


def downgrade() -> None:
    op.drop_column("marketing_execution_items", "attributed_deposit_amount")
    op.drop_column("marketing_execution_items", "attributed_won_value")
    op.drop_column("marketing_execution_items", "attributed_pipeline_value")
    op.drop_column("marketing_execution_items", "won_leads")
    op.drop_column("marketing_execution_items", "qualified_leads")
    op.drop_column("marketing_execution_items", "leads_generated")
    op.drop_column("marketing_execution_items", "published_at")
    op.drop_column("marketing_execution_items", "result_notes")
    op.drop_column("marketing_execution_items", "campaign_name")

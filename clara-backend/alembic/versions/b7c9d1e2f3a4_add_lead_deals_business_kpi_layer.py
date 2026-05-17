"""add lead deals business kpi layer

Revision ID: b7c9d1e2f3a4
Revises: 8bc21f9137aa
Create Date: 2026-05-18 16:00:00.000000
"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


revision: str = "b7c9d1e2f3a4"
down_revision: str | Sequence[str] | None = "8bc21f9137aa"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "lead_deals",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("lead_id", sa.Uuid(), nullable=False),
        sa.Column("organization_id", sa.Uuid(), nullable=True),
        sa.Column("owner_user_id", sa.Uuid(), nullable=True),
        sa.Column("status", sa.String(length=30), nullable=False),
        sa.Column("currency", sa.String(length=10), nullable=False),
        sa.Column("expected_value", sa.Numeric(precision=18, scale=2), nullable=False),
        sa.Column("deposit_amount", sa.Numeric(precision=18, scale=2), nullable=False),
        sa.Column("expected_close_date", sa.Date(), nullable=True),
        sa.Column("closed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["lead_id"], ["leads.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["organization_id"], ["organizations.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["owner_user_id"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("lead_id"),
    )
    op.create_index(op.f("ix_lead_deals_lead_id"), "lead_deals", ["lead_id"], unique=True)
    op.create_index(
        op.f("ix_lead_deals_organization_id"),
        "lead_deals",
        ["organization_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_lead_deals_owner_user_id"),
        "lead_deals",
        ["owner_user_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_lead_deals_owner_user_id"), table_name="lead_deals")
    op.drop_index(op.f("ix_lead_deals_organization_id"), table_name="lead_deals")
    op.drop_index(op.f("ix_lead_deals_lead_id"), table_name="lead_deals")
    op.drop_table("lead_deals")

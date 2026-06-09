"""add lead discipline logs

Revision ID: f7b8c9d0e1f2
Revises: f6a7b8c9d0e1
Create Date: 2026-05-20 18:10:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op


revision: str = "f7b8c9d0e1f2"
down_revision: str | Sequence[str] | None = "f6a7b8c9d0e1"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "lead_discipline_logs",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("lead_id", sa.Uuid(), nullable=False),
        sa.Column("organization_id", sa.Uuid(), nullable=True),
        sa.Column("actor_user_id", sa.Uuid(), nullable=True),
        sa.Column("log_date", sa.Date(), nullable=False),
        sa.Column("activity_type", sa.String(length=100), nullable=False),
        sa.Column("result_status", sa.String(length=100), nullable=False),
        sa.Column("main_objection", sa.Text(), nullable=True),
        sa.Column("customer_mood", sa.String(length=100), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("next_follow_up_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["actor_user_id"], ["users.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["lead_id"], ["leads.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["organization_id"], ["organizations.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_lead_discipline_logs_actor_user_id"),
        "lead_discipline_logs",
        ["actor_user_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_lead_discipline_logs_lead_id"),
        "lead_discipline_logs",
        ["lead_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_lead_discipline_logs_log_date"),
        "lead_discipline_logs",
        ["log_date"],
        unique=False,
    )
    op.create_index(
        op.f("ix_lead_discipline_logs_organization_id"),
        "lead_discipline_logs",
        ["organization_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_lead_discipline_logs_organization_id"), table_name="lead_discipline_logs")
    op.drop_index(op.f("ix_lead_discipline_logs_log_date"), table_name="lead_discipline_logs")
    op.drop_index(op.f("ix_lead_discipline_logs_lead_id"), table_name="lead_discipline_logs")
    op.drop_index(op.f("ix_lead_discipline_logs_actor_user_id"), table_name="lead_discipline_logs")
    op.drop_table("lead_discipline_logs")

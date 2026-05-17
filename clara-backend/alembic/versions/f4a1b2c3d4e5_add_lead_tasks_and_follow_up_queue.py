"""add lead tasks and follow up queue

Revision ID: f4a1b2c3d4e5
Revises: f3d2c9a1e0b4
Create Date: 2026-05-18 12:00:00.000000
"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


revision: str = "f4a1b2c3d4e5"
down_revision: str | Sequence[str] | None = "f3d2c9a1e0b4"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "lead_tasks",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("lead_id", sa.Uuid(), nullable=False),
        sa.Column("organization_id", sa.Uuid(), nullable=True),
        sa.Column("assigned_user_id", sa.Uuid(), nullable=True),
        sa.Column("task_type", sa.String(length=50), nullable=False),
        sa.Column("status", sa.String(length=30), nullable=False),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("due_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["lead_id"], ["leads.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(
            ["organization_id"],
            ["organizations.id"],
            ondelete="SET NULL",
        ),
        sa.ForeignKeyConstraint(
            ["assigned_user_id"],
            ["users.id"],
            ondelete="SET NULL",
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_lead_tasks_lead_id"), "lead_tasks", ["lead_id"], unique=False)
    op.create_index(
        op.f("ix_lead_tasks_organization_id"),
        "lead_tasks",
        ["organization_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_lead_tasks_assigned_user_id"),
        "lead_tasks",
        ["assigned_user_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_lead_tasks_assigned_user_id"), table_name="lead_tasks")
    op.drop_index(op.f("ix_lead_tasks_organization_id"), table_name="lead_tasks")
    op.drop_index(op.f("ix_lead_tasks_lead_id"), table_name="lead_tasks")
    op.drop_table("lead_tasks")

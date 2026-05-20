"""add task events and task status metadata

Revision ID: c1d2e3f4a5b6
Revises: b7c9d1e2f3a4
Create Date: 2026-05-18 18:00:00.000000
"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


revision: str = "c1d2e3f4a5b6"
down_revision: str | Sequence[str] | None = "b7c9d1e2f3a4"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "lead_tasks",
        sa.Column("completed_by_user_id", sa.Uuid(), nullable=True),
    )
    op.add_column(
        "lead_tasks",
        sa.Column("last_status_changed_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index(
        op.f("ix_lead_tasks_completed_by_user_id"),
        "lead_tasks",
        ["completed_by_user_id"],
        unique=False,
    )
    op.create_foreign_key(
        "fk_lead_tasks_completed_by_user_id_users",
        "lead_tasks",
        "users",
        ["completed_by_user_id"],
        ["id"],
        ondelete="SET NULL",
    )

    op.execute(
        """
        UPDATE lead_tasks
        SET last_status_changed_at = COALESCE(updated_at, created_at)
        WHERE last_status_changed_at IS NULL
        """
    )
    op.alter_column("lead_tasks", "last_status_changed_at", nullable=False)

    op.create_table(
        "lead_task_events",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("task_id", sa.Uuid(), nullable=False),
        sa.Column("actor_user_id", sa.Uuid(), nullable=True),
        sa.Column("event_type", sa.String(length=50), nullable=False),
        sa.Column("from_status", sa.String(length=20), nullable=True),
        sa.Column("to_status", sa.String(length=20), nullable=True),
        sa.Column("previous_due_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("next_due_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["actor_user_id"], ["users.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["task_id"], ["lead_tasks.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_lead_task_events_actor_user_id"),
        "lead_task_events",
        ["actor_user_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_lead_task_events_task_id"),
        "lead_task_events",
        ["task_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_lead_task_events_task_id"), table_name="lead_task_events")
    op.drop_index(
        op.f("ix_lead_task_events_actor_user_id"),
        table_name="lead_task_events",
    )
    op.drop_table("lead_task_events")

    op.drop_constraint(
        "fk_lead_tasks_completed_by_user_id_users",
        "lead_tasks",
        type_="foreignkey",
    )
    op.drop_index(
        op.f("ix_lead_tasks_completed_by_user_id"),
        table_name="lead_tasks",
    )
    op.drop_column("lead_tasks", "last_status_changed_at")
    op.drop_column("lead_tasks", "completed_by_user_id")

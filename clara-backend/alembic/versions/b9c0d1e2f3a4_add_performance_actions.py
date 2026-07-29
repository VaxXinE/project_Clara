"""add performance actions

Revision ID: b9c0d1e2f3a4
Revises: a6b7c8d9e0f1
Create Date: 2026-07-17 10:10:00.000000
"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


revision: str = "b9c0d1e2f3a4"
down_revision: str | Sequence[str] | None = "a6b7c8d9e0f1"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "performance_actions",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("organization_id", sa.Uuid(), nullable=True),
        sa.Column("created_by_user_id", sa.Uuid(), nullable=True),
        sa.Column("assigned_to_user_id", sa.Uuid(), nullable=True),
        sa.Column("team_id", sa.Uuid(), nullable=True),
        sa.Column("sales_user_id", sa.Uuid(), nullable=True),
        sa.Column("source_type", sa.String(length=50), nullable=False),
        sa.Column("source_reference_id", sa.Uuid(), nullable=True),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("action_type", sa.String(length=50), nullable=False),
        sa.Column("status", sa.String(length=20), nullable=False),
        sa.Column("priority_label", sa.String(length=20), nullable=False),
        sa.Column("due_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("resolution_note", sa.Text(), nullable=True),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(
            ["organization_id"],
            ["organizations.id"],
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["created_by_user_id"],
            ["users.id"],
            ondelete="SET NULL",
        ),
        sa.ForeignKeyConstraint(
            ["assigned_to_user_id"],
            ["users.id"],
            ondelete="SET NULL",
        ),
        sa.ForeignKeyConstraint(
            ["team_id"],
            ["sales_teams.id"],
            ondelete="SET NULL",
        ),
        sa.ForeignKeyConstraint(
            ["sales_user_id"],
            ["users.id"],
            ondelete="SET NULL",
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_performance_actions_organization_id"),
        "performance_actions",
        ["organization_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_performance_actions_created_by_user_id"),
        "performance_actions",
        ["created_by_user_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_performance_actions_assigned_to_user_id"),
        "performance_actions",
        ["assigned_to_user_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_performance_actions_team_id"),
        "performance_actions",
        ["team_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_performance_actions_sales_user_id"),
        "performance_actions",
        ["sales_user_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_performance_actions_source_type"),
        "performance_actions",
        ["source_type"],
        unique=False,
    )
    op.create_index(
        op.f("ix_performance_actions_status"),
        "performance_actions",
        ["status"],
        unique=False,
    )
    op.create_index(
        op.f("ix_performance_actions_priority_label"),
        "performance_actions",
        ["priority_label"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_performance_actions_priority_label"), table_name="performance_actions")
    op.drop_index(op.f("ix_performance_actions_status"), table_name="performance_actions")
    op.drop_index(op.f("ix_performance_actions_source_type"), table_name="performance_actions")
    op.drop_index(op.f("ix_performance_actions_sales_user_id"), table_name="performance_actions")
    op.drop_index(op.f("ix_performance_actions_team_id"), table_name="performance_actions")
    op.drop_index(op.f("ix_performance_actions_assigned_to_user_id"), table_name="performance_actions")
    op.drop_index(op.f("ix_performance_actions_created_by_user_id"), table_name="performance_actions")
    op.drop_index(op.f("ix_performance_actions_organization_id"), table_name="performance_actions")
    op.drop_table("performance_actions")

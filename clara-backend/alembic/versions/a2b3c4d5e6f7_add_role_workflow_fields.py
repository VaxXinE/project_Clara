"""add role workflow fields

Revision ID: a2b3c4d5e6f7
Revises: a1b2c3d4e5f6
Create Date: 2026-05-29 14:55:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op


revision: str = "a2b3c4d5e6f7"
down_revision: str | Sequence[str] | None = "a1b2c3d4e5f6"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "chat_review_cases",
        sa.Column(
            "workflow_scope",
            sa.String(length=50),
            nullable=False,
            server_default="admin_quality_check",
        ),
    )
    op.add_column(
        "chat_review_cases",
        sa.Column(
            "feedback_status",
            sa.String(length=30),
            nullable=False,
            server_default="draft",
        ),
    )
    op.add_column(
        "chat_review_cases",
        sa.Column("feedback_sent_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "chat_review_cases",
        sa.Column("feedback_acknowledged_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "chat_review_cases",
        sa.Column("feedback_resolved_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index(
        op.f("ix_chat_review_cases_workflow_scope"),
        "chat_review_cases",
        ["workflow_scope"],
        unique=False,
    )
    op.create_index(
        op.f("ix_chat_review_cases_feedback_status"),
        "chat_review_cases",
        ["feedback_status"],
        unique=False,
    )
    op.alter_column("chat_review_cases", "workflow_scope", server_default=None)
    op.alter_column("chat_review_cases", "feedback_status", server_default=None)

    op.add_column(
        "lead_tasks",
        sa.Column(
            "workflow_scope",
            sa.String(length=50),
            nullable=False,
            server_default="cs_follow_up",
        ),
    )
    op.add_column(
        "lead_tasks",
        sa.Column("requested_by_role", sa.String(length=30), nullable=True),
    )
    op.create_index(
        op.f("ix_lead_tasks_workflow_scope"),
        "lead_tasks",
        ["workflow_scope"],
        unique=False,
    )
    op.alter_column("lead_tasks", "workflow_scope", server_default=None)

    op.add_column(
        "ops_notifications",
        sa.Column(
            "workflow_scope",
            sa.String(length=50),
            nullable=False,
            server_default="ops_oversight",
        ),
    )
    op.add_column(
        "ops_notifications",
        sa.Column(
            "owner_role",
            sa.String(length=30),
            nullable=False,
            server_default="sales",
        ),
    )
    op.add_column(
        "ops_notifications",
        sa.Column(
            "target_role",
            sa.String(length=30),
            nullable=False,
            server_default="sales",
        ),
    )
    op.create_index(
        op.f("ix_ops_notifications_workflow_scope"),
        "ops_notifications",
        ["workflow_scope"],
        unique=False,
    )
    op.alter_column("ops_notifications", "workflow_scope", server_default=None)
    op.alter_column("ops_notifications", "owner_role", server_default=None)
    op.alter_column("ops_notifications", "target_role", server_default=None)


def downgrade() -> None:
    op.drop_index(
        op.f("ix_ops_notifications_workflow_scope"),
        table_name="ops_notifications",
    )
    op.drop_column("ops_notifications", "target_role")
    op.drop_column("ops_notifications", "owner_role")
    op.drop_column("ops_notifications", "workflow_scope")

    op.drop_index(op.f("ix_lead_tasks_workflow_scope"), table_name="lead_tasks")
    op.drop_column("lead_tasks", "requested_by_role")
    op.drop_column("lead_tasks", "workflow_scope")

    op.drop_index(
        op.f("ix_chat_review_cases_feedback_status"),
        table_name="chat_review_cases",
    )
    op.drop_index(
        op.f("ix_chat_review_cases_workflow_scope"),
        table_name="chat_review_cases",
    )
    op.drop_column("chat_review_cases", "feedback_resolved_at")
    op.drop_column("chat_review_cases", "feedback_acknowledged_at")
    op.drop_column("chat_review_cases", "feedback_sent_at")
    op.drop_column("chat_review_cases", "feedback_status")
    op.drop_column("chat_review_cases", "workflow_scope")

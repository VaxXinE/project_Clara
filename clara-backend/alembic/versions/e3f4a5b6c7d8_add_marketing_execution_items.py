"""add marketing execution items

Revision ID: e3f4a5b6c7d8
Revises: d2f3e4a5b6c7
Create Date: 2026-05-18 19:05:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql


revision: str = "e3f4a5b6c7d8"
down_revision: str | Sequence[str] | None = "d2f3e4a5b6c7"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "marketing_execution_items",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("organization_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("created_by_user_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("assigned_user_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("item_type", sa.String(length=50), nullable=False),
        sa.Column("source_kind", sa.String(length=50), nullable=False),
        sa.Column("status", sa.String(length=30), nullable=False),
        sa.Column("priority", sa.String(length=20), nullable=False),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("summary", sa.Text(), nullable=False),
        sa.Column("recommended_action", sa.Text(), nullable=False),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["assigned_user_id"], ["users.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["created_by_user_id"], ["users.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["organization_id"], ["organizations.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_marketing_execution_items_assigned_user_id"),
        "marketing_execution_items",
        ["assigned_user_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_marketing_execution_items_created_by_user_id"),
        "marketing_execution_items",
        ["created_by_user_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_marketing_execution_items_organization_id"),
        "marketing_execution_items",
        ["organization_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(
        op.f("ix_marketing_execution_items_organization_id"),
        table_name="marketing_execution_items",
    )
    op.drop_index(
        op.f("ix_marketing_execution_items_created_by_user_id"),
        table_name="marketing_execution_items",
    )
    op.drop_index(
        op.f("ix_marketing_execution_items_assigned_user_id"),
        table_name="marketing_execution_items",
    )
    op.drop_table("marketing_execution_items")

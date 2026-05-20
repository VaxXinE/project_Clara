"""add ops notifications and workflow state

Revision ID: b8c9d0e1f2a3
Revises: a7b8c9d0e1f2
Create Date: 2026-05-18 03:25:00
"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "b8c9d0e1f2a3"
down_revision: str | Sequence[str] | None = "a7b8c9d0e1f2"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "ops_notifications",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("organization_id", sa.Uuid(), nullable=True),
        sa.Column("user_id", sa.Uuid(), nullable=True),
        sa.Column("acknowledged_by_user_id", sa.Uuid(), nullable=True),
        sa.Column("source_type", sa.String(length=50), nullable=False),
        sa.Column("source_key", sa.String(length=255), nullable=False),
        sa.Column("severity", sa.String(length=20), nullable=False),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("body", sa.Text(), nullable=False),
        sa.Column("target_href", sa.String(length=255), nullable=True),
        sa.Column("status", sa.String(length=20), nullable=False),
        sa.Column("acknowledged_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("resolved_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(
            ["acknowledged_by_user_id"],
            ["users.id"],
            ondelete="SET NULL",
        ),
        sa.ForeignKeyConstraint(
            ["organization_id"],
            ["organizations.id"],
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["user_id"],
            ["users.id"],
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_ops_notifications_acknowledged_by_user_id"),
        "ops_notifications",
        ["acknowledged_by_user_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_ops_notifications_organization_id"),
        "ops_notifications",
        ["organization_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_ops_notifications_source_key"),
        "ops_notifications",
        ["source_key"],
        unique=False,
    )
    op.create_index(
        op.f("ix_ops_notifications_source_type"),
        "ops_notifications",
        ["source_type"],
        unique=False,
    )
    op.create_index(
        op.f("ix_ops_notifications_user_id"),
        "ops_notifications",
        ["user_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_ops_notifications_user_id"), table_name="ops_notifications")
    op.drop_index(op.f("ix_ops_notifications_source_type"), table_name="ops_notifications")
    op.drop_index(op.f("ix_ops_notifications_source_key"), table_name="ops_notifications")
    op.drop_index(
        op.f("ix_ops_notifications_organization_id"),
        table_name="ops_notifications",
    )
    op.drop_index(
        op.f("ix_ops_notifications_acknowledged_by_user_id"),
        table_name="ops_notifications",
    )
    op.drop_table("ops_notifications")

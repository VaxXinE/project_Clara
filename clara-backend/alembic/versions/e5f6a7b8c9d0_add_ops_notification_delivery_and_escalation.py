"""add ops notification delivery and escalation

Revision ID: e5f6a7b8c9d0
Revises: d1e2f3a4b5c6
Create Date: 2026-05-18 16:15:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op


revision: str = "e5f6a7b8c9d0"
down_revision: str | Sequence[str] | None = "d1e2f3a4b5c6"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "ops_notifications",
        sa.Column("delivery_channel", sa.String(length=30), nullable=False, server_default="in_app"),
    )
    op.add_column(
        "ops_notifications",
        sa.Column("delivery_status", sa.String(length=20), nullable=False, server_default="pending"),
    )
    op.add_column(
        "ops_notifications",
        sa.Column("escalation_level", sa.String(length=20), nullable=False, server_default="none"),
    )
    op.add_column("ops_notifications", sa.Column("resolution_note", sa.Text(), nullable=True))
    op.add_column("ops_notifications", sa.Column("delivered_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("ops_notifications", sa.Column("escalated_at", sa.DateTime(timezone=True), nullable=True))
    op.alter_column("ops_notifications", "delivery_channel", server_default=None)
    op.alter_column("ops_notifications", "delivery_status", server_default=None)
    op.alter_column("ops_notifications", "escalation_level", server_default=None)


def downgrade() -> None:
    op.drop_column("ops_notifications", "escalated_at")
    op.drop_column("ops_notifications", "delivered_at")
    op.drop_column("ops_notifications", "resolution_note")
    op.drop_column("ops_notifications", "escalation_level")
    op.drop_column("ops_notifications", "delivery_status")
    op.drop_column("ops_notifications", "delivery_channel")

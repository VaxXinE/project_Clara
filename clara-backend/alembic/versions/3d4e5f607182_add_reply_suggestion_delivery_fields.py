"""add reply suggestion delivery_mode, inserted_at and sent_at

Revision ID: 3d4e5f607182
Revises: 2c3d4e5f6071
"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


revision: str = "3d4e5f607182"
down_revision: str | Sequence[str] | None = "2c3d4e5f6071"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "reply_suggestions",
        sa.Column("delivery_mode", sa.String(length=100), nullable=True),
    )
    op.add_column(
        "reply_suggestions",
        sa.Column("inserted_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "reply_suggestions",
        sa.Column("sent_at", sa.DateTime(timezone=True), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("reply_suggestions", "sent_at")
    op.drop_column("reply_suggestions", "inserted_at")
    op.drop_column("reply_suggestions", "delivery_mode")

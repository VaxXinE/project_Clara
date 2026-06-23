"""add message reply context fields

Revision ID: fbe2c3d4e5f6
Revises: fad1e2f3a4b5
Create Date: 2026-06-23 15:20:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op


# revision identifiers, used by Alembic.
revision: str = "fbe2c3d4e5f6"
down_revision: str | Sequence[str] | None = "fad1e2f3a4b5"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("messages", sa.Column("reply_context_text", sa.Text(), nullable=True))
    op.add_column(
        "messages",
        sa.Column("reply_context_sender_name", sa.String(length=255), nullable=True),
    )
    op.add_column(
        "messages",
        sa.Column("reply_context_sender_type", sa.String(length=50), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("messages", "reply_context_sender_type")
    op.drop_column("messages", "reply_context_sender_name")
    op.drop_column("messages", "reply_context_text")

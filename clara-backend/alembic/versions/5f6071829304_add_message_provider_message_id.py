"""add messages.provider_message_id to recognise the same chat after its title changes

Revision ID: 5f6071829304
Revises: 4e5f60718293
"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


revision: str = "5f6071829304"
down_revision: str | Sequence[str] | None = "4e5f60718293"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "messages",
        sa.Column("provider_message_id", sa.String(length=255), nullable=True),
    )
    op.create_index(
        op.f("ix_messages_provider_message_id"),
        "messages",
        ["provider_message_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_messages_provider_message_id"), table_name="messages")
    op.drop_column("messages", "provider_message_id")

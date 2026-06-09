"""add whatsapp webhook metadata and business segmentation

Revision ID: fad1e2f3a4b5
Revises: f9d0e1f2a3b4
Create Date: 2026-05-21 13:40:00.000000
"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


revision: str = "fad1e2f3a4b5"
down_revision: str | Sequence[str] | None = "f9d0e1f2a3b4"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "leads",
        sa.Column("account_category", sa.String(length=20), nullable=False, server_default="unknown"),
    )
    op.add_column(
        "conversations",
        sa.Column("provider_key", sa.String(length=50), nullable=True),
    )
    op.add_column(
        "conversations",
        sa.Column("external_thread_key", sa.String(length=255), nullable=True),
    )
    op.add_column(
        "messages",
        sa.Column("external_message_id", sa.String(length=255), nullable=True),
    )
    op.create_index(op.f("ix_conversations_provider_key"), "conversations", ["provider_key"], unique=False)
    op.create_index(
        op.f("ix_conversations_external_thread_key"),
        "conversations",
        ["external_thread_key"],
        unique=False,
    )
    op.create_index(
        op.f("ix_messages_external_message_id"),
        "messages",
        ["external_message_id"],
        unique=True,
    )
    op.alter_column("leads", "account_category", server_default=None)


def downgrade() -> None:
    op.drop_index(op.f("ix_messages_external_message_id"), table_name="messages")
    op.drop_index(op.f("ix_conversations_external_thread_key"), table_name="conversations")
    op.drop_index(op.f("ix_conversations_provider_key"), table_name="conversations")
    op.drop_column("messages", "external_message_id")
    op.drop_column("conversations", "external_thread_key")
    op.drop_column("conversations", "provider_key")
    op.drop_column("leads", "account_category")

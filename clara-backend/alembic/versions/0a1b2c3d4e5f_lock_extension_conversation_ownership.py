"""lock extension conversation ownership

Revision ID: 0a1b2c3d4e5f
Revises: fd3e4f506172
"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


revision: str = "0a1b2c3d4e5f"
down_revision: str | Sequence[str] | None = "fd3e4f506172"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_index(
        "uq_conversations_org_channel_provider_thread",
        "conversations",
        ["organization_id", "channel", "provider", "external_thread_key"],
        unique=True,
        postgresql_where=sa.text("external_thread_key IS NOT NULL"),
        sqlite_where=sa.text("external_thread_key IS NOT NULL"),
    )


def downgrade() -> None:
    op.drop_index(
        "uq_conversations_org_channel_provider_thread",
        table_name="conversations",
    )

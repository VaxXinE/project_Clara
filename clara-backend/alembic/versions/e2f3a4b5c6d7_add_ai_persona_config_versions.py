"""add ai persona config versions

Revision ID: e2f3a4b5c6d7
Revises: d1a2b3c4d5e6
Create Date: 2026-07-31 09:00:00.000000
"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "e2f3a4b5c6d7"
down_revision: str | Sequence[str] | None = "d1a2b3c4d5e6"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "ai_persona_config_versions",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("variant", sa.String(length=20), nullable=False),
        sa.Column("section_key", sa.String(length=50), nullable=False),
        sa.Column("version_number", sa.Integer(), nullable=False),
        sa.Column("status", sa.String(length=20), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("content_sha256", sa.String(length=64), nullable=False),
        sa.Column(
            "created_by_user_id",
            postgresql.UUID(as_uuid=True),
            nullable=True,
        ),
        sa.Column(
            "published_by_user_id",
            postgresql.UUID(as_uuid=True),
            nullable=True,
        ),
        sa.Column(
            "source_version_id",
            postgresql.UUID(as_uuid=True),
            nullable=True,
        ),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("published_at", sa.DateTime(timezone=True), nullable=True),
        sa.CheckConstraint(
            "variant IN ('mini', 'reguler')",
            name="ck_ai_persona_config_versions_variant",
        ),
        sa.CheckConstraint(
            "section_key IN "
            "('instruction', 'guardrail', 'flow', 'personality_mode', 'auto_adapt')",
            name="ck_ai_persona_config_versions_section_key",
        ),
        sa.CheckConstraint(
            "status IN ('draft', 'published', 'archived')",
            name="ck_ai_persona_config_versions_status",
        ),
        sa.CheckConstraint(
            "version_number > 0",
            name="ck_ai_persona_config_versions_version_number",
        ),
        sa.ForeignKeyConstraint(
            ["created_by_user_id"],
            ["users.id"],
            ondelete="SET NULL",
        ),
        sa.ForeignKeyConstraint(
            ["published_by_user_id"],
            ["users.id"],
            ondelete="SET NULL",
        ),
        sa.ForeignKeyConstraint(
            ["source_version_id"],
            ["ai_persona_config_versions.id"],
            ondelete="SET NULL",
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_ai_persona_config_versions_created_by_user_id",
        "ai_persona_config_versions",
        ["created_by_user_id"],
        unique=False,
    )
    op.create_index(
        "ix_ai_persona_config_versions_published_by_user_id",
        "ai_persona_config_versions",
        ["published_by_user_id"],
        unique=False,
    )
    op.create_index(
        "ix_ai_persona_config_versions_lookup",
        "ai_persona_config_versions",
        ["variant", "section_key", "status"],
        unique=False,
    )
    op.create_index(
        "uq_ai_persona_config_versions_number",
        "ai_persona_config_versions",
        ["variant", "section_key", "version_number"],
        unique=True,
    )
    op.create_index(
        "uq_ai_persona_config_versions_published",
        "ai_persona_config_versions",
        ["variant", "section_key"],
        unique=True,
        postgresql_where=sa.text("status = 'published'"),
    )


def downgrade() -> None:
    op.drop_index(
        "uq_ai_persona_config_versions_published",
        table_name="ai_persona_config_versions",
    )
    op.drop_index(
        "uq_ai_persona_config_versions_number",
        table_name="ai_persona_config_versions",
    )
    op.drop_index(
        "ix_ai_persona_config_versions_lookup",
        table_name="ai_persona_config_versions",
    )
    op.drop_index(
        "ix_ai_persona_config_versions_published_by_user_id",
        table_name="ai_persona_config_versions",
    )
    op.drop_index(
        "ix_ai_persona_config_versions_created_by_user_id",
        table_name="ai_persona_config_versions",
    )
    op.drop_table("ai_persona_config_versions")

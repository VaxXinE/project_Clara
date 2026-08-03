"""add governed five prompt bundles

Revision ID: fb1c2d3e4f50
Revises: fa0b1c2d3e4f
"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "fb1c2d3e4f50"
down_revision: str | Sequence[str] | None = "fa0b1c2d3e4f"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "ai_persona_bundles",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("variant", sa.String(20), nullable=False),
        sa.Column("bundle_version", sa.Integer(), nullable=False),
        sa.Column("status", sa.String(20), nullable=False),
        sa.Column("bundle_sha256", sa.String(64), nullable=True),
        sa.Column("source_type", sa.String(40), nullable=False),
        sa.Column("source_bundle_id", sa.Uuid(), nullable=True),
        sa.Column("validation_status", sa.String(20), nullable=False),
        sa.Column("validation_report", sa.JSON(), nullable=False),
        sa.Column("validation_report_hash", sa.String(64), nullable=True),
        sa.Column("validation_contract_version", sa.String(20), nullable=True),
        sa.Column("created_by_user_id", sa.Uuid(), nullable=True),
        sa.Column("validated_by_user_id", sa.Uuid(), nullable=True),
        sa.Column("published_by_user_id", sa.Uuid(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("validated_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("published_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("archived_at", sa.DateTime(timezone=True), nullable=True),
        sa.CheckConstraint(
            "variant IN ('mini', 'reguler')",
            name="ck_ai_persona_bundles_variant",
        ),
        sa.CheckConstraint(
            "status IN ('draft', 'validated', 'published', 'archived', 'rejected')",
            name="ck_ai_persona_bundles_status",
        ),
        sa.CheckConstraint(
            "validation_status IN ('pending', 'valid', 'invalid')",
            name="ck_ai_persona_bundles_validation_status",
        ),
        sa.CheckConstraint(
            "bundle_version > 0", name="ck_ai_persona_bundles_version"
        ),
        sa.ForeignKeyConstraint(
            ["source_bundle_id"], ["ai_persona_bundles.id"], ondelete="SET NULL"
        ),
        sa.ForeignKeyConstraint(
            ["created_by_user_id"], ["users.id"], ondelete="SET NULL"
        ),
        sa.ForeignKeyConstraint(
            ["validated_by_user_id"], ["users.id"], ondelete="SET NULL"
        ),
        sa.ForeignKeyConstraint(
            ["published_by_user_id"], ["users.id"], ondelete="SET NULL"
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "uq_ai_persona_bundles_version",
        "ai_persona_bundles",
        ["variant", "bundle_version"],
        unique=True,
    )
    op.create_index(
        "uq_ai_persona_bundles_published",
        "ai_persona_bundles",
        ["variant"],
        unique=True,
        postgresql_where=sa.text("status = 'published'"),
    )
    op.create_index(
        "ix_ai_persona_bundles_lookup",
        "ai_persona_bundles",
        ["variant", "status"],
    )

    op.create_table(
        "ai_persona_bundle_sections",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("bundle_id", sa.Uuid(), nullable=False),
        sa.Column("section_key", sa.String(50), nullable=False),
        sa.Column("persona_config_version_id", sa.Uuid(), nullable=False),
        sa.Column("position", sa.Integer(), nullable=False),
        sa.Column("content_sha256", sa.String(64), nullable=False),
        sa.Column("character_count", sa.Integer(), nullable=False),
        sa.Column("source_type", sa.String(50), nullable=False),
        sa.Column("source_identifier", sa.String(255), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint(
            "section_key IN ('instruction', 'guardrail', 'flow', 'personality_mode', 'auto_adapt')",
            name="ck_ai_persona_bundle_sections_key",
        ),
        sa.CheckConstraint(
            "position BETWEEN 1 AND 5",
            name="ck_ai_persona_bundle_sections_position",
        ),
        sa.CheckConstraint(
            "character_count BETWEEN 1 AND 50000",
            name="ck_ai_persona_bundle_sections_character_count",
        ),
        sa.ForeignKeyConstraint(
            ["bundle_id"], ["ai_persona_bundles.id"], ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(
            ["persona_config_version_id"],
            ["ai_persona_config_versions.id"],
            ondelete="RESTRICT",
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "bundle_id", "section_key", name="uq_ai_persona_bundle_sections_key"
        ),
        sa.UniqueConstraint(
            "bundle_id", "position", name="uq_ai_persona_bundle_sections_position"
        ),
    )
    op.create_index(
        "ix_ai_persona_bundle_sections_bundle_id",
        "ai_persona_bundle_sections",
        ["bundle_id"],
    )
    op.create_index(
        "ix_ai_persona_bundle_sections_persona_config_version_id",
        "ai_persona_bundle_sections",
        ["persona_config_version_id"],
    )
    op.add_column(
        "reply_suggestions",
        sa.Column(
            "persona_bundle_metadata",
            postgresql.JSONB(astext_type=sa.Text()),
            server_default=sa.text("'{}'::jsonb"),
            nullable=False,
        ),
    )
    op.alter_column(
        "reply_suggestions", "persona_bundle_metadata", server_default=None
    )


def downgrade() -> None:
    op.drop_column("reply_suggestions", "persona_bundle_metadata")
    op.drop_index(
        "ix_ai_persona_bundle_sections_persona_config_version_id",
        table_name="ai_persona_bundle_sections",
    )
    op.drop_index(
        "ix_ai_persona_bundle_sections_bundle_id",
        table_name="ai_persona_bundle_sections",
    )
    op.drop_table("ai_persona_bundle_sections")
    op.drop_index("ix_ai_persona_bundles_lookup", table_name="ai_persona_bundles")
    op.drop_index("uq_ai_persona_bundles_published", table_name="ai_persona_bundles")
    op.drop_index("uq_ai_persona_bundles_version", table_name="ai_persona_bundles")
    op.drop_table("ai_persona_bundles")

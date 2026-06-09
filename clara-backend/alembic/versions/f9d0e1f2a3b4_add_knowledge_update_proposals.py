"""add knowledge update proposals

Revision ID: f9d0e1f2a3b4
Revises: f8c9d0e1f2a3
Create Date: 2026-05-21 19:05:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op


# revision identifiers, used by Alembic.
revision: str = "f9d0e1f2a3b4"
down_revision: str | None = "f8c9d0e1f2a3"
branch_labels: Sequence[str] | None = None
depends_on: Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "knowledge_update_proposals",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("organization_id", sa.Uuid(), nullable=True),
        sa.Column("conversation_id", sa.Uuid(), nullable=False),
        sa.Column("chat_review_case_id", sa.Uuid(), nullable=True),
        sa.Column("lead_id", sa.Uuid(), nullable=True),
        sa.Column("proposed_by_user_id", sa.Uuid(), nullable=True),
        sa.Column("reviewed_by_user_id", sa.Uuid(), nullable=True),
        sa.Column("published_product_knowledge_id", sa.Uuid(), nullable=True),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("category", sa.String(length=100), nullable=False),
        sa.Column("proposed_content", sa.Text(), nullable=False),
        sa.Column("source_type", sa.String(length=50), nullable=False),
        sa.Column("rationale", sa.Text(), nullable=True),
        sa.Column("status", sa.String(length=50), nullable=False),
        sa.Column("review_decision_note", sa.Text(), nullable=True),
        sa.Column("submitted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("reviewed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("published_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(
            ["chat_review_case_id"],
            ["chat_review_cases.id"],
            ondelete="SET NULL",
        ),
        sa.ForeignKeyConstraint(
            ["conversation_id"],
            ["conversations.id"],
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["lead_id"],
            ["leads.id"],
            ondelete="SET NULL",
        ),
        sa.ForeignKeyConstraint(
            ["organization_id"],
            ["organizations.id"],
            ondelete="SET NULL",
        ),
        sa.ForeignKeyConstraint(
            ["proposed_by_user_id"],
            ["users.id"],
            ondelete="SET NULL",
        ),
        sa.ForeignKeyConstraint(
            ["published_product_knowledge_id"],
            ["product_knowledge.id"],
            ondelete="SET NULL",
        ),
        sa.ForeignKeyConstraint(
            ["reviewed_by_user_id"],
            ["users.id"],
            ondelete="SET NULL",
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("chat_review_case_id"),
        sa.UniqueConstraint("conversation_id"),
    )
    op.create_index(
        op.f("ix_knowledge_update_proposals_organization_id"),
        "knowledge_update_proposals",
        ["organization_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_knowledge_update_proposals_conversation_id"),
        "knowledge_update_proposals",
        ["conversation_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_knowledge_update_proposals_chat_review_case_id"),
        "knowledge_update_proposals",
        ["chat_review_case_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_knowledge_update_proposals_lead_id"),
        "knowledge_update_proposals",
        ["lead_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_knowledge_update_proposals_proposed_by_user_id"),
        "knowledge_update_proposals",
        ["proposed_by_user_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_knowledge_update_proposals_reviewed_by_user_id"),
        "knowledge_update_proposals",
        ["reviewed_by_user_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_knowledge_update_proposals_published_product_knowledge_id"),
        "knowledge_update_proposals",
        ["published_product_knowledge_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(
        op.f("ix_knowledge_update_proposals_published_product_knowledge_id"),
        table_name="knowledge_update_proposals",
    )
    op.drop_index(
        op.f("ix_knowledge_update_proposals_reviewed_by_user_id"),
        table_name="knowledge_update_proposals",
    )
    op.drop_index(
        op.f("ix_knowledge_update_proposals_proposed_by_user_id"),
        table_name="knowledge_update_proposals",
    )
    op.drop_index(
        op.f("ix_knowledge_update_proposals_lead_id"),
        table_name="knowledge_update_proposals",
    )
    op.drop_index(
        op.f("ix_knowledge_update_proposals_chat_review_case_id"),
        table_name="knowledge_update_proposals",
    )
    op.drop_index(
        op.f("ix_knowledge_update_proposals_conversation_id"),
        table_name="knowledge_update_proposals",
    )
    op.drop_index(
        op.f("ix_knowledge_update_proposals_organization_id"),
        table_name="knowledge_update_proposals",
    )
    op.drop_table("knowledge_update_proposals")

"""add chat review cases and notes

Revision ID: f8c9d0e1f2a3
Revises: f7b8c9d0e1f2
Create Date: 2026-05-21 14:30:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op


revision: str = "f8c9d0e1f2a3"
down_revision: str | Sequence[str] | None = "f7b8c9d0e1f2"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "chat_review_cases",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("conversation_id", sa.Uuid(), nullable=False),
        sa.Column("organization_id", sa.Uuid(), nullable=True),
        sa.Column("lead_id", sa.Uuid(), nullable=True),
        sa.Column("submitted_by_user_id", sa.Uuid(), nullable=True),
        sa.Column("reviewer_user_id", sa.Uuid(), nullable=True),
        sa.Column("status", sa.String(length=50), nullable=False),
        sa.Column("review_label", sa.String(length=50), nullable=False),
        sa.Column("review_summary", sa.Text(), nullable=True),
        sa.Column("coaching_focus", sa.Text(), nullable=True),
        sa.Column("recommended_action", sa.Text(), nullable=True),
        sa.Column("reviewed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["conversation_id"], ["conversations.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["lead_id"], ["leads.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["organization_id"], ["organizations.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["reviewer_user_id"], ["users.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["submitted_by_user_id"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("conversation_id"),
    )
    op.create_index(
        op.f("ix_chat_review_cases_conversation_id"),
        "chat_review_cases",
        ["conversation_id"],
        unique=True,
    )
    op.create_index(
        op.f("ix_chat_review_cases_lead_id"),
        "chat_review_cases",
        ["lead_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_chat_review_cases_organization_id"),
        "chat_review_cases",
        ["organization_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_chat_review_cases_reviewer_user_id"),
        "chat_review_cases",
        ["reviewer_user_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_chat_review_cases_submitted_by_user_id"),
        "chat_review_cases",
        ["submitted_by_user_id"],
        unique=False,
    )

    op.create_table(
        "chat_review_notes",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("review_case_id", sa.Uuid(), nullable=False),
        sa.Column("author_user_id", sa.Uuid(), nullable=True),
        sa.Column("note_type", sa.String(length=50), nullable=False),
        sa.Column("body", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["author_user_id"], ["users.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["review_case_id"], ["chat_review_cases.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_chat_review_notes_author_user_id"),
        "chat_review_notes",
        ["author_user_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_chat_review_notes_review_case_id"),
        "chat_review_notes",
        ["review_case_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_chat_review_notes_review_case_id"), table_name="chat_review_notes")
    op.drop_index(op.f("ix_chat_review_notes_author_user_id"), table_name="chat_review_notes")
    op.drop_table("chat_review_notes")

    op.drop_index(op.f("ix_chat_review_cases_submitted_by_user_id"), table_name="chat_review_cases")
    op.drop_index(op.f("ix_chat_review_cases_reviewer_user_id"), table_name="chat_review_cases")
    op.drop_index(op.f("ix_chat_review_cases_organization_id"), table_name="chat_review_cases")
    op.drop_index(op.f("ix_chat_review_cases_lead_id"), table_name="chat_review_cases")
    op.drop_index(op.f("ix_chat_review_cases_conversation_id"), table_name="chat_review_cases")
    op.drop_table("chat_review_cases")

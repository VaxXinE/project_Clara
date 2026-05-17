"""add leads crm foundation

Revision ID: e7f8a9b0c1d2
Revises: d5e6f7a8b9c0
Create Date: 2026-05-17 18:30:00.000000
"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


revision: str = "e7f8a9b0c1d2"
down_revision: str | Sequence[str] | None = "d5e6f7a8b9c0"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "leads",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("organization_id", sa.Uuid(), nullable=True),
        sa.Column("assigned_user_id", sa.Uuid(), nullable=True),
        sa.Column("display_name", sa.String(length=255), nullable=False),
        sa.Column("source", sa.String(length=50), nullable=False),
        sa.Column("current_stage", sa.String(length=50), nullable=False),
        sa.Column("lead_temperature", sa.String(length=20), nullable=False),
        sa.Column("summary", sa.Text(), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("last_contact_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("next_follow_up_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(
            ["assigned_user_id"],
            ["users.id"],
            ondelete="SET NULL",
        ),
        sa.ForeignKeyConstraint(
            ["organization_id"],
            ["organizations.id"],
            ondelete="SET NULL",
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_leads_assigned_user_id"), "leads", ["assigned_user_id"], unique=False)
    op.create_index(op.f("ix_leads_organization_id"), "leads", ["organization_id"], unique=False)

    op.add_column("conversations", sa.Column("lead_id", sa.Uuid(), nullable=True))
    op.create_index(op.f("ix_conversations_lead_id"), "conversations", ["lead_id"], unique=False)
    op.create_foreign_key(
        "fk_conversations_lead_id_leads",
        "conversations",
        "leads",
        ["lead_id"],
        ["id"],
        ondelete="SET NULL",
    )


def downgrade() -> None:
    op.drop_constraint("fk_conversations_lead_id_leads", "conversations", type_="foreignkey")
    op.drop_index(op.f("ix_conversations_lead_id"), table_name="conversations")
    op.drop_column("conversations", "lead_id")

    op.drop_index(op.f("ix_leads_organization_id"), table_name="leads")
    op.drop_index(op.f("ix_leads_assigned_user_id"), table_name="leads")
    op.drop_table("leads")

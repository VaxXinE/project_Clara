"""add lead activity timeline events

Revision ID: d2f3e4a5b6c7
Revises: c1d2e3f4a5b6
Create Date: 2026-05-18 18:20:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = "d2f3e4a5b6c7"
down_revision: str | Sequence[str] | None = "c1d2e3f4a5b6"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "lead_activity_events",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("lead_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("organization_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("actor_user_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("event_type", sa.String(length=50), nullable=False),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("from_value", sa.Text(), nullable=True),
        sa.Column("to_value", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["actor_user_id"], ["users.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["lead_id"], ["leads.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(
            ["organization_id"],
            ["organizations.id"],
            ondelete="SET NULL",
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_lead_activity_events_actor_user_id"),
        "lead_activity_events",
        ["actor_user_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_lead_activity_events_lead_id"),
        "lead_activity_events",
        ["lead_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_lead_activity_events_organization_id"),
        "lead_activity_events",
        ["organization_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(
        op.f("ix_lead_activity_events_organization_id"),
        table_name="lead_activity_events",
    )
    op.drop_index(
        op.f("ix_lead_activity_events_lead_id"),
        table_name="lead_activity_events",
    )
    op.drop_index(
        op.f("ix_lead_activity_events_actor_user_id"),
        table_name="lead_activity_events",
    )
    op.drop_table("lead_activity_events")

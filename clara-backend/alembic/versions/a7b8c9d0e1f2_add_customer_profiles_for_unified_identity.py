"""add customer profiles for unified identity

Revision ID: a7b8c9d0e1f2
Revises: f4b5c6d7e8f9
Create Date: 2026-05-18 11:10:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op


revision: str = "a7b8c9d0e1f2"
down_revision: str | Sequence[str] | None = "f4b5c6d7e8f9"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "customer_profiles",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("organization_id", sa.Uuid(), nullable=True),
        sa.Column("assigned_user_id", sa.Uuid(), nullable=True),
        sa.Column("display_name", sa.String(length=255), nullable=False),
        sa.Column("canonical_key", sa.String(length=255), nullable=False),
        sa.Column("last_contact_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["assigned_user_id"], ["users.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["organization_id"], ["organizations.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_customer_profiles_organization_id"),
        "customer_profiles",
        ["organization_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_customer_profiles_assigned_user_id"),
        "customer_profiles",
        ["assigned_user_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_customer_profiles_canonical_key"),
        "customer_profiles",
        ["canonical_key"],
        unique=False,
    )

    op.add_column(
        "leads",
        sa.Column("customer_profile_id", sa.Uuid(), nullable=True),
    )
    op.create_index(
        op.f("ix_leads_customer_profile_id"),
        "leads",
        ["customer_profile_id"],
        unique=False,
    )
    op.create_foreign_key(
        "fk_leads_customer_profile_id_customer_profiles",
        "leads",
        "customer_profiles",
        ["customer_profile_id"],
        ["id"],
        ondelete="SET NULL",
    )


def downgrade() -> None:
    op.drop_constraint(
        "fk_leads_customer_profile_id_customer_profiles",
        "leads",
        type_="foreignkey",
    )
    op.drop_index(op.f("ix_leads_customer_profile_id"), table_name="leads")
    op.drop_column("leads", "customer_profile_id")

    op.drop_index(op.f("ix_customer_profiles_canonical_key"), table_name="customer_profiles")
    op.drop_index(op.f("ix_customer_profiles_assigned_user_id"), table_name="customer_profiles")
    op.drop_index(op.f("ix_customer_profiles_organization_id"), table_name="customer_profiles")
    op.drop_table("customer_profiles")

"""add customer identity merge metadata

Revision ID: d1e2f3a4b5c6
Revises: c9d0e1f2a3b4
Create Date: 2026-05-18 15:55:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op


# revision identifiers, used by Alembic.
revision: str = "d1e2f3a4b5c6"
down_revision: str | Sequence[str] | None = "c9d0e1f2a3b4"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "customer_profiles",
        sa.Column("identity_confidence", sa.Float(), nullable=False, server_default="0.92"),
    )
    op.add_column(
        "customer_profiles",
        sa.Column("match_strategy", sa.String(length=50), nullable=False, server_default="name_exact"),
    )
    op.add_column(
        "customer_profiles",
        sa.Column("merge_notes", sa.Text(), nullable=True),
    )
    op.add_column(
        "customer_profiles",
        sa.Column("merged_into_profile_id", sa.Uuid(), nullable=True),
    )
    op.create_index(
        op.f("ix_customer_profiles_merged_into_profile_id"),
        "customer_profiles",
        ["merged_into_profile_id"],
        unique=False,
    )
    op.create_foreign_key(
        "fk_customer_profiles_merged_into_profile_id",
        "customer_profiles",
        "customer_profiles",
        ["merged_into_profile_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.alter_column("customer_profiles", "identity_confidence", server_default=None)
    op.alter_column("customer_profiles", "match_strategy", server_default=None)


def downgrade() -> None:
    op.drop_constraint(
        "fk_customer_profiles_merged_into_profile_id",
        "customer_profiles",
        type_="foreignkey",
    )
    op.drop_index(op.f("ix_customer_profiles_merged_into_profile_id"), table_name="customer_profiles")
    op.drop_column("customer_profiles", "merged_into_profile_id")
    op.drop_column("customer_profiles", "merge_notes")
    op.drop_column("customer_profiles", "match_strategy")
    op.drop_column("customer_profiles", "identity_confidence")

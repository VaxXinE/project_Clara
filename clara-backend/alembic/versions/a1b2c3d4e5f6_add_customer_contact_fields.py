"""add customer contact fields

Revision ID: a1b2c3d4e5f6
Revises: fad1e2f3a4b5
Create Date: 2026-05-29 09:15:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op


# revision identifiers, used by Alembic.
revision: str = "a1b2c3d4e5f6"
down_revision: str | Sequence[str] | None = "fad1e2f3a4b5"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("customer_profiles", sa.Column("phone", sa.String(length=50), nullable=True))
    op.add_column("customer_profiles", sa.Column("email", sa.String(length=255), nullable=True))
    op.add_column("customer_profiles", sa.Column("address", sa.Text(), nullable=True))
    op.add_column(
        "customer_profiles",
        sa.Column("status", sa.String(length=20), nullable=False, server_default="active"),
    )
    op.create_index(
        op.f("ix_customer_profiles_status"),
        "customer_profiles",
        ["status"],
        unique=False,
    )
    op.alter_column("customer_profiles", "status", server_default=None)


def downgrade() -> None:
    op.drop_index(op.f("ix_customer_profiles_status"), table_name="customer_profiles")
    op.drop_column("customer_profiles", "status")
    op.drop_column("customer_profiles", "address")
    op.drop_column("customer_profiles", "email")
    op.drop_column("customer_profiles", "phone")

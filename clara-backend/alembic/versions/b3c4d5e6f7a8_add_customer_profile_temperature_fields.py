"""add customer profile temperature fields

Revision ID: b3c4d5e6f7a8
Revises: a2b3c4d5e6f7
Create Date: 2026-06-10 14:30:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op


revision: str = "b3c4d5e6f7a8"
down_revision: str | Sequence[str] | None = "a2b3c4d5e6f7"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "customer_profiles",
        sa.Column(
            "temperature",
            sa.String(length=20),
            nullable=False,
            server_default="unknown",
        ),
    )
    op.add_column(
        "customer_profiles",
        sa.Column(
            "temperature_source",
            sa.String(length=20),
            nullable=False,
            server_default="auto",
        ),
    )
    op.alter_column("customer_profiles", "temperature", server_default=None)
    op.alter_column("customer_profiles", "temperature_source", server_default=None)


def downgrade() -> None:
    op.drop_column("customer_profiles", "temperature_source")
    op.drop_column("customer_profiles", "temperature")

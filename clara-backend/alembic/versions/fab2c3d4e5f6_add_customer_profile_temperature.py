"""add customer profile temperature

Revision ID: fab2c3d4e5f6
Revises: c4d5e6f7a8b9
Create Date: 2026-06-02 10:00:00.000000
"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


revision: str = "fab2c3d4e5f6"
down_revision: str | Sequence[str] | None = "c4d5e6f7a8b9"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "customer_profiles",
        sa.Column("temperature", sa.String(length=20), nullable=False, server_default="unknown"),
    )
    op.add_column(
        "customer_profiles",
        sa.Column("temperature_source", sa.String(length=20), nullable=False, server_default="auto"),
    )
    op.execute(
        """
        UPDATE customer_profiles
        SET temperature = 'unknown', temperature_source = 'auto'
        WHERE temperature IS NULL OR temperature_source IS NULL
        """
    )
    op.alter_column("customer_profiles", "temperature", server_default=None)
    op.alter_column("customer_profiles", "temperature_source", server_default=None)


def downgrade() -> None:
    op.drop_column("customer_profiles", "temperature_source")
    op.drop_column("customer_profiles", "temperature")

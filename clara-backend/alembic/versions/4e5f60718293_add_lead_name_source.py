"""add leads.name_source so a manual customer name survives chat syncs

Revision ID: 4e5f60718293
Revises: 3d4e5f607182
"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


revision: str = "4e5f60718293"
down_revision: str | Sequence[str] | None = "3d4e5f607182"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "leads",
        sa.Column(
            "name_source",
            sa.String(length=16),
            nullable=False,
            server_default="auto",
        ),
    )


def downgrade() -> None:
    op.drop_column("leads", "name_source")

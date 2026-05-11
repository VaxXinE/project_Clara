"""replace sales role with marketing

Revision ID: d5e6f7a8b9c0
Revises: c4d5e6f7a8b9
Create Date: 2026-05-11 15:30:00.000000
"""

from collections.abc import Sequence

from alembic import op


revision: str = "d5e6f7a8b9c0"
down_revision: str | Sequence[str] | None = "c4d5e6f7a8b9"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute("UPDATE users SET role = 'marketing' WHERE role = 'sales'")


def downgrade() -> None:
    op.execute("UPDATE users SET role = 'sales' WHERE role = 'marketing'")

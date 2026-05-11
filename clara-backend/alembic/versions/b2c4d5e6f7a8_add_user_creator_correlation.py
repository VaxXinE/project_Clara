"""add user creator correlation

Revision ID: b2c4d5e6f7a8
Revises: f3d2c9a1e0b4
Create Date: 2026-05-11 14:45:00.000000
"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "b2c4d5e6f7a8"
down_revision: str | Sequence[str] | None = "f3d2c9a1e0b4"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column("created_by_user_id", sa.Uuid(), nullable=True),
    )
    op.create_index(
        op.f("ix_users_created_by_user_id"),
        "users",
        ["created_by_user_id"],
        unique=False,
    )
    op.create_foreign_key(
        "fk_users_created_by_user_id_users",
        "users",
        "users",
        ["created_by_user_id"],
        ["id"],
        ondelete="SET NULL",
    )


def downgrade() -> None:
    op.drop_constraint("fk_users_created_by_user_id_users", "users", type_="foreignkey")
    op.drop_index(op.f("ix_users_created_by_user_id"), table_name="users")
    op.drop_column("users", "created_by_user_id")

"""make owner product knowledge global

Revision ID: c4d5e6f7a8b9
Revises: b2c4d5e6f7a8
Create Date: 2026-05-11 15:05:00.000000
"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


revision: str = "c4d5e6f7a8b9"
down_revision: str | Sequence[str] | None = "b2c4d5e6f7a8"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.alter_column(
        "product_knowledge",
        "organization_id",
        existing_type=sa.Uuid(),
        nullable=True,
    )
    op.add_column(
        "product_knowledge",
        sa.Column("created_by_user_id", sa.Uuid(), nullable=True),
    )
    op.create_index(
        op.f("ix_product_knowledge_created_by_user_id"),
        "product_knowledge",
        ["created_by_user_id"],
        unique=False,
    )
    op.create_foreign_key(
        "fk_product_knowledge_created_by_user_id_users",
        "product_knowledge",
        "users",
        ["created_by_user_id"],
        ["id"],
        ondelete="SET NULL",
    )


def downgrade() -> None:
    op.drop_constraint(
        "fk_product_knowledge_created_by_user_id_users",
        "product_knowledge",
        type_="foreignkey",
    )
    op.drop_index(
        op.f("ix_product_knowledge_created_by_user_id"),
        table_name="product_knowledge",
    )
    op.drop_column("product_knowledge", "created_by_user_id")
    op.alter_column(
        "product_knowledge",
        "organization_id",
        existing_type=sa.Uuid(),
        nullable=False,
    )

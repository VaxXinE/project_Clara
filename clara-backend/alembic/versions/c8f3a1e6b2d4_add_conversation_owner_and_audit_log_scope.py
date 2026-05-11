"""add conversation owner and audit log scope

Revision ID: c8f3a1e6b2d4
Revises: dbbc1017bd34
Create Date: 2026-05-11 13:45:00.000000

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "c8f3a1e6b2d4"
down_revision: Union[str, Sequence[str], None] = "dbbc1017bd34"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "conversations",
        sa.Column("sales_user_id", sa.Uuid(), nullable=True),
    )
    op.create_index(
        op.f("ix_conversations_sales_user_id"),
        "conversations",
        ["sales_user_id"],
        unique=False,
    )
    op.create_foreign_key(
        None,
        "conversations",
        "users",
        ["sales_user_id"],
        ["id"],
        ondelete="SET NULL",
    )

    op.add_column(
        "audit_logs",
        sa.Column("organization_id", sa.String(length=100), nullable=True),
    )
    op.create_index(
        op.f("ix_audit_logs_organization_id"),
        "audit_logs",
        ["organization_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(
        op.f("ix_audit_logs_organization_id"),
        table_name="audit_logs",
    )
    op.drop_column("audit_logs", "organization_id")

    op.drop_constraint(None, "conversations", type_="foreignkey")
    op.drop_index(
        op.f("ix_conversations_sales_user_id"),
        table_name="conversations",
    )
    op.drop_column("conversations", "sales_user_id")

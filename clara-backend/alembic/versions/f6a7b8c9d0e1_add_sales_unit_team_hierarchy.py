"""add sales unit and team hierarchy

Revision ID: f6a7b8c9d0e1
Revises: c8f3a1e6b2d4, e4a7f2c1b9d0, e5f6a7b8c9d0, f4a1b2c3d4e5
Create Date: 2026-05-20 09:30:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op


revision: str = "f6a7b8c9d0e1"
down_revision: str | Sequence[str] | None = (
    "c8f3a1e6b2d4",
    "e4a7f2c1b9d0",
    "e5f6a7b8c9d0",
    "f4a1b2c3d4e5",
)
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "sales_units",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("organization_id", sa.Uuid(), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("code", sa.String(length=100), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["organization_id"], ["organizations.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("organization_id", "code", name="uq_sales_units_org_code"),
        sa.UniqueConstraint("organization_id", "name", name="uq_sales_units_org_name"),
    )
    op.create_index(op.f("ix_sales_units_organization_id"), "sales_units", ["organization_id"], unique=False)

    op.create_table(
        "sales_teams",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("organization_id", sa.Uuid(), nullable=False),
        sa.Column("unit_id", sa.Uuid(), nullable=True),
        sa.Column("manager_user_id", sa.Uuid(), nullable=True),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("code", sa.String(length=100), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["manager_user_id"], ["users.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["organization_id"], ["organizations.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["unit_id"], ["sales_units.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("organization_id", "code", name="uq_sales_teams_org_code"),
        sa.UniqueConstraint("organization_id", "name", name="uq_sales_teams_org_name"),
    )
    op.create_index(op.f("ix_sales_teams_manager_user_id"), "sales_teams", ["manager_user_id"], unique=False)
    op.create_index(op.f("ix_sales_teams_organization_id"), "sales_teams", ["organization_id"], unique=False)
    op.create_index(op.f("ix_sales_teams_unit_id"), "sales_teams", ["unit_id"], unique=False)

    op.add_column("users", sa.Column("team_id", sa.Uuid(), nullable=True))
    op.create_index(op.f("ix_users_team_id"), "users", ["team_id"], unique=False)
    op.create_foreign_key(
        "fk_users_team_id_sales_teams",
        "users",
        "sales_teams",
        ["team_id"],
        ["id"],
        ondelete="SET NULL",
    )


def downgrade() -> None:
    op.drop_constraint("fk_users_team_id_sales_teams", "users", type_="foreignkey")
    op.drop_index(op.f("ix_users_team_id"), table_name="users")
    op.drop_column("users", "team_id")

    op.drop_index(op.f("ix_sales_teams_unit_id"), table_name="sales_teams")
    op.drop_index(op.f("ix_sales_teams_organization_id"), table_name="sales_teams")
    op.drop_index(op.f("ix_sales_teams_manager_user_id"), table_name="sales_teams")
    op.drop_table("sales_teams")

    op.drop_index(op.f("ix_sales_units_organization_id"), table_name="sales_units")
    op.drop_table("sales_units")

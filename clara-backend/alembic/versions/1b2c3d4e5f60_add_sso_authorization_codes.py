"""add SSO authorization codes

Revision ID: 1b2c3d4e5f60
Revises: 0a1b2c3d4e5f
"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


revision: str = "1b2c3d4e5f60"
down_revision: str | Sequence[str] | None = "0a1b2c3d4e5f"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "sso_authorization_codes",
        sa.Column("code_hash", sa.String(length=64), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("client_id", sa.String(length=100), nullable=False),
        sa.Column("redirect_uri", sa.String(length=2048), nullable=False),
        sa.Column("scope", sa.String(length=255), nullable=False),
        sa.Column("code_challenge", sa.String(length=128), nullable=False),
        sa.Column("nonce", sa.String(length=255), nullable=True),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("used_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("code_hash"),
    )
    op.create_index(
        "ix_sso_authorization_codes_user_id",
        "sso_authorization_codes",
        ["user_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(
        "ix_sso_authorization_codes_user_id",
        table_name="sso_authorization_codes",
    )
    op.drop_table("sso_authorization_codes")

"""add versioned product fact registry

Revision ID: f0a1b2c3d4e5
Revises: e2f3a4b5c6d7
Create Date: 2026-07-31 12:00:00.000000
"""

from collections.abc import Sequence
from datetime import datetime, timezone
from hashlib import sha256
from uuid import UUID

from alembic import op
import sqlalchemy as sa


revision: str = "f0a1b2c3d4e5"
down_revision: str | Sequence[str] | None = "e2f3a4b5c6d7"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "product_facts",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("organization_id", sa.Uuid(), nullable=True),
        sa.Column("fact_key", sa.String(length=120), nullable=False),
        sa.Column("account_category", sa.String(length=20), nullable=False),
        sa.Column("product_code", sa.String(length=100), nullable=True),
        sa.Column("value_type", sa.String(length=20), nullable=False),
        sa.Column("value", sa.JSON(), nullable=False),
        sa.Column("unit", sa.String(length=30), nullable=True),
        sa.Column("lifecycle_status", sa.String(length=20), nullable=False),
        sa.Column("effective_from", sa.DateTime(timezone=True), nullable=True),
        sa.Column("effective_until", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_verified_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("verified_by_user_id", sa.Uuid(), nullable=True),
        sa.Column("source_type", sa.String(length=50), nullable=False),
        sa.Column("source_reference", sa.String(length=500), nullable=False),
        sa.Column("source_hash", sa.String(length=64), nullable=True),
        sa.Column("freshness_class", sa.String(length=30), nullable=False),
        sa.Column("sensitivity_class", sa.String(length=30), nullable=False),
        sa.Column("revision", sa.Integer(), nullable=False),
        sa.Column("supersedes_fact_id", sa.Uuid(), nullable=True),
        sa.Column("created_by_user_id", sa.Uuid(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint(
            "account_category IN ('mini', 'regular', 'global')",
            name="ck_product_facts_account_category",
        ),
        sa.CheckConstraint(
            "value_type IN ('text', 'integer', 'decimal', 'boolean', 'date', 'json')",
            name="ck_product_facts_value_type",
        ),
        sa.CheckConstraint(
            "lifecycle_status IN ('DRAFT', 'APPROVED', 'ACTIVE', 'EXPIRED', 'REVOKED')",
            name="ck_product_facts_lifecycle_status",
        ),
        sa.CheckConstraint(
            "freshness_class IN ('HIGH_VOLATILITY', 'MEDIUM_VOLATILITY', 'LOW_VOLATILITY')",
            name="ck_product_facts_freshness_class",
        ),
        sa.CheckConstraint("revision > 0", name="ck_product_facts_revision"),
        sa.ForeignKeyConstraint(
            ["organization_id"], ["organizations.id"], ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(
            ["verified_by_user_id"], ["users.id"], ondelete="SET NULL"
        ),
        sa.ForeignKeyConstraint(
            ["supersedes_fact_id"], ["product_facts.id"], ondelete="SET NULL"
        ),
        sa.ForeignKeyConstraint(
            ["created_by_user_id"], ["users.id"], ondelete="SET NULL"
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_product_facts_fact_key", "product_facts", ["fact_key"])
    op.create_index(
        "ix_product_facts_lifecycle_status",
        "product_facts",
        ["lifecycle_status"],
    )
    op.create_index(
        "ix_product_facts_organization_id",
        "product_facts",
        ["organization_id"],
    )
    op.create_index(
        "ix_product_facts_resolution",
        "product_facts",
        [
            "organization_id",
            "fact_key",
            "account_category",
            "product_code",
            "lifecycle_status",
        ],
    )
    op.create_index(
        "uq_product_facts_revision",
        "product_facts",
        [
            "organization_id",
            "fact_key",
            "account_category",
            "product_code",
            "revision",
        ],
        unique=True,
        postgresql_nulls_not_distinct=True,
    )
    _seed_verified_legacy_facts()


def _seed_verified_legacy_facts() -> None:
    table = sa.table(
        "product_facts",
        sa.column("id", sa.Uuid()),
        sa.column("organization_id", sa.Uuid()),
        sa.column("fact_key", sa.String()),
        sa.column("account_category", sa.String()),
        sa.column("product_code", sa.String()),
        sa.column("value_type", sa.String()),
        sa.column("value", sa.JSON()),
        sa.column("unit", sa.String()),
        sa.column("lifecycle_status", sa.String()),
        sa.column("effective_from", sa.DateTime(timezone=True)),
        sa.column("effective_until", sa.DateTime(timezone=True)),
        sa.column("last_verified_at", sa.DateTime(timezone=True)),
        sa.column("verified_by_user_id", sa.Uuid()),
        sa.column("source_type", sa.String()),
        sa.column("source_reference", sa.String()),
        sa.column("source_hash", sa.String()),
        sa.column("freshness_class", sa.String()),
        sa.column("sensitivity_class", sa.String()),
        sa.column("revision", sa.Integer()),
        sa.column("supersedes_fact_id", sa.Uuid()),
        sa.column("created_by_user_id", sa.Uuid()),
        sa.column("created_at", sa.DateTime(timezone=True)),
        sa.column("updated_at", sa.DateTime(timezone=True)),
    )
    now = datetime.now(timezone.utc)
    seeds = (
        (
            UUID("60000000-0000-0000-0000-000000000001"),
            "account.minimum_opening_amount",
            "mini",
            "integer",
            5_000_000,
            "IDR",
            "MEDIUM_VOLATILITY",
            "clara-backend/app/services/clara_legacy_behavior_service.py",
        ),
        (
            UUID("60000000-0000-0000-0000-000000000002"),
            "company.regulator",
            "global",
            "text",
            "BAPPEBTI",
            None,
            "LOW_VOLATILITY",
            "clara-backend/app/services/official_source_service.py",
        ),
        (
            UUID("60000000-0000-0000-0000-000000000003"),
            "company.regulatory_status",
            "global",
            "text",
            "PT Solid Gold Berjangka diawasi BAPPEBTI.",
            None,
            "LOW_VOLATILITY",
            "clara-backend/app/services/clara_legacy_behavior_service.py",
        ),
    )
    connection = op.get_bind()
    for fact_id, key, category, value_type, value, unit, freshness, source in seeds:
        exists = connection.scalar(
            sa.select(sa.func.count()).select_from(table).where(table.c.id == fact_id)
        )
        if exists:
            continue
        value_hash = sha256(str(value).encode("utf-8")).hexdigest()
        connection.execute(
            table.insert().values(
                id=fact_id,
                organization_id=None,
                fact_key=key,
                account_category=category,
                product_code=None,
                value_type=value_type,
                value=value,
                unit=unit,
                lifecycle_status="ACTIVE",
                effective_from=now,
                effective_until=None,
                last_verified_at=now,
                verified_by_user_id=None,
                source_type="approved_repository_source",
                source_reference=source,
                source_hash=value_hash,
                freshness_class=freshness,
                sensitivity_class="CUSTOMER_SAFE",
                revision=1,
                supersedes_fact_id=None,
                created_by_user_id=None,
                created_at=now,
                updated_at=now,
            )
        )


def downgrade() -> None:
    op.drop_index("uq_product_facts_revision", table_name="product_facts")
    op.drop_index("ix_product_facts_resolution", table_name="product_facts")
    op.drop_index("ix_product_facts_organization_id", table_name="product_facts")
    op.drop_index("ix_product_facts_lifecycle_status", table_name="product_facts")
    op.drop_index("ix_product_facts_fact_key", table_name="product_facts")
    op.drop_table("product_facts")

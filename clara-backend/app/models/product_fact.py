from datetime import datetime, timezone
from uuid import UUID, uuid4

from sqlalchemy import (
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    JSON,
    String,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.db.session import Base


class ProductFact(Base):
    __tablename__ = "product_facts"
    __table_args__ = (
        CheckConstraint(
            "account_category IN ('mini', 'regular', 'global')",
            name="ck_product_facts_account_category",
        ),
        CheckConstraint(
            "value_type IN ('text', 'integer', 'decimal', 'boolean', 'date', 'json')",
            name="ck_product_facts_value_type",
        ),
        CheckConstraint(
            "lifecycle_status IN ('DRAFT', 'APPROVED', 'ACTIVE', 'EXPIRED', 'REVOKED')",
            name="ck_product_facts_lifecycle_status",
        ),
        CheckConstraint(
            "freshness_class IN ('HIGH_VOLATILITY', 'MEDIUM_VOLATILITY', 'LOW_VOLATILITY')",
            name="ck_product_facts_freshness_class",
        ),
        CheckConstraint("revision > 0", name="ck_product_facts_revision"),
        Index(
            "uq_product_facts_revision",
            "organization_id",
            "fact_key",
            "account_category",
            "product_code",
            "revision",
            unique=True,
            postgresql_nulls_not_distinct=True,
        ),
        Index(
            "ix_product_facts_resolution",
            "organization_id",
            "fact_key",
            "account_category",
            "product_code",
            "lifecycle_status",
        ),
    )

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    organization_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("organizations.id", ondelete="CASCADE"), nullable=True, index=True
    )
    fact_key: Mapped[str] = mapped_column(String(120), nullable=False, index=True)
    account_category: Mapped[str] = mapped_column(String(20), nullable=False)
    product_code: Mapped[str | None] = mapped_column(String(100), nullable=True)
    value_type: Mapped[str] = mapped_column(String(20), nullable=False)
    value: Mapped[object] = mapped_column(JSON, nullable=False)
    unit: Mapped[str | None] = mapped_column(String(30), nullable=True)
    lifecycle_status: Mapped[str] = mapped_column(
        String(20), nullable=False, default="DRAFT", index=True
    )
    effective_from: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    effective_until: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    last_verified_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    verified_by_user_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    source_type: Mapped[str] = mapped_column(String(50), nullable=False)
    source_reference: Mapped[str] = mapped_column(String(500), nullable=False)
    source_hash: Mapped[str | None] = mapped_column(String(64), nullable=True)
    freshness_class: Mapped[str] = mapped_column(String(30), nullable=False)
    sensitivity_class: Mapped[str] = mapped_column(
        String(30), nullable=False, default="CUSTOMER_SAFE"
    )
    revision: Mapped[int] = mapped_column(Integer, nullable=False)
    supersedes_fact_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("product_facts.id", ondelete="SET NULL"), nullable=True
    )
    created_by_user_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

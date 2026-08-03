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
    UniqueConstraint,
    text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base


class AIPersonaBundle(Base):
    __tablename__ = "ai_persona_bundles"
    __table_args__ = (
        CheckConstraint(
            "variant IN ('mini', 'reguler')",
            name="ck_ai_persona_bundles_variant",
        ),
        CheckConstraint(
            "status IN ('draft', 'validated', 'published', 'archived', 'rejected')",
            name="ck_ai_persona_bundles_status",
        ),
        CheckConstraint(
            "validation_status IN ('pending', 'valid', 'invalid')",
            name="ck_ai_persona_bundles_validation_status",
        ),
        CheckConstraint("bundle_version > 0", name="ck_ai_persona_bundles_version"),
        Index(
            "uq_ai_persona_bundles_version",
            "variant",
            "bundle_version",
            unique=True,
        ),
        Index(
            "uq_ai_persona_bundles_published",
            "variant",
            unique=True,
            postgresql_where=text("status = 'published'"),
            sqlite_where=text("status = 'published'"),
        ),
        Index("ix_ai_persona_bundles_lookup", "variant", "status"),
    )

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    variant: Mapped[str] = mapped_column(String(20), nullable=False)
    bundle_version: Mapped[int] = mapped_column(Integer, nullable=False)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="draft")
    bundle_sha256: Mapped[str | None] = mapped_column(String(64), nullable=True)
    source_type: Mapped[str] = mapped_column(String(40), nullable=False)
    source_bundle_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("ai_persona_bundles.id", ondelete="SET NULL"), nullable=True
    )
    validation_status: Mapped[str] = mapped_column(
        String(20), nullable=False, default="pending"
    )
    validation_report: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
    validation_report_hash: Mapped[str | None] = mapped_column(String(64), nullable=True)
    validation_contract_version: Mapped[str | None] = mapped_column(
        String(20), nullable=True
    )
    created_by_user_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    validated_by_user_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    published_by_user_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )
    validated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    published_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    archived_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    sections = relationship(
        "AIPersonaBundleSection",
        back_populates="bundle",
        cascade="all, delete-orphan",
        order_by="AIPersonaBundleSection.position",
    )


class AIPersonaBundleSection(Base):
    __tablename__ = "ai_persona_bundle_sections"
    __table_args__ = (
        CheckConstraint(
            "section_key IN ('instruction', 'guardrail', 'flow', 'personality_mode', 'auto_adapt')",
            name="ck_ai_persona_bundle_sections_key",
        ),
        CheckConstraint("position BETWEEN 1 AND 5", name="ck_ai_persona_bundle_sections_position"),
        CheckConstraint("character_count BETWEEN 1 AND 50000", name="ck_ai_persona_bundle_sections_character_count"),
        UniqueConstraint("bundle_id", "section_key", name="uq_ai_persona_bundle_sections_key"),
        UniqueConstraint("bundle_id", "position", name="uq_ai_persona_bundle_sections_position"),
    )

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    bundle_id: Mapped[UUID] = mapped_column(
        ForeignKey("ai_persona_bundles.id", ondelete="CASCADE"), nullable=False, index=True
    )
    section_key: Mapped[str] = mapped_column(String(50), nullable=False)
    persona_config_version_id: Mapped[UUID] = mapped_column(
        ForeignKey("ai_persona_config_versions.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    position: Mapped[int] = mapped_column(Integer, nullable=False)
    content_sha256: Mapped[str] = mapped_column(String(64), nullable=False)
    character_count: Mapped[int] = mapped_column(Integer, nullable=False)
    source_type: Mapped[str] = mapped_column(String(50), nullable=False)
    source_identifier: Mapped[str | None] = mapped_column(String(255), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )

    bundle = relationship("AIPersonaBundle", back_populates="sections")
    persona_config_version = relationship("AIPersonaConfigVersion")

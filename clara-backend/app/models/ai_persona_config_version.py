from datetime import datetime, timezone
from uuid import UUID, uuid4

from sqlalchemy import (
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    text,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.db.session import Base


class AIPersonaConfigVersion(Base):
    __tablename__ = "ai_persona_config_versions"
    __table_args__ = (
        CheckConstraint(
            "variant IN ('mini', 'reguler')",
            name="ck_ai_persona_config_versions_variant",
        ),
        CheckConstraint(
            "section_key IN "
            "('instruction', 'guardrail', 'flow', 'personality_mode', 'auto_adapt')",
            name="ck_ai_persona_config_versions_section_key",
        ),
        CheckConstraint(
            "status IN ('draft', 'published', 'archived')",
            name="ck_ai_persona_config_versions_status",
        ),
        CheckConstraint(
            "version_number > 0",
            name="ck_ai_persona_config_versions_version_number",
        ),
        Index(
            "uq_ai_persona_config_versions_number",
            "variant",
            "section_key",
            "version_number",
            unique=True,
        ),
        Index(
            "uq_ai_persona_config_versions_published",
            "variant",
            "section_key",
            unique=True,
            postgresql_where=text("status = 'published'"),
            sqlite_where=text("status = 'published'"),
        ),
        Index(
            "ix_ai_persona_config_versions_lookup",
            "variant",
            "section_key",
            "status",
        ),
    )

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    variant: Mapped[str] = mapped_column(String(20), nullable=False)
    section_key: Mapped[str] = mapped_column(String(50), nullable=False)
    version_number: Mapped[int] = mapped_column(Integer, nullable=False)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="draft")
    content: Mapped[str] = mapped_column(Text, nullable=False)
    content_sha256: Mapped[str] = mapped_column(String(64), nullable=False)
    created_by_user_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    published_by_user_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    source_version_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("ai_persona_config_versions.id", ondelete="SET NULL"),
        nullable=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
    published_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

from datetime import datetime, timezone
from uuid import UUID, uuid4

from sqlalchemy import DateTime, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.db.session import Base


class ExtensionDeliveryAuthorization(Base):
    __tablename__ = "extension_delivery_authorizations"
    __table_args__ = (
        UniqueConstraint(
            "organization_id",
            "user_id",
            "idempotency_key",
            name="uq_extension_delivery_authorization_idempotency",
        ),
    )

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    organization_id: Mapped[UUID] = mapped_column(
        ForeignKey("organizations.id", ondelete="CASCADE"), index=True
    )
    user_id: Mapped[UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    conversation_id: Mapped[UUID] = mapped_column(
        ForeignKey("conversations.id", ondelete="CASCADE"), index=True
    )
    reply_suggestion_id: Mapped[UUID] = mapped_column(
        ForeignKey("reply_suggestions.id", ondelete="CASCADE"), index=True
    )
    channel: Mapped[str] = mapped_column(String(30), nullable=False)
    status: Mapped[str] = mapped_column(String(40), nullable=False, index=True)
    snapshot_fingerprint: Mapped[str] = mapped_column(String(64), nullable=False)
    latest_message_fingerprint: Mapped[str] = mapped_column(String(64), nullable=False)
    active_chat_fingerprint: Mapped[str] = mapped_column(String(64), nullable=False)
    final_text_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    decision_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    token_hash: Mapped[str | None] = mapped_column(
        String(64), nullable=True, unique=True
    )
    browser_event_hash: Mapped[str | None] = mapped_column(String(64), nullable=True)
    idempotency_key: Mapped[str] = mapped_column(String(128), nullable=False)
    suggestion_version: Mapped[int] = mapped_column(Integer, nullable=False)
    expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    claimed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    version: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
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


class ExtensionDeliveryEvent(Base):
    __tablename__ = "extension_delivery_events"

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    authorization_id: Mapped[UUID] = mapped_column(
        ForeignKey("extension_delivery_authorizations.id", ondelete="CASCADE"),
        index=True,
    )
    organization_id: Mapped[UUID] = mapped_column(
        ForeignKey("organizations.id", ondelete="CASCADE"), index=True
    )
    conversation_id: Mapped[UUID] = mapped_column(
        ForeignKey("conversations.id", ondelete="CASCADE"), index=True
    )
    reply_suggestion_id: Mapped[UUID] = mapped_column(
        ForeignKey("reply_suggestions.id", ondelete="CASCADE"), index=True
    )
    event_type: Mapped[str] = mapped_column(String(40), nullable=False)
    previous_status: Mapped[str | None] = mapped_column(String(40))
    new_status: Mapped[str] = mapped_column(String(40), nullable=False)
    actor_user_id: Mapped[UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    reason_codes: Mapped[list[str]] = mapped_column(JSONB, nullable=False, default=list)
    event_fingerprint: Mapped[str] = mapped_column(
        String(64), nullable=False, unique=True
    )
    safe_metadata: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

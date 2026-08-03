"""add extension delivery governance

Revision ID: fa0b1c2d3e4f
Revises: e9f0a1b2c3d4
"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa

revision: str = "fa0b1c2d3e4f"
down_revision: str | Sequence[str] | None = "e9f0a1b2c3d4"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "reply_suggestions",
        sa.Column("extension_snapshot_fingerprint", sa.String(64), nullable=True),
    )
    op.add_column(
        "reply_suggestions",
        sa.Column("extension_latest_message_fingerprint", sa.String(64), nullable=True),
    )
    op.add_column(
        "reply_suggestions",
        sa.Column("extension_active_chat_fingerprint", sa.String(64), nullable=True),
    )
    op.add_column(
        "reply_suggestions",
        sa.Column("version", sa.Integer(), server_default="1", nullable=False),
    )
    op.alter_column("reply_suggestions", "version", server_default=None)

    op.drop_index("ix_sent_messages_reply_suggestion_id", table_name="sent_messages")
    op.create_index(
        "ix_sent_messages_reply_suggestion_id",
        "sent_messages",
        ["reply_suggestion_id"],
        unique=True,
    )

    op.create_table(
        "extension_delivery_authorizations",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("organization_id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("conversation_id", sa.Uuid(), nullable=False),
        sa.Column("reply_suggestion_id", sa.Uuid(), nullable=False),
        sa.Column("channel", sa.String(30), nullable=False),
        sa.Column("status", sa.String(40), nullable=False),
        sa.Column("snapshot_fingerprint", sa.String(64), nullable=False),
        sa.Column("latest_message_fingerprint", sa.String(64), nullable=False),
        sa.Column("active_chat_fingerprint", sa.String(64), nullable=False),
        sa.Column("final_text_hash", sa.String(64), nullable=False),
        sa.Column("decision_hash", sa.String(64), nullable=False),
        sa.Column("token_hash", sa.String(64), nullable=True),
        sa.Column("browser_event_hash", sa.String(64), nullable=True),
        sa.Column("idempotency_key", sa.String(128), nullable=False),
        sa.Column("suggestion_version", sa.Integer(), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("claimed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("version", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["organization_id"], ["organizations.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["conversation_id"], ["conversations.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["reply_suggestion_id"], ["reply_suggestions.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("token_hash"),
        sa.UniqueConstraint(
            "organization_id",
            "user_id",
            "idempotency_key",
            name="uq_extension_delivery_authorization_idempotency",
        ),
    )
    for column in (
        "organization_id",
        "user_id",
        "conversation_id",
        "reply_suggestion_id",
        "status",
    ):
        op.create_index(
            f"ix_extension_delivery_authorizations_{column}",
            "extension_delivery_authorizations",
            [column],
        )

    op.create_table(
        "extension_delivery_events",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("authorization_id", sa.Uuid(), nullable=False),
        sa.Column("organization_id", sa.Uuid(), nullable=False),
        sa.Column("conversation_id", sa.Uuid(), nullable=False),
        sa.Column("reply_suggestion_id", sa.Uuid(), nullable=False),
        sa.Column("event_type", sa.String(40), nullable=False),
        sa.Column("previous_status", sa.String(40), nullable=True),
        sa.Column("new_status", sa.String(40), nullable=False),
        sa.Column("actor_user_id", sa.Uuid(), nullable=False),
        sa.Column("reason_codes", sa.JSON(), nullable=False),
        sa.Column("event_fingerprint", sa.String(64), nullable=False),
        sa.Column("safe_metadata", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(
            ["authorization_id"],
            ["extension_delivery_authorizations.id"],
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(["organization_id"], ["organizations.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["conversation_id"], ["conversations.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["reply_suggestion_id"], ["reply_suggestions.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["actor_user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("event_fingerprint"),
    )
    for column in (
        "authorization_id",
        "organization_id",
        "conversation_id",
        "reply_suggestion_id",
        "actor_user_id",
    ):
        op.create_index(
            f"ix_extension_delivery_events_{column}",
            "extension_delivery_events",
            [column],
        )


def downgrade() -> None:
    op.drop_table("extension_delivery_events")
    op.drop_table("extension_delivery_authorizations")
    op.drop_index("ix_sent_messages_reply_suggestion_id", table_name="sent_messages")
    op.create_index(
        "ix_sent_messages_reply_suggestion_id",
        "sent_messages",
        ["reply_suggestion_id"],
        unique=False,
    )
    op.drop_column("reply_suggestions", "version")
    op.drop_column("reply_suggestions", "extension_active_chat_fingerprint")
    op.drop_column("reply_suggestions", "extension_latest_message_fingerprint")
    op.drop_column("reply_suggestions", "extension_snapshot_fingerprint")

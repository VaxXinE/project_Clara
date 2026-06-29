"""add generic channel provider metadata

Revision ID: a6b7c8d9e0f1
Revises: b3c4d5e6f7a8, fbe2c3d4e5f6
Create Date: 2026-06-26 16:10:00.000000
"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


revision: str = "a6b7c8d9e0f1"
down_revision: str | Sequence[str] | None = (
    "b3c4d5e6f7a8",
    "fbe2c3d4e5f6",
)
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "conversations",
        sa.Column("channel", sa.String(length=50), nullable=True),
    )
    op.add_column(
        "conversations",
        sa.Column("provider", sa.String(length=50), nullable=True),
    )
    op.add_column(
        "conversations",
        sa.Column("external_thread_id", sa.String(length=255), nullable=True),
    )
    op.alter_column(
        "conversations",
        "source",
        existing_type=sa.String(length=50),
        type_=sa.String(length=100),
        existing_nullable=False,
    )
    op.create_index(op.f("ix_conversations_channel"), "conversations", ["channel"], unique=False)
    op.create_index(op.f("ix_conversations_provider"), "conversations", ["provider"], unique=False)
    op.create_index(
        op.f("ix_conversations_external_thread_id"),
        "conversations",
        ["external_thread_id"],
        unique=False,
    )

    op.add_column(
        "messages",
        sa.Column("channel", sa.String(length=50), nullable=True),
    )
    op.add_column(
        "messages",
        sa.Column("provider", sa.String(length=50), nullable=True),
    )
    op.add_column(
        "messages",
        sa.Column("fingerprint", sa.String(length=255), nullable=True),
    )
    op.create_index(op.f("ix_messages_channel"), "messages", ["channel"], unique=False)
    op.create_index(op.f("ix_messages_provider"), "messages", ["provider"], unique=False)
    op.create_index(op.f("ix_messages_fingerprint"), "messages", ["fingerprint"], unique=False)
    op.drop_index(op.f("ix_messages_external_message_id"), table_name="messages")
    op.create_index(
        op.f("ix_messages_external_message_id"),
        "messages",
        ["external_message_id"],
        unique=False,
    )
    op.create_unique_constraint(
        "uq_messages_provider_channel_external_message_id",
        "messages",
        ["provider", "channel", "external_message_id"],
    )

    op.add_column(
        "reply_suggestions",
        sa.Column("channel", sa.String(length=50), nullable=True),
    )
    op.add_column(
        "reply_suggestions",
        sa.Column("provider", sa.String(length=50), nullable=True),
    )
    op.create_index(
        op.f("ix_reply_suggestions_channel"),
        "reply_suggestions",
        ["channel"],
        unique=False,
    )
    op.create_index(
        op.f("ix_reply_suggestions_provider"),
        "reply_suggestions",
        ["provider"],
        unique=False,
    )

    op.add_column(
        "audit_logs",
        sa.Column("channel", sa.String(length=50), nullable=True),
    )
    op.add_column(
        "audit_logs",
        sa.Column("provider", sa.String(length=50), nullable=True),
    )
    op.create_index(op.f("ix_audit_logs_channel"), "audit_logs", ["channel"], unique=False)
    op.create_index(op.f("ix_audit_logs_provider"), "audit_logs", ["provider"], unique=False)

    op.execute(
        """
        UPDATE conversations
        SET
            channel = COALESCE(
                channel,
                CASE
                    WHEN source LIKE 'whatsapp%%' OR source LIKE 'wa_%%' THEN 'whatsapp'
                    WHEN source LIKE 'instagram%%' OR source LIKE 'ig_%%' THEN 'instagram'
                    WHEN source LIKE 'tiktok%%' OR source LIKE 'tt_%%' THEN 'tiktok'
                    WHEN source LIKE 'telegram%%' OR source LIKE 'tg_%%' THEN 'telegram'
                    ELSE 'whatsapp'
                END
            ),
            provider = COALESCE(
                provider,
                CASE
                    WHEN provider_key IN ('manual_upload', 'manual', 'manual_import') THEN 'manual'
                    WHEN provider_key IN ('meta', 'official_api') THEN 'official_api'
                    WHEN source LIKE '%%_extension' THEN 'extension'
                    WHEN source LIKE '%%_webhook' THEN 'official_api'
                    WHEN source LIKE '%%_txt' OR source LIKE '%%manual%%' OR source LIKE '%%import%%' THEN 'manual'
                    ELSE 'extension'
                END
            ),
            external_thread_id = COALESCE(external_thread_id, external_thread_key),
            source = CASE
                WHEN source IS NULL OR btrim(source) = '' THEN
                    CASE
                        WHEN provider_key IN ('meta', 'official_api') THEN 'whatsapp_webhook'
                        WHEN provider_key IN ('manual_upload', 'manual', 'manual_import')
                             AND (source LIKE 'telegram%%' OR source LIKE 'tg_%%') THEN 'telegram_txt'
                        WHEN provider_key IN ('manual_upload', 'manual', 'manual_import') THEN 'whatsapp_txt'
                        WHEN source LIKE 'instagram%%' OR source LIKE 'ig_%%' THEN 'instagram_extension'
                        WHEN source LIKE 'tiktok%%' OR source LIKE 'tt_%%' THEN 'tiktok_extension'
                        WHEN source LIKE 'telegram%%' OR source LIKE 'tg_%%' THEN 'telegram_extension'
                        WHEN source LIKE '%%_extension' THEN source
                        ELSE 'whatsapp_extension'
                    END
                ELSE source
            END
        """
    )

    op.execute(
        """
        UPDATE messages AS m
        SET
            channel = COALESCE(m.channel, c.channel),
            provider = COALESCE(m.provider, c.provider),
            fingerprint = COALESCE(
                m.fingerprint,
                CASE
                    WHEN m.external_message_id IS NOT NULL AND btrim(m.external_message_id) <> '' THEN
                        md5(
                            COALESCE(c.provider, '') || ':' ||
                            COALESCE(c.channel, '') || ':' ||
                            m.external_message_id
                        )
                    ELSE
                        md5(
                            CAST(m.conversation_id AS text) || ':' ||
                            COALESCE(m.sender_name, '') || ':' ||
                            COALESCE(m.sender_type, '') || ':' ||
                            COALESCE(m.message_text, '') || ':' ||
                            COALESCE(CAST(m.message_timestamp AS text), '')
                        )
                END
            )
        FROM conversations AS c
        WHERE m.conversation_id = c.id
        """
    )

    op.execute(
        """
        UPDATE reply_suggestions AS rs
        SET
            channel = COALESCE(rs.channel, c.channel),
            provider = COALESCE(rs.provider, c.provider)
        FROM conversations AS c
        WHERE rs.conversation_id = c.id
        """
    )

    op.execute(
        """
        UPDATE audit_logs
        SET
            channel = COALESCE(channel, metadata_json->>'channel'),
            provider = COALESCE(provider, metadata_json->>'provider')
        """
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_audit_logs_provider"), table_name="audit_logs")
    op.drop_index(op.f("ix_audit_logs_channel"), table_name="audit_logs")
    op.drop_column("audit_logs", "provider")
    op.drop_column("audit_logs", "channel")

    op.drop_index(op.f("ix_reply_suggestions_provider"), table_name="reply_suggestions")
    op.drop_index(op.f("ix_reply_suggestions_channel"), table_name="reply_suggestions")
    op.drop_column("reply_suggestions", "provider")
    op.drop_column("reply_suggestions", "channel")

    op.drop_constraint(
        "uq_messages_provider_channel_external_message_id",
        "messages",
        type_="unique",
    )
    op.drop_index(op.f("ix_messages_fingerprint"), table_name="messages")
    op.drop_index(op.f("ix_messages_provider"), table_name="messages")
    op.drop_index(op.f("ix_messages_channel"), table_name="messages")
    op.drop_index(op.f("ix_messages_external_message_id"), table_name="messages")
    op.create_index(
        op.f("ix_messages_external_message_id"),
        "messages",
        ["external_message_id"],
        unique=True,
    )
    op.drop_column("messages", "fingerprint")
    op.drop_column("messages", "provider")
    op.drop_column("messages", "channel")

    op.drop_index(op.f("ix_conversations_external_thread_id"), table_name="conversations")
    op.drop_index(op.f("ix_conversations_provider"), table_name="conversations")
    op.drop_index(op.f("ix_conversations_channel"), table_name="conversations")
    op.alter_column(
        "conversations",
        "source",
        existing_type=sa.String(length=100),
        type_=sa.String(length=50),
        existing_nullable=False,
    )
    op.drop_column("conversations", "external_thread_id")
    op.drop_column("conversations", "provider")
    op.drop_column("conversations", "channel")

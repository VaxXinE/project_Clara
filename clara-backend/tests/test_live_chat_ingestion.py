import hashlib
import hmac
import json
import time
from uuid import UUID

import pytest
from sqlalchemy import select
from sqlalchemy.orm import sessionmaker

from app.core.config import settings
from app.models.audit_log import AuditLog
from app.models.conversation import Conversation
from app.models.lead import Lead
from app.models.message import Message

SITE_ID = "website-main"
WEBHOOK_SECRET = "test-live-chat-secret-with-32-bytes-minimum"


def configure_live_chat(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(
        settings,
        "live_chat_site_configs",
        {
            SITE_ID: {
                "webhook_secret": WEBHOOK_SECRET,
                "organization_slug": "org-alpha",
                "sales_user_email": "marketing.beta@clara.local",
            }
        },
    )


def event_payload() -> dict:
    return {
        "event": "conversation.upserted",
        "eventId": "evt-live-chat-001",
        "occurredAt": "2026-08-31T10:00:00Z",
        "conversation": {
            "id": "conversation-001",
            "title": "Visitor Clara",
            "visitor": {
                "name": "Visitor Clara",
                "email": "visitor@example.invalid",
            },
            "messages": [
                {
                    "id": "message-001",
                    "senderType": "customer",
                    "senderName": "Visitor Clara",
                    "text": "Halo, saya ingin bertanya.",
                    "sentAt": "2026-08-31T09:59:00Z",
                },
                {
                    "id": "message-002",
                    "senderType": "sales",
                    "senderName": "Marketing Beta",
                    "text": "Tentu, ada yang bisa dibantu?",
                    "sentAt": "2026-08-31T10:00:00Z",
                },
            ],
        },
    }


def signed_request(
    payload: dict, *, timestamp: int | None = None
) -> tuple[bytes, dict[str, str]]:
    raw_body = json.dumps(payload, separators=(",", ":")).encode("utf-8")
    timestamp_value = timestamp or int(time.time())
    timestamp_header = str(timestamp_value)
    digest = hmac.new(
        WEBHOOK_SECRET.encode("utf-8"),
        timestamp_header.encode("ascii") + b"." + raw_body,
        hashlib.sha256,
    ).hexdigest()
    return raw_body, {
        "Content-Type": "application/json",
        "X-Clara-Site-Id": SITE_ID,
        "X-Clara-Timestamp": timestamp_header,
        "X-Clara-Signature": f"sha256={digest}",
    }


def test_live_chat_requires_valid_fresh_signature(client, monkeypatch) -> None:
    configure_live_chat(monkeypatch)
    payload = event_payload()
    missing = client.post("/webhooks/live-chat/events", json=payload)
    stale_body, stale_headers = signed_request(
        payload, timestamp=int(time.time()) - 301
    )
    stale = client.post(
        "/webhooks/live-chat/events", content=stale_body, headers=stale_headers
    )
    invalid_body, invalid_headers = signed_request(payload)
    invalid_headers["X-Clara-Signature"] = "sha256=" + "0" * 64
    invalid = client.post(
        "/webhooks/live-chat/events", content=invalid_body, headers=invalid_headers
    )

    assert missing.status_code == 401
    assert stale.status_code == 401
    assert invalid.status_code == 401


def test_live_chat_snapshot_is_tenant_scoped_and_idempotent(
    client,
    db_session_factory: sessionmaker,
    seeded_data: dict[str, object],
    monkeypatch,
) -> None:
    configure_live_chat(monkeypatch)
    raw_body, headers = signed_request(event_payload())

    first = client.post("/webhooks/live-chat/events", content=raw_body, headers=headers)
    replay = client.post(
        "/webhooks/live-chat/events", content=raw_body, headers=headers
    )

    assert first.status_code == 200, first.text
    assert replay.status_code == 200, replay.text
    assert first.json()["status"] == "created"
    assert first.json()["processed_messages"] == 2
    assert replay.json()["status"] == "duplicate"
    assert replay.json()["duplicate_messages"] == 2

    db = db_session_factory()
    conversation = db.get(Conversation, UUID(first.json()["conversation_id"]))
    assert conversation is not None
    assert conversation.organization_id == seeded_data["org_a"].id
    assert conversation.sales_user_id == seeded_data["marketing_b"].id
    assert conversation.channel == "live_chat"
    assert conversation.provider == "official_api"
    assert conversation.provider_key == "website"
    assert conversation.source == "website_live_chat"
    assert conversation.external_thread_key == f"livechat:{SITE_ID}:conversation-001"

    messages = db.scalars(
        select(Message).where(Message.conversation_id == conversation.id)
    ).all()
    assert len(messages) == 2
    assert all(message.external_message_id.startswith("lcmsg:") for message in messages)

    lead = db.get(Lead, conversation.lead_id)
    assert lead is not None
    assert lead.organization_id == seeded_data["org_a"].id
    assert lead.source == "website_live_chat"

    audit_logs = db.scalars(
        select(AuditLog).where(AuditLog.action == "webhook.live_chat.ingest")
    ).all()
    assert len(audit_logs) == 2
    assert all(log.channel == "live_chat" for log in audit_logs)
    assert all("text" not in log.metadata_json for log in audit_logs)
    db.close()

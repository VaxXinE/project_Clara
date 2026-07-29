import hashlib
import hmac
import json
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import sessionmaker

from app.core.config import settings
from app.models.audit_log import AuditLog
from app.models.conversation import Conversation
from app.models.lead import Lead
from app.models.message import Message


def sign_tawk_payload(payload: dict) -> tuple[str, bytes]:
    raw_body = json.dumps(payload).encode("utf-8")
    digest = hmac.new(
        settings.tawk_webhook_secret_key.encode("utf-8"),
        raw_body,
        hashlib.sha1,
    ).hexdigest()
    return digest, raw_body


def test_tawk_webhook_rejects_invalid_signature(client, monkeypatch) -> None:
    monkeypatch.setattr(settings, "tawk_webhook_secret_key", "tawk-secret")
    monkeypatch.setattr(settings, "tawk_default_organization_slug", "org-alpha")
    monkeypatch.setattr(settings, "tawk_default_sales_user_email", "marketing.alpha@clara.local")

    payload = {
        "event": "chat:transcript_created",
        "time": "2024-07-03T01:02:37.780Z",
        "domain": "tawk.to",
        "referrer": "https://www.google.com/",
        "property": {"id": "58ca8453b8a7e060cd3b1ecb", "name": "Bobs Burgers"},
        "chat": {
            "id": "70fe3290-99ad-11e9-a30a-51567162179f",
            "visitor": {"name": "Visitor One"},
            "messages": [],
        },
    }
    response = client.post(
        "/webhooks/tawk",
        json=payload,
        headers={"X-Tawk-Signature": "badbadbad"},
    )
    assert response.status_code == 401, response.text


def test_tawk_transcript_webhook_is_accepted_and_audited(
    client,
    db_session_factory: sessionmaker,
    seeded_data: dict[str, object],
    monkeypatch,
) -> None:
    monkeypatch.setattr(settings, "tawk_webhook_secret_key", "tawk-secret")
    monkeypatch.setattr(settings, "tawk_default_organization_slug", "org-alpha")
    monkeypatch.setattr(settings, "tawk_default_sales_user_email", "marketing.alpha@clara.local")

    payload = {
        "event": "chat:transcript_created",
        "time": "2024-07-03T01:02:37.780Z",
        "domain": "tawk.to",
        "referrer": "https://www.google.com/",
        "property": {"id": "58ca8453b8a7e060cd3b1ecb", "name": "Bobs Burgers"},
        "chat": {
            "id": "70fe3290-99ad-11e9-a30a-51567162179f",
            "visitor": {
                "name": "V1561719148780935",
                "email": "hello@test.com",
                "city": "jelgava",
                "country": "LV",
            },
            "messages": [
                {
                    "sender": {"t": "s", "n": "Customer Support"},
                    "type": "msg",
                    "msg": "Hi! How can we help?",
                    "time": "2024-07-03T01:02:37.780Z",
                },
                {
                    "sender": {"t": "v"},
                    "type": "msg",
                    "msg": "Tell me more",
                    "time": "2024-07-03T01:02:48.176Z",
                },
            ],
        },
    }
    signature, raw_body = sign_tawk_payload(payload)

    response = client.post(
        "/webhooks/tawk",
        content=raw_body,
        headers={
            "Content-Type": "application/json",
            "X-Tawk-Signature": signature,
            "X-Hook-Event-Id": "evt_123",
        },
    )
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["provider"] == "tawk.to"
    assert body["event"] == "chat:transcript_created"
    assert body["event_id"] == "evt_123"
    assert body["property_id"] == "58ca8453b8a7e060cd3b1ecb"
    assert body["chat_id"] == "70fe3290-99ad-11e9-a30a-51567162179f"
    assert body["processed_messages"] == 2
    assert body["duplicate_messages"] == 0
    assert body["ignored_events"] == 0
    assert len(body["conversation_ids"]) == 1
    assert body["transcript_message_count"] == 2

    db = db_session_factory()
    conversation = db.get(Conversation, UUID(body["conversation_ids"][0]))
    assert conversation is not None
    assert conversation.channel == "live_chat"
    assert conversation.provider == "official_api"
    assert conversation.provider_key == "tawk"
    assert conversation.source == "tawk_webhook"
    assert conversation.sales_user_id == seeded_data["marketing_a"].id
    assert conversation.external_thread_id == "tawk:58ca8453b8a7e060cd3b1ecb:70fe3290-99ad-11e9-a30a-51567162179f"
    assert "Customer Support: Hi! How can we help?" in (conversation.raw_text or "")
    assert "V1561719148780935: Tell me more" in (conversation.raw_text or "")

    messages = list(
        db.scalars(
            select(Message).where(Message.conversation_id == conversation.id)
        ).all()
    )
    assert len(messages) == 2
    assert all(message.channel == "live_chat" for message in messages)
    assert all(message.provider == "official_api" for message in messages)
    assert {message.sender_type for message in messages} == {"sales", "customer"}

    lead = db.get(Lead, conversation.lead_id)
    assert lead is not None
    assert lead.display_name == "V1561719148780935"
    assert lead.assigned_user_id == seeded_data["marketing_a"].id
    assert lead.source == "tawk_webhook"

    audit_logs = list(
        db.scalars(
            select(AuditLog).where(AuditLog.action == "webhook.tawk.ingest")
        ).all()
    )
    assert len(audit_logs) == 1
    assert audit_logs[0].resource_id == "evt_123"
    assert audit_logs[0].provider == "tawk.to"
    assert audit_logs[0].channel == "live_chat"
    assert audit_logs[0].metadata_json["chat_id"] == "70fe3290-99ad-11e9-a30a-51567162179f"
    assert audit_logs[0].metadata_json["processed_messages"] == 2
    assert audit_logs[0].metadata_json["transcript_message_count"] == 2

    duplicate_response = client.post(
        "/webhooks/tawk",
        content=raw_body,
        headers={
            "Content-Type": "application/json",
            "X-Tawk-Signature": signature,
            "X-Hook-Event-Id": "evt_123",
        },
    )
    assert duplicate_response.status_code == 200, duplicate_response.text
    duplicate_body = duplicate_response.json()
    assert duplicate_body["processed_messages"] == 0
    assert duplicate_body["duplicate_messages"] == 2
    assert duplicate_body["conversation_ids"] == body["conversation_ids"]
    db.close()

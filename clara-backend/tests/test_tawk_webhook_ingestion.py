import hashlib
import hmac
import json
from copy import deepcopy
from uuid import UUID

import pytest
from sqlalchemy import select
from sqlalchemy.orm import sessionmaker

from app.core.config import settings
from app.models.audit_log import AuditLog
from app.models.conversation import Conversation
from app.models.lead import Lead
from app.models.message import Message
from app.models.user import User


PROPERTY_A = "property-alpha"
PROPERTY_B = "property-beta"
CHAT_ID = "70fe3290-99ad-11e9-a30a-51567162179f"


def configure_tawk(
    monkeypatch: pytest.MonkeyPatch,
    *,
    organization_map: dict[str, str] | None = None,
    default_sales_map: dict[str, str] | None = None,
) -> None:
    monkeypatch.setattr(settings, "tawk_webhook_secret_key", "tawk-secret")
    monkeypatch.setattr(
        settings,
        "tawk_property_organization_map",
        organization_map or {},
    )
    monkeypatch.setattr(
        settings,
        "tawk_property_default_sales_user_map",
        default_sales_map or {},
    )


def sign_tawk_payload(payload: dict) -> tuple[str, bytes]:
    raw_body = json.dumps(payload).encode("utf-8")
    digest = hmac.new(
        settings.tawk_webhook_secret_key.encode("utf-8"),
        raw_body,
        hashlib.sha1,
    ).hexdigest()
    return digest, raw_body


def transcript_payload(
    *,
    property_id: str = PROPERTY_A,
    chat_id: str = CHAT_ID,
    agent_name: str = "marketing.beta@clara.local",
    agent_id: str | None = None,
    visitor_name: str = "V1561719148780935",
) -> dict:
    sender = {"t": "s", "n": agent_name}
    if agent_id is not None:
        sender["id"] = agent_id
    return {
        "event": "chat:transcript_created",
        "time": "2024-07-03T01:02:37.780Z",
        "domain": "tawk.to",
        "referrer": "https://www.google.com/",
        "property": {"id": property_id, "name": "Bobs Burgers"},
        "chat": {
            "id": chat_id,
            "visitor": {
                "name": visitor_name,
                "email": "visitor@example.test",
            },
            "messages": [
                {
                    "sender": {"t": "s", "n": "Marketing Alpha"},
                    "type": "msg",
                    "msg": "Hi! How can we help?",
                    "time": "2024-07-03T01:02:37.780Z",
                },
                {
                    "sender": sender,
                    "type": "msg",
                    "msg": "Saya bantu lanjut ya.",
                    "time": "2024-07-03T01:02:40.000Z",
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


def post_tawk(client, payload: dict, *, event_id: str | None = None):
    signature, raw_body = sign_tawk_payload(payload)
    headers = {
        "Content-Type": "application/json",
        "X-Tawk-Signature": signature,
    }
    if event_id is not None:
        headers["X-Hook-Event-Id"] = event_id
    return client.post("/webhooks/tawk", content=raw_body, headers=headers)


def business_counts(db_session_factory: sessionmaker) -> tuple[int, int, int]:
    db = db_session_factory()
    try:
        return (
            len(db.scalars(select(Conversation)).all()),
            len(db.scalars(select(Message)).all()),
            len(db.scalars(select(Lead)).all()),
        )
    finally:
        db.close()


def test_tawk_webhook_rejects_missing_and_invalid_signature(
    client,
    monkeypatch,
) -> None:
    configure_tawk(monkeypatch)
    payload = transcript_payload()

    missing = client.post("/webhooks/tawk", json=payload)
    invalid = client.post(
        "/webhooks/tawk",
        json=payload,
        headers={"X-Tawk-Signature": "badbadbad"},
    )

    assert missing.status_code == 401, missing.text
    assert invalid.status_code == 401, invalid.text


def test_tawk_transcript_is_mapped_counted_and_idempotent(
    client,
    db_session_factory: sessionmaker,
    seeded_data: dict[str, object],
    monkeypatch,
) -> None:
    configure_tawk(monkeypatch, organization_map={PROPERTY_A: "org-alpha"})
    payload = transcript_payload()

    response = post_tawk(client, payload, event_id="evt_123")

    assert response.status_code == 200, response.text
    body = response.json()
    assert body["provider"] == "tawk.to"
    assert body["event"] == "chat:transcript_created"
    assert body["event_id"] == "evt_123"
    assert body["property_id"] == PROPERTY_A
    assert body["chat_id"] == CHAT_ID
    assert body["processed_messages"] == 3
    assert body["duplicate_messages"] == 0
    assert body["ignored_events"] == 0
    assert body["transcript_message_count"] == 3
    assert len(body["conversation_ids"]) == 1

    db = db_session_factory()
    conversation = db.get(Conversation, UUID(body["conversation_ids"][0]))
    assert conversation is not None
    assert conversation.organization_id == seeded_data["org_a"].id
    assert conversation.sales_user_id == seeded_data["marketing_b"].id
    assert conversation.channel == "live_chat"
    assert conversation.provider == "official_api"
    assert conversation.provider_key == "tawk"
    assert conversation.source == "tawk_webhook"
    assert conversation.external_thread_key == f"tawk:{PROPERTY_A}:{CHAT_ID}"
    assert conversation.external_thread_id == f"tawk:{PROPERTY_A}:{CHAT_ID}"
    assert "Marketing Alpha: Hi! How can we help?" in (conversation.raw_text or "")
    assert "marketing.beta@clara.local: Saya bantu lanjut ya." in (
        conversation.raw_text or ""
    )
    assert "V1561719148780935: Tell me more" in (conversation.raw_text or "")

    messages = db.scalars(
        select(Message).where(Message.conversation_id == conversation.id)
    ).all()
    assert len(messages) == 3
    assert all(message.channel == "live_chat" for message in messages)
    assert all(message.provider == "official_api" for message in messages)
    assert all(
        message.external_message_id.startswith("tawkmsg:")
        and len(message.external_message_id) == len("tawkmsg:") + 64
        for message in messages
    )
    assert {message.sender_type for message in messages} == {"sales", "customer"}

    lead = db.get(Lead, conversation.lead_id)
    assert lead is not None
    assert lead.organization_id == seeded_data["org_a"].id
    assert lead.assigned_user_id == seeded_data["marketing_b"].id
    assert lead.source == "tawk_webhook"

    audit_log = db.scalars(
        select(AuditLog).where(AuditLog.action == "webhook.tawk.ingest")
    ).one()
    assert audit_log.resource_id == "evt_123"
    assert audit_log.provider == "tawk.to"
    assert audit_log.channel == "live_chat"
    assert audit_log.metadata_json["processed_messages"] == 3
    assert audit_log.metadata_json["transcript_message_count"] == 3
    db.close()

    replay = post_tawk(client, payload, event_id="evt_123").json()
    assert replay["processed_messages"] == 0
    assert replay["duplicate_messages"] == 3
    assert replay["conversation_ids"] == body["conversation_ids"]
    assert business_counts(db_session_factory) == (2, 3, 2)


def test_property_scope_wins_over_equal_cross_organization_name(
    client,
    db_session_factory: sessionmaker,
    seeded_data: dict[str, object],
    monkeypatch,
) -> None:
    db = db_session_factory()
    same_name_other_org = User(
        organization_id=seeded_data["org_b"].id,
        name="Marketing Beta",
        email="same-name@other.example",
        hashed_password="not-used-by-this-test",
        role="sales",
        is_active=True,
    )
    db.add(same_name_other_org)
    db.commit()
    db.close()
    configure_tawk(monkeypatch, organization_map={PROPERTY_A: "org-alpha"})

    response = post_tawk(
        client,
        transcript_payload(agent_name="  marketing   beta  "),
    )

    assert response.status_code == 200, response.text
    db = db_session_factory()
    conversation = db.get(Conversation, UUID(response.json()["conversation_ids"][0]))
    assert conversation.organization_id == seeded_data["org_a"].id
    assert conversation.sales_user_id == seeded_data["marketing_b"].id
    assert not db.scalars(
        select(Conversation).where(
            Conversation.organization_id == seeded_data["org_b"].id
        )
    ).all()
    db.close()


def test_explicit_sender_id_is_preferred_inside_mapped_organization(
    client,
    db_session_factory: sessionmaker,
    seeded_data: dict[str, object],
    monkeypatch,
) -> None:
    configure_tawk(monkeypatch, organization_map={PROPERTY_A: "org-alpha"})
    payload = transcript_payload(
        agent_name="Wrong Display Name",
        agent_id=str(seeded_data["marketing_a"].id),
    )

    response = post_tawk(client, payload)

    assert response.status_code == 200, response.text
    db = db_session_factory()
    conversation = db.get(Conversation, UUID(response.json()["conversation_ids"][0]))
    assert conversation.sales_user_id == seeded_data["marketing_a"].id
    db.close()


def test_unmapped_property_is_safely_ignored_and_audited(
    client,
    db_session_factory: sessionmaker,
    monkeypatch,
) -> None:
    configure_tawk(monkeypatch)
    payload = transcript_payload(property_id="unmapped-property")
    payload["chat"]["messages"][0]["msg"] = "private transcript marker"
    payload["chat"]["messages"][0]["attchs"] = [
        {
            "type": "file",
            "content": {
                "file": {
                    "url": "https://private.example/secret-file",
                    "name": "private.txt",
                }
            },
        }
    ]

    response = post_tawk(client, payload)

    assert response.status_code == 200, response.text
    body = response.json()
    assert body["ignored_events"] == 1
    assert body["processed_messages"] == 0
    assert body["duplicate_messages"] == 0
    assert body["reason_code"] == "tawk_property_unmapped"
    assert business_counts(db_session_factory) == (0, 0, 0)

    db = db_session_factory()
    audit_log = db.scalars(select(AuditLog)).one()
    assert audit_log.metadata_json == {
        "property_id": "unmapped-property",
        "reason_code": "tawk_property_unmapped",
    }
    serialized_audit = json.dumps(audit_log.metadata_json)
    assert "visitor@example.test" not in serialized_audit
    assert "private transcript marker" not in serialized_audit
    assert "https://private.example/secret-file" not in serialized_audit
    db.close()


def test_default_sales_fallback_is_active_and_organization_scoped(
    client,
    db_session_factory: sessionmaker,
    seeded_data: dict[str, object],
    monkeypatch,
) -> None:
    configure_tawk(
        monkeypatch,
        organization_map={PROPERTY_A: "org-alpha"},
        default_sales_map={PROPERTY_A: "marketing.alpha@clara.local"},
    )

    response = post_tawk(
        client,
        transcript_payload(agent_name="Unmapped Agent"),
    )

    assert response.status_code == 200, response.text
    db = db_session_factory()
    conversation = db.get(Conversation, UUID(response.json()["conversation_ids"][0]))
    lead = db.get(Lead, conversation.lead_id)
    assert conversation.organization_id == seeded_data["org_a"].id
    assert conversation.sales_user_id == seeded_data["marketing_a"].id
    assert lead.organization_id == seeded_data["org_a"].id
    assert lead.assigned_user_id == seeded_data["marketing_a"].id
    db.close()


@pytest.mark.parametrize(
    "default_email",
    [
        "inactive@clara.local",
        "marketing.gamma@clara.local",
        "missing@example.invalid",
    ],
)
def test_invalid_default_sales_fallback_is_atomic(
    client,
    db_session_factory: sessionmaker,
    seeded_data: dict[str, object],
    monkeypatch,
    default_email: str,
) -> None:
    configure_tawk(
        monkeypatch,
        organization_map={PROPERTY_A: "org-alpha"},
        default_sales_map={PROPERTY_A: default_email},
    )

    response = post_tawk(
        client,
        transcript_payload(agent_name="Unmapped Agent"),
    )

    assert response.status_code == 503, response.text
    assert "Default Sales user Tawk tidak valid" in response.json()["detail"]
    assert business_counts(db_session_factory) == (1, 0, 1)


def test_owner_resolution_failure_is_atomic(
    client,
    db_session_factory: sessionmaker,
    seeded_data: dict[str, object],
    monkeypatch,
) -> None:
    configure_tawk(monkeypatch, organization_map={PROPERTY_A: "org-alpha"})

    response = post_tawk(
        client,
        transcript_payload(agent_name="Unmapped Agent"),
    )

    assert response.status_code == 503, response.text
    assert "satu Sales user aktif" in response.json()["detail"]
    assert business_counts(db_session_factory) == (1, 0, 1)


def test_expanded_transcript_does_not_duplicate_shifted_messages(
    client,
    db_session_factory: sessionmaker,
    seeded_data: dict[str, object],
    monkeypatch,
) -> None:
    configure_tawk(monkeypatch, organization_map={PROPERTY_A: "org-alpha"})
    expanded_payload = transcript_payload()
    initial_payload = deepcopy(expanded_payload)
    initial_payload["chat"]["messages"] = expanded_payload["chat"]["messages"][1:]

    initial = post_tawk(client, initial_payload)
    expanded = post_tawk(client, expanded_payload)

    assert initial.status_code == 200, initial.text
    assert initial.json()["processed_messages"] == 2
    assert expanded.status_code == 200, expanded.text
    assert expanded.json()["processed_messages"] == 1
    assert expanded.json()["duplicate_messages"] == 2
    db = db_session_factory()
    messages = db.scalars(select(Message)).all()
    assert len(messages) == 3
    assert len({message.external_message_id for message in messages}) == 3
    db.close()


def test_thread_identity_separates_chat_and_property(
    client,
    db_session_factory: sessionmaker,
    seeded_data: dict[str, object],
    monkeypatch,
) -> None:
    configure_tawk(
        monkeypatch,
        organization_map={
            PROPERTY_A: "org-alpha",
            PROPERTY_B: "org-beta",
        },
    )
    same_title = "Same Visitor"
    first = post_tawk(
        client,
        transcript_payload(chat_id="chat-one", visitor_name=same_title),
    )
    second = post_tawk(
        client,
        transcript_payload(chat_id="chat-two", visitor_name=same_title),
    )
    other_property = post_tawk(
        client,
        transcript_payload(
            property_id=PROPERTY_B,
            chat_id="chat-one",
            agent_name="marketing.gamma@clara.local",
            visitor_name=same_title,
        ),
    )

    assert first.status_code == second.status_code == other_property.status_code == 200
    db = db_session_factory()
    conversations = db.scalars(
        select(Conversation).where(Conversation.source == "tawk_webhook")
    ).all()
    assert len(conversations) == 3
    assert {conversation.title for conversation in conversations} == {same_title}
    assert {conversation.external_thread_key for conversation in conversations} == {
        f"tawk:{PROPERTY_A}:chat-one",
        f"tawk:{PROPERTY_A}:chat-two",
        f"tawk:{PROPERTY_B}:chat-one",
    }
    assert {conversation.organization_id for conversation in conversations} == {
        seeded_data["org_a"].id,
        seeded_data["org_b"].id,
    }
    db.close()


def test_attachment_metadata_is_bounded_and_url_is_not_stored(
    client,
    db_session_factory: sessionmaker,
    seeded_data: dict[str, object],
    monkeypatch,
) -> None:
    configure_tawk(monkeypatch, organization_map={PROPERTY_A: "org-alpha"})
    payload = transcript_payload()
    payload["chat"]["messages"][2]["msg"] = None
    payload["chat"]["messages"][2]["attchs"] = [
        {
            "type": "file",
            "content": {
                "file": {
                    "url": "https://private.example/path/token-value",
                    "mimeType": "application/pdf",
                    "size": 123,
                }
            },
        }
    ]

    response = post_tawk(client, payload)

    assert response.status_code == 200, response.text
    db = db_session_factory()
    attachment_message = db.scalars(
        select(Message).where(Message.sender_type == "customer")
    ).one()
    assert attachment_message.message_text == "[Attachment] application/pdf"
    assert "private.example" not in attachment_message.message_text
    assert len(attachment_message.message_text) <= 5000
    db.close()


def test_supported_non_transcript_event_is_ignored_without_business_data(
    client,
    db_session_factory: sessionmaker,
    monkeypatch,
) -> None:
    configure_tawk(monkeypatch, organization_map={PROPERTY_A: "org-alpha"})
    payload = transcript_payload()
    payload["event"] = "chat:start"
    payload.pop("chat")
    payload["chatId"] = CHAT_ID

    response = post_tawk(client, payload)

    assert response.status_code == 200, response.text
    assert response.json()["ignored_events"] == 1
    assert response.json()["processed_messages"] == 0
    assert business_counts(db_session_factory) == (0, 0, 0)

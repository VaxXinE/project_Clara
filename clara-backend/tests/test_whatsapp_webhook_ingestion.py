import hashlib
import hmac
import json
from pathlib import Path
import sys
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import sessionmaker

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.core.config import settings
from app.models.conversation import Conversation
from app.models.lead import Lead
from app.models.message import Message


def sign_meta_payload(payload: dict) -> tuple[str, bytes]:
    raw_body = json.dumps(payload).encode("utf-8")
    digest = hmac.new(
        settings.whatsapp_meta_app_secret.encode("utf-8"),
        raw_body,
        hashlib.sha256,
    ).hexdigest()
    return f"sha256={digest}", raw_body


def login(client, *, email: str, password: str) -> None:
    response = client.post(
        "/auth/login",
        json={"email": email, "password": password},
    )
    assert response.status_code == 200, response.text


def csrf_headers(client) -> dict[str, str]:
    csrf_token = client.cookies.get(settings.csrf_cookie_name)
    assert csrf_token
    return {"X-CSRF-Token": csrf_token}


def test_verify_meta_webhook_handshake(client, monkeypatch) -> None:
    monkeypatch.setattr(settings, "whatsapp_meta_verify_token", "verify-me")
    monkeypatch.setattr(settings, "whatsapp_meta_app_secret", "meta-secret")
    monkeypatch.setattr(settings, "whatsapp_meta_default_organization_slug", "org-alpha")
    monkeypatch.setattr(settings, "whatsapp_meta_default_sales_user_email", "marketing.alpha@clara.local")

    response = client.get(
        "/webhooks/whatsapp/meta",
        params={
            "hub.mode": "subscribe",
            "hub.verify_token": "verify-me",
            "hub.challenge": "123456",
        },
    )
    assert response.status_code == 200, response.text
    assert response.text == "123456"


def test_meta_webhook_rejects_invalid_signature(client, monkeypatch) -> None:
    monkeypatch.setattr(settings, "whatsapp_meta_verify_token", "verify-me")
    monkeypatch.setattr(settings, "whatsapp_meta_app_secret", "meta-secret")
    monkeypatch.setattr(settings, "whatsapp_meta_default_organization_slug", "org-alpha")
    monkeypatch.setattr(settings, "whatsapp_meta_default_sales_user_email", "marketing.alpha@clara.local")

    payload = {"object": "whatsapp_business_account", "entry": []}
    response = client.post(
        "/webhooks/whatsapp/meta",
        json=payload,
        headers={"X-Hub-Signature-256": "sha256=badbadbad"},
    )
    assert response.status_code == 401, response.text


def test_meta_webhook_ingest_creates_conversation_and_segmented_lead(
    client,
    db_session_factory: sessionmaker,
    seeded_data: dict[str, object],
    monkeypatch,
) -> None:
    monkeypatch.setattr(settings, "whatsapp_meta_verify_token", "verify-me")
    monkeypatch.setattr(settings, "whatsapp_meta_app_secret", "meta-secret")
    monkeypatch.setattr(settings, "whatsapp_meta_default_organization_slug", "org-alpha")
    monkeypatch.setattr(settings, "whatsapp_meta_default_sales_user_email", "marketing.alpha@clara.local")

    payload = {
        "object": "whatsapp_business_account",
        "entry": [
            {
                "id": "entry-1",
                "changes": [
                    {
                        "field": "messages",
                        "value": {
                            "metadata": {
                                "display_phone_number": "628123000000",
                                "phone_number_id": "1234567890",
                            },
                            "contacts": [
                                {
                                    "wa_id": "628111222333",
                                    "profile": {"name": "Customer Leoni"},
                                }
                            ],
                            "messages": [
                                {
                                    "from": "628111222333",
                                    "id": "wamid.ABC123",
                                    "timestamp": "1779271200",
                                    "type": "text",
                                    "text": {"body": "Halo kak, saya mau tanya paket mini."},
                                }
                            ],
                            "clara_context": {"account_category": "mini"},
                        },
                    }
                ],
            }
        ],
    }
    signature, raw_body = sign_meta_payload(payload)

    response = client.post(
        "/webhooks/whatsapp/meta",
        content=raw_body,
        headers={
            "Content-Type": "application/json",
            "X-Hub-Signature-256": signature,
        },
    )
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["processed_messages"] == 1
    assert body["duplicate_messages"] == 0
    assert body["provider"] == "meta"

    db = db_session_factory()
    conversation = db.get(Conversation, UUID(body["conversation_ids"][0]))
    assert conversation is not None
    assert conversation.channel == "whatsapp"
    assert conversation.provider == "official_api"
    assert conversation.source == "whatsapp_webhook"
    assert conversation.provider_key == "meta"
    assert conversation.external_thread_id == "meta:1234567890:628111222333"
    assert conversation.external_thread_key == "meta:1234567890:628111222333"

    messages = list(
        db.scalars(
            select(Message).where(Message.conversation_id == conversation.id)
        ).all()
    )
    assert len(messages) == 1
    assert messages[0].channel == "whatsapp"
    assert messages[0].provider == "official_api"
    assert messages[0].external_message_id == "wamid.ABC123"

    lead = db.get(Lead, conversation.lead_id)
    assert lead is not None
    assert lead.account_category == "mini"
    assert lead.assigned_user_id == seeded_data["marketing_a"].id

    duplicate_response = client.post(
        "/webhooks/whatsapp/meta",
        content=raw_body,
        headers={
            "Content-Type": "application/json",
            "X-Hub-Signature-256": signature,
        },
    )
    assert duplicate_response.status_code == 200, duplicate_response.text
    duplicate_body = duplicate_response.json()
    assert duplicate_body["processed_messages"] == 0
    assert duplicate_body["duplicate_messages"] == 1


def test_leads_can_be_filtered_by_account_category(
    client,
    db_session_factory: sessionmaker,
    seeded_data: dict[str, object],
) -> None:
    marketing_a = seeded_data["marketing_a"]
    login(client, email=marketing_a.email, password="MarketingPass123!")

    db = db_session_factory()
    lead = Lead(
        organization_id=marketing_a.organization_id,
        assigned_user_id=marketing_a.id,
        display_name="Lead Mini",
        source="whatsapp_webhook",
        account_category="mini",
        current_stage="qualification",
        lead_temperature="warm",
    )
    other_lead = Lead(
        organization_id=marketing_a.organization_id,
        assigned_user_id=marketing_a.id,
        display_name="Lead Reguler",
        source="whatsapp_txt",
        account_category="reguler",
        current_stage="qualification",
        lead_temperature="warm",
    )
    db.add_all([lead, other_lead])
    db.commit()

    response = client.get("/leads?account_category=mini")
    assert response.status_code == 200, response.text
    payload = response.json()
    assert len(payload) == 1
    assert payload[0]["display_name"] == "Lead Mini"
    assert payload[0]["account_category"] == "mini"

    update_response = client.patch(
        f"/leads/{lead.id}",
        json={"account_category": "reguler"},
        headers=csrf_headers(client),
    )
    assert update_response.status_code == 200, update_response.text
    assert update_response.json()["account_category"] == "reguler"

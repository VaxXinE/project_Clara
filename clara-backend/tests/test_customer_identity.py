from pathlib import Path
import sys
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import sessionmaker

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.core.config import settings
from app.models.conversation import Conversation
from app.models.customer_profile import CustomerProfile
from app.models.lead import Lead


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


def test_same_customer_name_across_channels_links_to_one_customer_profile(
    client,
    db_session_factory: sessionmaker,
    seeded_data: dict[str, object],
) -> None:
    marketing_a = seeded_data["marketing_a"]
    login(client, email=marketing_a.email, password="MarketingPass123!")

    whatsapp_text = """
    12/04/26, 09.12 - Nia: Halo kak, saya lihat iklannya tadi.
    12/04/26, 09.13 - Aria: Halo kak Nia, siap saya bantu.
    """.strip()
    telegram_text = """
    [18.05.2026 09:12] Nia: Halo kak, saya tertarik juga dari Telegram.
    [18.05.2026 09:13] Aria: Siap kak, saya bantu jelaskan.
    """.strip()

    whatsapp_response = client.post(
        "/upload/whatsapp-text",
        json={"title": "Nia on WhatsApp", "raw_text": whatsapp_text},
        headers=csrf_headers(client),
    )
    assert whatsapp_response.status_code == 201, whatsapp_response.text

    telegram_response = client.post(
        "/upload/telegram-text",
        json={"title": "Nia on Telegram", "raw_text": telegram_text},
        headers=csrf_headers(client),
    )
    assert telegram_response.status_code == 201, telegram_response.text

    db = db_session_factory()
    whatsapp_conversation = db.get(
        Conversation,
        UUID(whatsapp_response.json()["conversation_id"]),
    )
    telegram_conversation = db.get(
        Conversation,
        UUID(telegram_response.json()["conversation_id"]),
    )
    assert whatsapp_conversation is not None
    assert telegram_conversation is not None
    assert whatsapp_conversation.lead_id is not None
    assert telegram_conversation.lead_id is not None

    whatsapp_lead = db.get(Lead, whatsapp_conversation.lead_id)
    telegram_lead = db.get(Lead, telegram_conversation.lead_id)
    assert whatsapp_lead is not None
    assert telegram_lead is not None
    assert whatsapp_lead.customer_profile_id is not None
    assert whatsapp_lead.customer_profile_id == telegram_lead.customer_profile_id

    profiles = list(
        db.scalars(
            select(CustomerProfile).where(
                CustomerProfile.organization_id == marketing_a.organization_id,
                CustomerProfile.canonical_key == "nia",
            )
        ).all()
    )
    assert len(profiles) == 1


def test_lead_detail_and_customer_endpoint_return_unified_identity(
    client,
    db_session_factory: sessionmaker,
    seeded_data: dict[str, object],
) -> None:
    marketing_a = seeded_data["marketing_a"]
    login(client, email=marketing_a.email, password="MarketingPass123!")

    whatsapp_text = """
    12/04/26, 09.12 - Leoni: Halo kak, saya tertarik dari WhatsApp.
    12/04/26, 09.13 - Aria: Siap kak, saya bantu jelaskan.
    """.strip()
    telegram_text = """
    [18.05.2026 09:12] Leoni: Halo kak, saya follow up lagi via Telegram.
    [18.05.2026 09:13] Aria: Siap kak, saya bantu lanjutkan.
    """.strip()

    whatsapp_response = client.post(
        "/upload/whatsapp-text",
        json={"title": "Leoni on WhatsApp", "raw_text": whatsapp_text},
        headers=csrf_headers(client),
    )
    telegram_response = client.post(
        "/upload/telegram-text",
        json={"title": "Leoni on Telegram", "raw_text": telegram_text},
        headers=csrf_headers(client),
    )
    assert whatsapp_response.status_code == 201, whatsapp_response.text
    assert telegram_response.status_code == 201, telegram_response.text

    db = db_session_factory()
    whatsapp_conversation = db.get(
        Conversation,
        UUID(whatsapp_response.json()["conversation_id"]),
    )
    assert whatsapp_conversation is not None
    assert whatsapp_conversation.lead_id is not None
    whatsapp_lead = db.get(Lead, whatsapp_conversation.lead_id)
    assert whatsapp_lead is not None
    assert whatsapp_lead.customer_profile_id is not None

    lead_response = client.get(f"/leads/{whatsapp_lead.id}")
    assert lead_response.status_code == 200, lead_response.text
    lead_payload = lead_response.json()
    assert lead_payload["customer_profile"]["lead_count"] == 2
    assert set(lead_payload["customer_profile"]["source_channels"]) == {
        "whatsapp",
        "telegram",
    }

    customer_response = client.get(
        f"/customers/{whatsapp_lead.customer_profile_id}"
    )
    assert customer_response.status_code == 200, customer_response.text
    customer_payload = customer_response.json()
    assert customer_payload["display_name"] == "Leoni"
    assert customer_payload["lead_count"] == 2
    assert len(customer_payload["related_leads"]) == 2

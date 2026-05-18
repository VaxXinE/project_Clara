from io import BytesIO
from pathlib import Path
import sys
from uuid import UUID

from sqlalchemy.orm import sessionmaker

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.core.config import settings
from app.models.conversation import Conversation
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


def test_upload_telegram_txt_creates_conversation_and_lead(
    client,
    db_session_factory: sessionmaker,
    seeded_data: dict[str, object],
) -> None:
    marketing_a = seeded_data["marketing_a"]
    login(client, email=marketing_a.email, password="MarketingPass123!")

    raw_text = """
    [18.05.2026 09:12] Customer Leoni: Halo kak, saya tertarik.
    [18.05.2026 09:13] Sales Aria: Siap kak, saya bantu jelaskan.
    """.strip()

    response = client.post(
        "/upload/telegram-txt",
        files={"file": ("telegram-chat.txt", BytesIO(raw_text.encode("utf-8")), "text/plain")},
        headers=csrf_headers(client),
    )
    assert response.status_code == 201, response.text
    payload = response.json()
    assert payload["message_count"] == 2

    db = db_session_factory()
    conversation = db.get(Conversation, UUID(payload["conversation_id"]))
    assert conversation is not None
    assert conversation.source == "telegram_txt"
    assert conversation.lead_id is not None

    lead = db.get(Lead, conversation.lead_id)
    assert lead is not None
    assert lead.source == "telegram_txt"
    assert lead.display_name == "Customer Leoni"


def test_paste_whatsapp_text_creates_conversation_and_lead(
    client,
    db_session_factory: sessionmaker,
    seeded_data: dict[str, object],
) -> None:
    marketing_a = seeded_data["marketing_a"]
    login(client, email=marketing_a.email, password="MarketingPass123!")

    raw_text = """
    12/04/26, 09.12 - Customer Rani: Kak, ini aman?
    12/04/26, 09.13 - Sales Aria: Aman kak, nanti saya kirim penjelasannya.
    """.strip()

    response = client.post(
        "/upload/whatsapp-text",
        json={
            "title": "Paste Chat Rani",
            "raw_text": raw_text,
        },
        headers=csrf_headers(client),
    )
    assert response.status_code == 201, response.text
    payload = response.json()

    db = db_session_factory()
    conversation = db.get(Conversation, UUID(payload["conversation_id"]))
    assert conversation is not None
    assert conversation.source == "whatsapp_txt"
    assert conversation.raw_filename is None
    assert conversation.title == "Paste Chat Rani"

    lead = db.get(Lead, conversation.lead_id)
    assert lead is not None
    assert lead.display_name == "Customer Rani"


def test_paste_telegram_text_creates_conversation_and_lead(
    client,
    db_session_factory: sessionmaker,
    seeded_data: dict[str, object],
) -> None:
    marketing_a = seeded_data["marketing_a"]
    login(client, email=marketing_a.email, password="MarketingPass123!")

    raw_text = """
    [18.05.2026 09:12] Customer Leoni: Halo kak, saya tertarik.
    [18.05.2026 09:13] Sales Aria: Siap kak, saya bantu jelaskan.
    """.strip()

    response = client.post(
        "/upload/telegram-text",
        json={"raw_text": raw_text},
        headers=csrf_headers(client),
    )
    assert response.status_code == 201, response.text
    payload = response.json()

    db = db_session_factory()
    conversation = db.get(Conversation, UUID(payload["conversation_id"]))
    assert conversation is not None
    assert conversation.source == "telegram_txt"
    assert conversation.raw_filename is None

    lead = db.get(Lead, conversation.lead_id)
    assert lead is not None
    assert lead.source == "telegram_txt"

from pathlib import Path
import sys
from uuid import UUID

from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import sessionmaker

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.core.config import settings
from app.models.conversation import Conversation
from app.models.message import Message


def login(client: TestClient, *, email: str, password: str) -> None:
    response = client.post(
        "/auth/login",
        json={"email": email, "password": password},
    )
    assert response.status_code == 200, response.text


def csrf_headers(client: TestClient) -> dict[str, str]:
    csrf_token = client.cookies.get(settings.csrf_cookie_name)
    assert csrf_token
    return {"X-CSRF-Token": csrf_token}


def test_extension_snapshot_sync_creates_conversation_and_messages(
    client: TestClient,
    db_session_factory: sessionmaker,
    seeded_data: dict[str, object],
) -> None:
    marketing_a = seeded_data["marketing_a"]

    login(client, email=marketing_a.email, password="MarketingPass123!")

    response = client.post(
        "/extension/whatsapp/snapshots",
        json={
            "chatData": {
                "capturedAt": "2026-05-12T09:00:00.000Z",
                "chatTitle": "Leoni Customer",
                "chatSubtitle": "online",
                "messages": [
                    {
                        "id": "09.00-0",
                        "author": "Leoni",
                        "direction": "incoming",
                        "text": "Halo kak, ini legal tidak?",
                        "timestampLabel": "09.00",
                    },
                    {
                        "id": "09.01-1",
                        "author": "Arya",
                        "direction": "outgoing",
                        "text": "Legal, nanti saya kirim penjelasannya.",
                        "timestampLabel": "09.01",
                    },
                ],
            }
        },
        headers=csrf_headers(client),
    )

    assert response.status_code == 201, response.text
    payload = response.json()
    assert payload["status"] == "created"
    assert payload["duplicate"] is False
    assert payload["message_count"] == 2

    db = db_session_factory()
    conversation = db.get(Conversation, UUID(payload["conversation_id"]))
    assert conversation is not None
    assert conversation.source == "whatsapp_extension"
    assert conversation.title == "Leoni Customer"
    assert conversation.sales_user_id == marketing_a.id

    messages = list(
        db.scalars(
            select(Message)
            .where(Message.conversation_id == conversation.id)
            .order_by(Message.message_timestamp.asc())
        ).all()
    )
    assert len(messages) == 2
    assert messages[0].sender_type == "customer"
    assert messages[1].sender_type == "sales"


def test_extension_snapshot_sync_detects_duplicate_payload(
    client: TestClient,
    seeded_data: dict[str, object],
) -> None:
    marketing_a = seeded_data["marketing_a"]
    payload = {
        "chatData": {
            "capturedAt": "2026-05-12T09:00:00.000Z",
            "chatTitle": "Leoni Customer",
            "chatSubtitle": "online",
            "messages": [
                {
                    "id": "09.00-0",
                    "author": "Leoni",
                    "direction": "incoming",
                    "text": "Halo kak, ini legal tidak?",
                    "timestampLabel": "09.00",
                },
                {
                    "id": "09.01-1",
                    "author": "Arya",
                    "direction": "outgoing",
                    "text": "Legal, nanti saya kirim penjelasannya.",
                    "timestampLabel": "09.01",
                },
            ],
        }
    }

    login(client, email=marketing_a.email, password="MarketingPass123!")

    first_response = client.post(
        "/extension/whatsapp/snapshots",
        json=payload,
        headers=csrf_headers(client),
    )
    assert first_response.status_code == 201, first_response.text

    duplicate_response = client.post(
        "/extension/whatsapp/snapshots",
        json=payload,
        headers=csrf_headers(client),
    )
    assert duplicate_response.status_code == 201, duplicate_response.text
    duplicate_payload = duplicate_response.json()
    assert duplicate_payload["status"] == "duplicate"
    assert duplicate_payload["duplicate"] is True

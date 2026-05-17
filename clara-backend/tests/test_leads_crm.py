from pathlib import Path
import sys
from uuid import UUID

from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import sessionmaker

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.core.config import settings
from app.models.conversation import Conversation
from app.models.lead import Lead
from app.schemas.ai_extraction_schema import AIExtractionCreate


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


def test_extension_snapshot_auto_creates_linked_lead(
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
                    }
                ],
            }
        },
        headers=csrf_headers(client),
    )
    assert response.status_code == 201, response.text

    db = db_session_factory()
    conversation = db.get(Conversation, UUID(response.json()["conversation_id"]))
    assert conversation is not None
    assert conversation.lead_id is not None

    lead = db.get(Lead, conversation.lead_id)
    assert lead is not None
    assert lead.display_name == "Leoni"
    assert lead.assigned_user_id == marketing_a.id


def test_analyze_conversation_updates_linked_lead(
    client: TestClient,
    db_session_factory: sessionmaker,
    seeded_data: dict[str, object],
    monkeypatch,
) -> None:
    marketing_a = seeded_data["marketing_a"]
    login(client, email=marketing_a.email, password="MarketingPass123!")

    sync_response = client.post(
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
                        "text": "Saya masih ragu, tapi tertarik coba.",
                        "timestampLabel": "09.00",
                    }
                ],
            }
        },
        headers=csrf_headers(client),
    )
    assert sync_response.status_code == 201, sync_response.text
    conversation_id = sync_response.json()["conversation_id"]

    monkeypatch.setattr(
        "app.services.ai_extraction_service.call_openai_for_extraction",
        lambda _conversation_text: AIExtractionCreate(
            lead_temperature="warm",
            pipeline_stage="negotiation",
            buying_intent="medium",
            sentiment="cautious",
            risk_level="medium",
            main_objections=["legalitas"],
            budget_signal={
                "detected": False,
                "amount_text": None,
                "notes": "Belum ada budget.",
            },
            recommended_reply_strategy={
                "tone": "professional",
                "key_points": ["jawab legalitas"],
                "avoid_topics": ["janji hasil"],
            },
            customer_summary="Lead tertarik tapi masih butuh penguatan trust.",
            next_best_action="Kirim bukti legalitas dan ajak follow up.",
            content_insight="Trust masih isu utama.",
            internal_notes="Perlu materi bukti sosial.",
            confidence_score=0.87,
        ),
    )

    analyze_response = client.post(
        f"/conversations/{conversation_id}/analyze",
        headers=csrf_headers(client),
    )
    assert analyze_response.status_code == 200, analyze_response.text

    db = db_session_factory()
    conversation = db.get(Conversation, UUID(conversation_id))
    assert conversation is not None
    assert conversation.lead_id is not None

    lead = db.get(Lead, conversation.lead_id)
    assert lead is not None
    assert lead.current_stage == "negotiation"
    assert lead.lead_temperature == "warm"
    assert lead.summary == "Lead tertarik tapi masih butuh penguatan trust."


def test_leads_list_is_scoped_by_assignment_for_marketing(
    client: TestClient,
    seeded_data: dict[str, object],
) -> None:
    marketing_a = seeded_data["marketing_a"]
    login(client, email=marketing_a.email, password="MarketingPass123!")

    response = client.get("/leads")
    assert response.status_code == 200, response.text
    payload = response.json()
    assert payload == []


def test_admin_can_list_and_update_org_leads(
    client: TestClient,
    db_session_factory: sessionmaker,
    seeded_data: dict[str, object],
) -> None:
    admin_a = seeded_data["admin_a"]
    owned_lead = seeded_data["owned_lead"]
    owned_conversation = seeded_data["owned_conversation"]
    login(client, email=admin_a.email, password="AdminPass123!")

    list_response = client.get("/leads")
    assert list_response.status_code == 200, list_response.text
    payload = list_response.json()
    assert len(payload) == 1
    assert payload[0]["id"] == str(owned_lead.id)

    patch_response = client.patch(
        f"/leads/{owned_lead.id}",
        json={
            "current_stage": "closing",
            "lead_temperature": "hot",
            "summary": "Sudah sangat dekat ke closing.",
        },
        headers=csrf_headers(client),
    )
    assert patch_response.status_code == 200, patch_response.text
    assert patch_response.json()["current_stage"] == "closing"
    assert patch_response.json()["lead_temperature"] == "hot"

    db = db_session_factory()
    conversation = db.get(Conversation, owned_conversation.id)
    assert conversation is not None
    assert conversation.current_stage == "closing"
    assert conversation.lead_temperature == "hot"

    lead = db.scalars(select(Lead).where(Lead.id == owned_lead.id)).first()
    assert lead is not None
    assert lead.summary == "Sudah sangat dekat ke closing."

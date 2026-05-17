from datetime import datetime, timedelta, timezone
from pathlib import Path
import sys

from fastapi.testclient import TestClient
from sqlalchemy.orm import sessionmaker

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.core.config import settings
from app.models.ai_extraction import AIExtraction
from app.models.message import Message


def login(client: TestClient, *, email: str, password: str) -> None:
    response = client.post(
        "/auth/login",
        json={"email": email, "password": password},
    )
    assert response.status_code == 200, response.text


def test_marketing_worklist_only_shows_assigned_items(
    client: TestClient,
    seeded_data: dict[str, object],
) -> None:
    marketing_a = seeded_data["marketing_a"]
    login(client, email=marketing_a.email, password="MarketingPass123!")

    response = client.get("/dashboard/sales/worklist")
    assert response.status_code == 200, response.text
    payload = response.json()

    assert payload["items"] == []
    assert payload["overdue_count"] == 0


def test_admin_worklist_surfaces_overdue_follow_up(
    client: TestClient,
    db_session_factory: sessionmaker,
    seeded_data: dict[str, object],
) -> None:
    admin_a = seeded_data["admin_a"]
    owned_lead = seeded_data["owned_lead"]
    owned_conversation = seeded_data["owned_conversation"]

    db = db_session_factory()
    lead = db.get(type(owned_lead), owned_lead.id)
    conversation = db.get(type(owned_conversation), owned_conversation.id)
    assert lead is not None
    assert conversation is not None

    db.add(
        Message(
            conversation_id=conversation.id,
            sender_name="Owned Customer",
            sender_type="customer",
            message_text="Halo kak, saya mau lanjut tapi butuh follow up.",
            message_timestamp=datetime.now(timezone.utc) - timedelta(hours=4),
        )
    )
    db.add(
        AIExtraction(
            conversation_id=conversation.id,
            model_name="test-model",
            schema_version="v1",
            lead_temperature="hot",
            pipeline_stage="closing",
            buying_intent="high",
            sentiment="positive",
            risk_level="medium",
            main_objections=["follow_up"],
            budget_signal={
                "detected": True,
                "amount_text": "budget ada",
                "notes": "siap jalan",
            },
            recommended_reply_strategy={
                "tone": "professional",
                "key_points": ["follow up cepat"],
                "avoid_topics": [],
            },
            customer_summary="Lead sangat dekat closing.",
            next_best_action="Hubungi sekarang dan kunci langkah closing berikutnya.",
            content_insight="n/a",
            internal_notes="n/a",
            confidence_score=0.95,
        )
    )
    lead.next_follow_up_at = datetime.now(timezone.utc) - timedelta(hours=1)
    lead.last_contact_at = datetime.now(timezone.utc) - timedelta(hours=4)
    db.add(lead)
    db.commit()

    login(client, email=admin_a.email, password="AdminPass123!")

    response = client.get("/dashboard/sales/worklist")
    assert response.status_code == 200, response.text
    payload = response.json()

    assert payload["overdue_count"] == 1
    assert len(payload["items"]) == 1
    assert payload["items"][0]["task_type"] == "overdue_follow_up"
    assert payload["items"][0]["lead_name"] == "Owned Customer"
    assert payload["items"][0]["recommended_action"] == (
        "Hubungi sekarang dan kunci langkah closing berikutnya."
    )

from datetime import datetime, timedelta, timezone
from pathlib import Path
import sys

from fastapi.testclient import TestClient
from sqlalchemy.orm import sessionmaker

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.core.config import settings
from app.models.ai_extraction import AIExtraction
from app.models.lead import Lead
from app.models.lead_discipline_log import LeadDisciplineLog
from app.models.message import Message


def login(client: TestClient, *, email: str, password: str) -> None:
    response = client.post("/auth/login", json={"email": email, "password": password})
    assert response.status_code == 200, response.text


def csrf_headers(client: TestClient) -> dict[str, str]:
    csrf_token = client.cookies.get(settings.csrf_cookie_name)
    assert csrf_token
    return {"X-CSRF-Token": csrf_token}


def test_sales_can_create_discipline_log_and_it_updates_lead_detail(
    client: TestClient,
    db_session_factory: sessionmaker,
    seeded_data: dict[str, object],
) -> None:
    marketing_b = seeded_data["marketing_b"]
    owned_lead = seeded_data["owned_lead"]

    login(client, email=marketing_b.email, password="MarketingPass123!")

    response = client.post(
        f"/leads/{owned_lead.id}/discipline-logs",
        json={
            "activity_type": "follow_up_call",
            "result_status": "waiting_customer",
            "main_objection": "legalitas",
            "customer_mood": "cautious",
            "notes": "Customer minta bukti legalitas sebelum lanjut.",
            "next_follow_up_at": "2026-05-21T09:00:00Z",
        },
        headers=csrf_headers(client),
    )
    assert response.status_code == 201, response.text
    payload = response.json()
    assert payload["activity_type"] == "follow_up_call"
    assert payload["result_status"] == "waiting_customer"

    detail_response = client.get(f"/leads/{owned_lead.id}")
    assert detail_response.status_code == 200, detail_response.text
    detail_payload = detail_response.json()
    assert detail_payload["discipline_summary"]["log_count"] == 1
    assert detail_payload["discipline_summary"]["compliance_status"] == "logged_today"
    assert detail_payload["discipline_logs"][0]["activity_type"] == "follow_up_call"
    assert detail_payload["discipline_logs"][0]["main_objection"] == "legalitas"
    assert detail_payload["timeline"][0]["event_type"] == "discipline_log_created"

    db = db_session_factory()
    lead = db.get(Lead, owned_lead.id)
    assert lead is not None
    assert lead.next_follow_up_at is not None


def test_worklist_surfaces_missing_and_stale_discipline_logs(
    client: TestClient,
    db_session_factory: sessionmaker,
    seeded_data: dict[str, object],
) -> None:
    admin_a = seeded_data["admin_a"]
    owned_lead = seeded_data["owned_lead"]
    org_a = seeded_data["org_a"]
    marketing_a = seeded_data["marketing_a"]

    db = db_session_factory()
    missing_lead = Lead(
        organization_id=org_a.id,
        assigned_user_id=marketing_a.id,
        display_name="Missing Discipline Lead",
        source="whatsapp_txt",
        current_stage="qualification",
        lead_temperature="warm",
        last_contact_at=datetime.now(timezone.utc) - timedelta(hours=3),
    )
    db.add(missing_lead)
    db.flush()
    stale_lead = Lead(
        organization_id=org_a.id,
        assigned_user_id=marketing_a.id,
        display_name="Stale Discipline Lead",
        source="whatsapp_txt",
        current_stage="qualification",
        lead_temperature="warm",
        last_contact_at=datetime.now(timezone.utc) - timedelta(days=2),
    )
    db.add(stale_lead)
    db.flush()
    db.add(
        LeadDisciplineLog(
            lead_id=stale_lead.id,
            organization_id=stale_lead.organization_id,
            actor_user_id=marketing_a.id,
            log_date=(datetime.now(timezone.utc) - timedelta(days=1)).date(),
            activity_type="follow_up_chat",
            result_status="waiting_customer",
            customer_mood="neutral",
            notes="Log kemarin, belum ada update hari ini.",
        )
    )
    db.commit()
    db.close()

    login(client, email=admin_a.email, password="AdminPass123!")

    response = client.get("/dashboard/sales/worklist")
    assert response.status_code == 200, response.text
    payload = response.json()

    task_types = {item["task_type"] for item in payload["items"]}
    assert "missing_discipline_log" in task_types
    assert "stale_discipline_log" in task_types
    assert payload["missing_discipline_log_count"] >= 1
    assert payload["stale_discipline_log_count"] >= 1

    missing_item = next(
        item for item in payload["items"] if item["lead_id"] == str(missing_lead.id)
    )
    assert missing_item["task_type"] == "missing_discipline_log"
    assert missing_item["latest_discipline_log_date"] is None


def test_discipline_log_suggestion_prefills_from_latest_ai_context(
    client: TestClient,
    db_session_factory: sessionmaker,
    seeded_data: dict[str, object],
) -> None:
    marketing_b = seeded_data["marketing_b"]
    owned_lead = seeded_data["owned_lead"]
    owned_conversation = seeded_data["owned_conversation"]

    db = db_session_factory()
    conversation = db.get(type(owned_conversation), owned_conversation.id)
    assert conversation is not None

    db.add(
        Message(
            conversation_id=conversation.id,
            sender_name="Owned Customer",
            sender_type="customer",
            message_text="Saya masih ragu soal legalitasnya, tapi kalau aman saya lanjut.",
            message_timestamp=datetime.now(timezone.utc) - timedelta(minutes=20),
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
            sentiment="cautious",
            risk_level="medium",
            main_objections=["legalitas"],
            budget_signal={
                "detected": True,
                "amount_text": "budget siap",
                "notes": "customer siap lanjut kalau trust aman",
            },
            recommended_reply_strategy={
                "tone": "professional",
                "key_points": ["jawab legalitas", "dorong follow-up cepat"],
                "avoid_topics": [],
            },
            customer_summary="Lead tertarik tetapi masih menahan keputusan karena trust.",
            next_best_action="Kirim bukti legalitas resmi dan hubungi lagi hari ini.",
            content_insight="Trust dan legalitas jadi keberatan utama.",
            internal_notes="Perlu follow-up cepat.",
            confidence_score=0.93,
        )
    )
    db.commit()
    db.close()

    login(client, email=marketing_b.email, password="MarketingPass123!")

    response = client.get(f"/leads/{owned_lead.id}/discipline-log-suggestion")
    assert response.status_code == 200, response.text
    payload = response.json()

    assert payload["activity_type"] == "follow_up_chat"
    assert payload["result_status"] == "waiting_customer"
    assert payload["main_objection"] == "legalitas"
    assert payload["customer_mood"] == "cautious"
    assert "Lead tertarik tetapi masih menahan keputusan karena trust." in payload["notes"]
    assert "Aksi berikutnya: Kirim bukti legalitas resmi dan hubungi lagi hari ini." in payload["notes"]
    assert "Chat terbaru: Saya masih ragu soal legalitasnya" in payload["notes"]
    assert payload["next_follow_up_at"] is not None
    assert payload["confidence_score"] >= 0.8

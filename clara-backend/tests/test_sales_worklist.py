from datetime import datetime, timedelta, timezone
from pathlib import Path
import sys

from fastapi.testclient import TestClient
from sqlalchemy.orm import sessionmaker

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.models.ai_extraction import AIExtraction
from app.models.lead import Lead
from app.models.lead_task import LeadTask
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
    assert payload["items"][0]["task_id"] is None
    assert payload["items"][0]["lead_name"] == "Owned Customer"
    assert payload["items"][0]["recommended_action"] == (
        "Hubungi sekarang dan kunci langkah closing berikutnya."
    )


def test_worklist_prefers_persisted_snoozed_task_over_derived_signal(
    client: TestClient,
    db_session_factory: sessionmaker,
    seeded_data: dict[str, object],
) -> None:
    admin_a = seeded_data["admin_a"]
    owned_lead = seeded_data["owned_lead"]

    db = db_session_factory()
    lead = db.get(type(owned_lead), owned_lead.id)
    assert lead is not None
    db.add(
        LeadTask(
            lead_id=lead.id,
            organization_id=lead.organization_id,
            assigned_user_id=lead.assigned_user_id,
            task_type="manual_follow_up",
            status="snoozed",
            title="Follow up besok siang",
            description="Customer minta jeda sebentar.",
            due_at=datetime.now(timezone.utc) + timedelta(hours=20),
        )
    )
    db.commit()

    login(client, email=admin_a.email, password="AdminPass123!")

    response = client.get("/dashboard/sales/worklist")
    assert response.status_code == 200, response.text
    payload = response.json()

    assert payload["snoozed_count"] == 1
    assert payload["items"][0]["task_type"] == "snoozed_follow_up"
    assert payload["items"][0]["task_id"] is not None
    assert payload["items"][0]["task_status"] == "snoozed"


def test_worklist_moves_future_open_follow_up_to_upcoming_bucket(
    client: TestClient,
    db_session_factory: sessionmaker,
    seeded_data: dict[str, object],
) -> None:
    admin_a = seeded_data["admin_a"]
    marketing_a = seeded_data["marketing_a"]

    db = db_session_factory()
    lead = Lead(
        organization_id=marketing_a.organization_id,
        assigned_user_id=marketing_a.id,
        display_name="Future Follow Up Lead",
        source="manual_test",
        current_stage="qualification",
        lead_temperature="warm",
    )
    db.add(lead)
    db.flush()
    db.add(
        LeadTask(
            lead_id=lead.id,
            organization_id=lead.organization_id,
            assigned_user_id=lead.assigned_user_id,
            task_type="scheduled_follow_up",
            status="open",
            title="Follow up besok sore",
            description="Task ini belum actionable hari ini.",
            due_at=datetime.now(timezone.utc) + timedelta(days=1, hours=2),
        )
    )
    db.commit()

    login(client, email=admin_a.email, password="AdminPass123!")

    response = client.get("/dashboard/sales/worklist")
    assert response.status_code == 200, response.text
    payload = response.json()

    assert payload["open_task_count"] == 1
    assert payload["due_today_count"] == 0
    assert all(
        not (
            item["lead_id"] == str(lead.id)
            and item["task_id"] is not None
        )
        for item in payload["items"]
    )
    assert any(
        item["lead_id"] == str(lead.id)
        and item["task_id"] is not None
        for item in payload["upcoming_items"]
    )


def test_worklist_hides_follow_up_for_won_lead(
    client: TestClient,
    db_session_factory: sessionmaker,
    seeded_data: dict[str, object],
) -> None:
    admin_a = seeded_data["admin_a"]
    owned_lead = seeded_data["owned_lead"]

    db = db_session_factory()
    lead = db.get(type(owned_lead), owned_lead.id)
    assert lead is not None
    lead.current_stage = "won"
    lead.next_follow_up_at = datetime.now(timezone.utc) - timedelta(hours=2)
    db.add(
        LeadTask(
            lead_id=lead.id,
            organization_id=lead.organization_id,
            assigned_user_id=lead.assigned_user_id,
            task_type="scheduled_follow_up",
            status="open",
            title="Follow up lama",
            description="Seharusnya tidak tampil karena lead sudah won.",
            due_at=datetime.now(timezone.utc) - timedelta(hours=2),
        )
    )
    db.commit()

    login(client, email=admin_a.email, password="AdminPass123!")

    response = client.get("/dashboard/sales/worklist")
    assert response.status_code == 200, response.text
    payload = response.json()

    assert all(item["lead_id"] != str(lead.id) for item in payload["items"])
    assert all(item["lead_id"] != str(lead.id) for item in payload["upcoming_items"])

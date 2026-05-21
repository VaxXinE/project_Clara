from datetime import datetime, timedelta, timezone
from pathlib import Path
import sys

from fastapi.testclient import TestClient
from sqlalchemy.orm import sessionmaker

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.core.config import settings
from app.models.ai_extraction import AIExtraction
from app.models.lead_task import LeadTask
from app.models.message import Message
from app.models.reply_suggestion import ReplySuggestion


def login(client: TestClient, *, email: str, password: str) -> None:
    response = client.post("/auth/login", json={"email": email, "password": password})
    assert response.status_code == 200, response.text


def csrf_headers(client: TestClient) -> dict[str, str]:
    csrf_token = client.cookies.get(settings.csrf_cookie_name)
    assert csrf_token
    return {"X-CSRF-Token": csrf_token}


def test_head_can_list_and_acknowledge_ops_notifications(
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

    lead.next_follow_up_at = datetime.now(timezone.utc) - timedelta(hours=2)
    lead.last_contact_at = datetime.now(timezone.utc) - timedelta(hours=3)
    db.add(
        Message(
            conversation_id=conversation.id,
            sender_name="Owned Customer",
            sender_type="customer",
            message_text="Tolong follow up lagi ya kak.",
            message_timestamp=datetime.now(timezone.utc) - timedelta(hours=3),
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
            budget_signal={"detected": True, "amount_text": "ready", "notes": "n/a"},
            recommended_reply_strategy={
                "tone": "professional",
                "key_points": ["follow up"],
                "avoid_topics": [],
            },
            customer_summary="Close to conversion.",
            next_best_action="Hubungi sekarang.",
            content_insight="n/a",
            internal_notes="n/a",
            confidence_score=0.92,
        )
    )
    db.commit()
    db.close()

    login(client, email=admin_a.email, password="AdminPass123!")

    response = client.get("/dashboard/notifications")
    assert response.status_code == 200, response.text
    payload = response.json()
    assert payload["active_count"] >= 1
    notification_id = payload["items"][0]["id"]

    ack_response = client.patch(
        f"/dashboard/notifications/{notification_id}/acknowledge",
        headers=csrf_headers(client),
    )
    assert ack_response.status_code == 200, ack_response.text
    ack_payload = ack_response.json()
    assert ack_payload["status"] == "acknowledged"
    assert ack_payload["delivery_status"] == "delivered"

    resolve_response = client.patch(
        f"/dashboard/notifications/{notification_id}/resolve",
        json={"resolution_note": "Sudah ditindak oleh tim sales."},
        headers=csrf_headers(client),
    )
    assert resolve_response.status_code == 200, resolve_response.text
    resolve_payload = resolve_response.json()
    assert resolve_payload["status"] == "resolved"
    assert resolve_payload["resolution_note"] == "Sudah ditindak oleh tim sales."

    reopen_response = client.patch(
        f"/dashboard/notifications/{notification_id}/reopen",
        headers=csrf_headers(client),
    )
    assert reopen_response.status_code == 200, reopen_response.text
    reopen_payload = reopen_response.json()
    assert reopen_payload["status"] == "active"

    escalate_response = client.patch(
        f"/dashboard/notifications/{notification_id}/escalate",
        headers=csrf_headers(client),
    )
    assert escalate_response.status_code == 200, escalate_response.text
    escalate_payload = escalate_response.json()
    assert escalate_payload["escalation_level"] in {"team_lead", "superadmin"}


def test_approval_queue_filters_by_risk_level(
    client: TestClient,
    db_session_factory: sessionmaker,
    seeded_data: dict[str, object],
) -> None:
    admin_a = seeded_data["admin_a"]
    owned_conversation = seeded_data["owned_conversation"]

    db = db_session_factory()
    conversation = db.get(type(owned_conversation), owned_conversation.id)
    assert conversation is not None

    extraction = AIExtraction(
        conversation_id=conversation.id,
        model_name="test-model",
        schema_version="v1",
        lead_temperature="warm",
        pipeline_stage="objection",
        buying_intent="medium",
        sentiment="cautious",
        risk_level="high",
        main_objections=["trust"],
        budget_signal={"detected": False, "amount_text": None, "notes": "n/a"},
        recommended_reply_strategy={
            "tone": "professional",
            "key_points": ["jelaskan trust"],
            "avoid_topics": [],
        },
        customer_summary="Masih ragu.",
        next_best_action="Review dulu.",
        content_insight="n/a",
        internal_notes="n/a",
        confidence_score=0.88,
    )
    db.add(extraction)
    db.flush()
    db.add(
        ReplySuggestion(
            conversation_id=conversation.id,
            ai_extraction_id=extraction.id,
            model_name="test-model",
            action_mode="escalate_to_human",
            approval_status="pending",
            risk_level="high",
            suggested_replies=[{"tone": "professional", "text": "Kami bantu jelaskan.", "reasoning": "n/a"}],
            policy_reasons=["human_review"],
        )
    )
    db.commit()
    db.close()

    login(client, email=admin_a.email, password="AdminPass123!")

    response = client.get("/dashboard/sales/approval-queue?risk_level=high")
    assert response.status_code == 200, response.text
    payload = response.json()
    assert payload["pending_count"] == 1
    assert payload["high_risk_count"] >= 1
    assert payload["items"][0]["risk_level"] == "high"


def test_worklist_response_includes_sla_metrics(
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
            status="open",
            title="Follow up hari ini",
            due_at=datetime.now(timezone.utc) - timedelta(hours=30),
        )
    )
    db.commit()
    db.close()

    login(client, email=admin_a.email, password="AdminPass123!")

    response = client.get("/dashboard/sales/worklist")
    assert response.status_code == 200, response.text
    payload = response.json()
    assert "overdue_24h_count" in payload
    assert payload["overdue_24h_count"] >= 1
    assert "completion_rate_today" in payload

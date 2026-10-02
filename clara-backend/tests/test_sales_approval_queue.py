from datetime import datetime, timezone
from pathlib import Path
import sys

from fastapi.testclient import TestClient
from sqlalchemy.orm import sessionmaker

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.core.config import settings
from app.models.ai_extraction import AIExtraction
from app.models.reply_suggestion import ReplySuggestion


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


def seed_pending_approval(
    db_session_factory: sessionmaker,
    seeded_data: dict[str, object],
) -> None:
    db = db_session_factory()
    conversation = db.get(type(seeded_data["owned_conversation"]), seeded_data["owned_conversation"].id)
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
        main_objections=["legalitas"],
        budget_signal={"detected": False, "amount_text": None, "notes": "n/a"},
        recommended_reply_strategy={
            "tone": "professional",
            "key_points": ["jawab legalitas"],
            "avoid_topics": [],
        },
        customer_summary="Masih ragu tapi tertarik.",
        next_best_action="Review cepat lalu approve bila aman.",
        content_insight="Trust issue.",
        internal_notes="n/a",
        confidence_score=0.9,
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
            suggested_replies=[
                {
                    "tone": "professional",
                    "text": "Kami akan bantu cek legalitas secara detail.",
                    "reasoning": "Perlu jaga trust.",
                }
            ],
            policy_reasons=["human_review"],
            created_at=datetime.now(timezone.utc),
        )
    )
    db.commit()
    db.close()


def test_admin_can_see_pending_sales_approval_queue(
    client: TestClient,
    db_session_factory: sessionmaker,
    seeded_data: dict[str, object],
) -> None:
    seed_pending_approval(db_session_factory, seeded_data)
    admin_a = seeded_data["admin_a"]

    login(client, email=admin_a.email, password="AdminPass123!")

    response = client.get("/dashboard/sales/approval-queue")
    assert response.status_code == 200, response.text
    payload = response.json()

    assert payload["pending_count"] == 1
    assert payload["escalation_count"] == 1
    assert payload["items"][0]["action_mode"] == "escalate_to_human"
    assert payload["items"][0]["risk_level"] == "high"


def test_marketing_only_sees_their_own_pending_approvals(
    client: TestClient,
    db_session_factory: sessionmaker,
    seeded_data: dict[str, object],
) -> None:
    seed_pending_approval(db_session_factory, seeded_data)
    marketing_a = seeded_data["marketing_a"]

    login(client, email=marketing_a.email, password="MarketingPass123!")

    response = client.get("/dashboard/sales/approval-queue")
    assert response.status_code == 200, response.text
    payload = response.json()
    assert payload["items"] == []


def test_conversation_detail_exposes_summary_and_final_reply_for_the_ui(
    client: TestClient,
    db_session_factory: sessionmaker,
    seeded_data: dict[str, object],
) -> None:
    seed_pending_approval(db_session_factory, seeded_data)
    owned = seeded_data["owned_conversation"]
    marketing_b = seeded_data["marketing_b"]

    db = db_session_factory()
    suggestion = db.query(ReplySuggestion).filter_by(conversation_id=owned.id).one()
    suggestion.action_mode = "draft"
    suggestion.risk_level = "low"
    suggestion.policy_reasons = []
    db.commit()
    suggestion_id = suggestion.id
    db.close()

    login(client, email=marketing_b.email, password="MarketingPass123!")

    before = client.get(f"/dashboard/sales/conversations/{owned.id}")
    assert before.status_code == 200, before.text
    detail = before.json()
    assert detail["latest_ai_extraction"]["customer_summary"] == "Masih ragu tapi tertarik."
    assert detail["latest_reply_suggestion"]["final_reply_text"] is None

    approved = client.post(
        f"/reply-suggestions/{suggestion_id}/approve",
        json={
            "selected_reply_text": "Kami akan bantu cek legalitas secara detail.",
            "final_reply_text": "Halo kak, kami bantu cek legalitasnya ya.",
            "reviewer_name": "Marketing Beta",
        },
        headers=csrf_headers(client),
    )
    assert approved.status_code == 200, approved.text

    after = client.get(f"/dashboard/sales/conversations/{owned.id}").json()
    assert (
        after["latest_reply_suggestion"]["final_reply_text"]
        == "Halo kak, kami bantu cek legalitasnya ya."
    )

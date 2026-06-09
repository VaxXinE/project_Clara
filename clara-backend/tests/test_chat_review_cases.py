from pathlib import Path
import sys

from fastapi.testclient import TestClient
from sqlalchemy.orm import sessionmaker

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.core.config import settings
from app.models.ai_extraction import AIExtraction
from app.models.message import Message
from app.models.reply_suggestion import ReplySuggestion


def login(client: TestClient, *, email: str, password: str) -> None:
    response = client.post("/auth/login", json={"email": email, "password": password})
    assert response.status_code == 200, response.text


def csrf_headers(client: TestClient) -> dict[str, str]:
    csrf_token = client.cookies.get(settings.csrf_cookie_name)
    assert csrf_token
    return {"X-CSRF-Token": csrf_token}


def test_head_can_create_chat_review_case_and_add_manager_note(
    client: TestClient,
    seeded_data: dict[str, object],
) -> None:
    admin_a = seeded_data["admin_a"]
    manager_a = seeded_data["manager_a"]
    owned_conversation = seeded_data["owned_conversation"]

    login(client, email=admin_a.email, password="AdminPass123!")

    reviewer_candidates_response = client.get("/dashboard/sales/reviewer-candidates")
    assert reviewer_candidates_response.status_code == 200, reviewer_candidates_response.text
    reviewer_candidates = reviewer_candidates_response.json()
    returned_candidate_ids = {item["id"] for item in reviewer_candidates}
    assert str(manager_a.id) in returned_candidate_ids

    create_response = client.put(
        f"/dashboard/sales/conversations/{owned_conversation.id}/review-case",
        json={
            "reviewer_user_id": str(manager_a.id),
            "status": "in_review",
            "review_label": "perlu_eskalasi",
            "review_summary": "Percakapan ini perlu dibaca manager karena objection legalitas terlalu dominan.",
            "coaching_focus": "Arahkan sales untuk menjawab trust issue tanpa overclaim.",
            "recommended_action": "Manager review chat ini hari ini dan beri note rework untuk sales.",
        },
        headers=csrf_headers(client),
    )
    assert create_response.status_code == 200, create_response.text
    review_case = create_response.json()
    assert review_case["status"] == "in_review"
    assert review_case["review_label"] == "perlu_eskalasi"
    assert review_case["reviewer_user_id"] == str(manager_a.id)
    assert review_case["notes"] == []

    detail_response = client.get(
        f"/dashboard/sales/conversations/{owned_conversation.id}"
    )
    assert detail_response.status_code == 200, detail_response.text
    detail_payload = detail_response.json()
    assert detail_payload["chat_review_case"]["id"] == review_case["id"]
    assert detail_payload["chat_review_case"]["review_label"] == "perlu_eskalasi"

    note_response = client.post(
        f"/dashboard/sales/review-cases/{review_case['id']}/notes",
        json={
            "note_type": "manager_note",
            "body": "Minta sales fokus ke bukti legalitas dan jangan langsung dorong closing.",
        },
        headers=csrf_headers(client),
    )
    assert note_response.status_code == 200, note_response.text
    reviewed_case = note_response.json()
    assert len(reviewed_case["notes"]) == 1
    assert reviewed_case["notes"][0]["note_type"] == "manager_note"
    assert "jangan langsung dorong closing" in reviewed_case["notes"][0]["body"]


def test_sales_cannot_create_chat_review_case(
    client: TestClient,
    seeded_data: dict[str, object],
) -> None:
    marketing_b = seeded_data["marketing_b"]
    owned_conversation = seeded_data["owned_conversation"]

    login(client, email=marketing_b.email, password="MarketingPass123!")

    response = client.put(
        f"/dashboard/sales/conversations/{owned_conversation.id}/review-case",
        json={
            "reviewer_user_id": None,
            "status": "draft",
            "review_label": "unik",
            "review_summary": "Sales tidak boleh membuka review case coaching sendiri.",
            "coaching_focus": None,
            "recommended_action": None,
        },
        headers=csrf_headers(client),
    )
    assert response.status_code == 403, response.text


def test_head_can_get_ai_prefill_for_chat_review_case(
    client: TestClient,
    db_session_factory: sessionmaker,
    seeded_data: dict[str, object],
) -> None:
    admin_a = seeded_data["admin_a"]
    owned_conversation = seeded_data["owned_conversation"]

    db = db_session_factory()
    conversation = db.get(type(owned_conversation), owned_conversation.id)
    assert conversation is not None

    db.add(
        Message(
            conversation_id=conversation.id,
            sender_name="Owned Customer",
            sender_type="customer",
            message_text="Saya masih tertarik, tapi legalitasnya bikin saya ragu.",
            message_timestamp=conversation.created_at,
        )
    )
    extraction = AIExtraction(
        conversation_id=conversation.id,
        model_name="test-model",
        schema_version="v1",
        lead_temperature="warm",
        pipeline_stage="objection",
        buying_intent="medium",
        sentiment="cautious",
        risk_level="high",
        main_objections=["legalitas", "trust"],
        budget_signal={"detected": False, "amount_text": None, "notes": "n/a"},
        recommended_reply_strategy={
            "tone": "professional",
            "key_points": ["jawab legalitas", "bangun trust"],
            "avoid_topics": [],
        },
        customer_summary="Lead tertarik tapi menahan keputusan karena trust issue.",
        next_best_action="Jelaskan legalitas resmi lalu arahkan ke follow-up terjadwal.",
        content_insight="Legalitas dan trust menjadi hambatan utama.",
        internal_notes="Perlu intervensi manusia.",
        confidence_score=0.91,
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
            suggested_replies=[{"text": "Draft review"}],
            policy_reasons=["human_review"],
        )
    )
    db.commit()
    db.close()

    login(client, email=admin_a.email, password="AdminPass123!")

    response = client.get(
        f"/dashboard/sales/conversations/{owned_conversation.id}/review-case-suggestion"
    )
    assert response.status_code == 200, response.text
    payload = response.json()
    assert payload["status"] in {"in_review", "escalated"}
    assert payload["review_label"] == "perlu_eskalasi"
    assert "Lead tertarik tapi menahan keputusan karena trust issue." in payload["review_summary"]
    assert "Fokus utama coaching: legalitas, trust" in payload["coaching_focus"]
    assert "Jelaskan legalitas resmi lalu arahkan ke follow-up terjadwal." in payload["recommended_action"]
    assert payload["confidence_score"] >= 0.8

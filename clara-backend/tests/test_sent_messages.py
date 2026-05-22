from pathlib import Path
import sys
from uuid import UUID

from fastapi.testclient import TestClient
from sqlalchemy import select
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


def test_mark_sent_adds_reply_to_conversation_timeline(
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
        pipeline_stage="qualification",
        buying_intent="medium",
        sentiment="neutral",
        risk_level="medium",
        main_objections=["clarity"],
        budget_signal={"detected": False, "amount_text": None, "notes": "n/a"},
        recommended_reply_strategy={
            "tone": "professional",
            "key_points": ["jelaskan tahap"],
            "avoid_topics": [],
        },
        customer_summary="Customer butuh penjelasan jelas.",
        next_best_action="Jelaskan tahap dan dokumen.",
        content_insight="n/a",
        internal_notes="n/a",
        confidence_score=0.9,
    )
    db.add(extraction)
    db.flush()

    suggestion = ReplySuggestion(
        conversation_id=conversation.id,
        ai_extraction_id=extraction.id,
        model_name="test-model",
        action_mode="reply_now",
        approval_status="approved",
        risk_level="medium",
        suggested_replies=[
            {
                "tone": "professional",
                "text": "Baik pak, saya bantu jelaskan tahap dan dokumennya ya.",
                "reasoning": "Jawaban jelas dan ringkas.",
            }
        ],
        selected_reply_text="Baik pak, saya bantu jelaskan tahap dan dokumennya ya.",
        final_reply_text="Baik pak, saya bantu jelaskan tahap dan dokumennya ya.",
        policy_reasons=[],
    )
    db.add(suggestion)
    db.commit()
    suggestion_id = suggestion.id
    conversation_id = conversation.id
    db.close()

    login(client, email=admin_a.email, password="AdminPass123!")

    response = client.post(
        f"/reply-suggestions/{suggestion_id}/mark-sent",
        json={"sent_by_name": "Sales Dashboard"},
        headers=csrf_headers(client),
    )
    assert response.status_code == 201, response.text

    db = db_session_factory()
    timeline_messages = list(
        db.scalars(
            select(Message)
            .where(Message.conversation_id == conversation_id)
            .order_by(Message.message_timestamp.asc(), Message.created_at.asc())
        ).all()
    )
    assert timeline_messages
    assert timeline_messages[-1].sender_type == "sales"
    assert timeline_messages[-1].sender_name == "Sales Dashboard"
    assert (
        timeline_messages[-1].message_text
        == "Baik pak, saya bantu jelaskan tahap dan dokumennya ya."
    )
    db.close()

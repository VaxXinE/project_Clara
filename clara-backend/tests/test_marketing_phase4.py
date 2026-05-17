from datetime import datetime, timedelta, timezone
from pathlib import Path
import sys

from fastapi.testclient import TestClient
from sqlalchemy.orm import sessionmaker

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.models.ai_extraction import AIExtraction
from app.models.message import Message
from app.models.reply_suggestion import ReplySuggestion
from app.models.sent_message import SentMessage


def login(client: TestClient, *, email: str, password: str) -> None:
    response = client.post(
        "/auth/login",
        json={"email": email, "password": password},
    )
    assert response.status_code == 200, response.text


def test_marketing_preview_surfaces_operational_content_outputs(
    client: TestClient,
    db_session_factory: sessionmaker,
    seeded_data: dict[str, object],
) -> None:
    admin_a = seeded_data["admin_a"]
    owned_conversation = seeded_data["owned_conversation"]

    db = db_session_factory()
    conversation = db.get(type(owned_conversation), owned_conversation.id)
    assert conversation is not None

    message_time = datetime.now(timezone.utc) - timedelta(hours=3)
    db.add(
        Message(
            conversation_id=conversation.id,
            sender_name="Owned Customer",
            sender_type="customer",
            message_text="Saya tertarik, tapi masih ragu soal legalitas dan keamanan dana.",
            message_timestamp=message_time,
        )
    )
    extraction = AIExtraction(
        conversation_id=conversation.id,
        model_name="test-model",
        schema_version="v1",
        lead_temperature="hot",
        pipeline_stage="negotiation",
        buying_intent="high",
        sentiment="cautious",
        risk_level="high",
        main_objections=["legalitas", "keamanan dana"],
        budget_signal={
            "detected": True,
            "amount_text": "sudah ada budget",
            "notes": "siap mulai kalau trust naik",
        },
        recommended_reply_strategy={
            "tone": "professional",
            "key_points": ["jawab legalitas", "jelaskan proteksi dana"],
            "avoid_topics": ["janji profit"],
        },
        customer_summary="Prospek tertarik tapi menahan keputusan karena trust.",
        next_best_action="Kirim bukti legalitas resmi dan ajak follow up terjadwal.",
        content_insight="Trust dan legalitas harus jadi materi utama.",
        internal_notes="Butuh asset resmi dan testimonial nyata.",
        confidence_score=0.94,
    )
    db.add(extraction)
    db.flush()

    suggestion = ReplySuggestion(
        conversation_id=conversation.id,
        ai_extraction_id=extraction.id,
        model_name="test-model",
        action_mode="reply_direct",
        approval_status="approved",
        risk_level="medium",
        suggested_replies=[
            {
                "tone": "professional",
                "text": "Kami bisa kirim bukti legalitas resmi untuk Kakak cek.",
                "reasoning": "Menjawab trust objection secara langsung.",
            }
        ],
        policy_reasons=["safe_to_reply"],
    )
    db.add(suggestion)
    db.flush()
    db.add(
        SentMessage(
            conversation_id=conversation.id,
            reply_suggestion_id=suggestion.id,
            send_mode="manual",
            message_text="Kami bisa kirim bukti legalitas resmi untuk Kakak cek.",
            sent_by_name="Marketing Beta",
            sent_at=message_time + timedelta(minutes=10),
        )
    )
    db.commit()
    db.close()

    login(client, email=admin_a.email, password="AdminPass123!")

    response = client.get("/dashboard/marketing/insights-preview")
    assert response.status_code == 200, response.text
    payload = response.json()

    assert payload["total_conversations"] >= 1
    assert len(payload["content_briefs"]) >= 1
    assert payload["content_briefs"][0]["title"].startswith("Brief")
    assert len(payload["ads_signals"]) >= 1
    assert "retarget" in payload["ads_signals"][0]["budget_shift"].lower()
    assert len(payload["monthly_content_plan"]) == 4
    assert payload["monthly_content_plan"][0]["window_label"] == "Week 1"

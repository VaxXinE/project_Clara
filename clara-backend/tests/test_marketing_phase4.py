from datetime import datetime, timedelta, timezone
from pathlib import Path
import sys

from fastapi.testclient import TestClient
from sqlalchemy.orm import sessionmaker

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.core.config import settings
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


def csrf_headers(client: TestClient) -> dict[str, str]:
    csrf_token = client.cookies.get(settings.csrf_cookie_name)
    assert csrf_token
    return {"X-CSRF-Token": csrf_token}


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


def test_admin_can_create_and_update_marketing_execution_item(
    client: TestClient,
    seeded_data: dict[str, object],
) -> None:
    admin_a = seeded_data["admin_a"]
    marketing_b = seeded_data["marketing_b"]

    login(client, email=admin_a.email, password="AdminPass123!")

    create_response = client.post(
        "/dashboard/marketing/execution-items",
        json={
            "item_type": "content_brief",
            "source_kind": "content_brief",
            "title": "Brief trust building",
            "summary": "Fokus ke legalitas dan testimoni agar trust naik.",
            "recommended_action": "Assign ke content creator untuk video edukasi.",
            "priority": "high",
            "assigned_user_id": str(marketing_b.id),
            "campaign_name": "Trust Reels Week 1",
        },
        headers=csrf_headers(client),
    )
    assert create_response.status_code == 201, create_response.text
    payload = create_response.json()
    assert payload["status"] == "assigned"
    assert payload["assigned_user_id"] == str(marketing_b.id)
    assert payload["campaign_name"] == "Trust Reels Week 1"

    list_response = client.get("/dashboard/marketing/execution-items")
    assert list_response.status_code == 200, list_response.text
    assert len(list_response.json()) >= 1

    update_response = client.patch(
        f"/dashboard/marketing/execution-items/{payload['id']}",
        json={
            "status": "in_progress",
            "notes": "Sudah masuk antrian produksi.",
            "result_notes": "CTR awal bagus.",
            "leads_generated": 14,
            "qualified_leads": 6,
            "won_leads": 2,
            "attributed_pipeline_value": 12500000,
            "attributed_won_value": 3500000,
            "attributed_deposit_amount": 1000000,
        },
        headers=csrf_headers(client),
    )
    assert update_response.status_code == 200, update_response.text
    assert update_response.json()["status"] == "in_progress"
    assert update_response.json()["notes"] == "Sudah masuk antrian produksi."
    assert update_response.json()["leads_generated"] == 14
    assert update_response.json()["attributed_won_value"] == 3500000

    preview_response = client.get("/dashboard/marketing/insights-preview")
    assert preview_response.status_code == 200, preview_response.text
    preview_payload = preview_response.json()
    assert preview_payload["execution_summary"]["total_items"] >= 1
    assert preview_payload["execution_summary"]["leads_generated"] >= 14


def test_marketing_operational_kpi_uses_latest_conversation_state_like_kpi_page(
    client: TestClient,
    db_session_factory: sessionmaker,
    seeded_data: dict[str, object],
) -> None:
    admin_a = seeded_data["admin_a"]
    owned_conversation = seeded_data["owned_conversation"]

    db = db_session_factory()
    conversation = db.get(type(owned_conversation), owned_conversation.id)
    assert conversation is not None

    message_time = datetime.now(timezone.utc) - timedelta(hours=2)

    first_extraction = AIExtraction(
        conversation_id=conversation.id,
        model_name="test-model",
        schema_version="v1",
        lead_temperature="warm",
        pipeline_stage="qualification",
        buying_intent="medium",
        sentiment="cautious",
        risk_level="medium",
        main_objections=["harga"],
        budget_signal={"detected": True},
        recommended_reply_strategy={"tone": "calm"},
        customer_summary="Masih menimbang harga.",
        next_best_action="Jelaskan value lebih konkret.",
        content_insight="Edukasi value for money.",
        internal_notes="Perlu trust building.",
        confidence_score=0.82,
        created_at=message_time,
    )
    db.add(first_extraction)
    db.flush()

    first_suggestion = ReplySuggestion(
        conversation_id=conversation.id,
        ai_extraction_id=first_extraction.id,
        model_name="test-model",
        action_mode="human_approval_required",
        approval_status="rejected",
        risk_level="medium",
        suggested_replies=[
            {
                "tone": "neutral",
                "text": "Kami punya beberapa pilihan paket.",
                "reasoning": "Draft awal.",
            }
        ],
        policy_reasons=["needs_better_value_positioning"],
        created_at=message_time + timedelta(minutes=5),
    )
    db.add(first_suggestion)
    db.flush()

    db.add(
        SentMessage(
            conversation_id=conversation.id,
            reply_suggestion_id=first_suggestion.id,
            send_mode="manual",
            message_text="Draft lama yang sempat terkirim.",
            sent_by_name="Marketing Beta",
            sent_at=message_time + timedelta(minutes=8),
        )
    )

    second_extraction = AIExtraction(
        conversation_id=conversation.id,
        model_name="test-model",
        schema_version="v1",
        lead_temperature="hot",
        pipeline_stage="closing",
        buying_intent="high",
        sentiment="positive",
        risk_level="low",
        main_objections=["harga"],
        budget_signal={"detected": True},
        recommended_reply_strategy={"tone": "confident"},
        customer_summary="Sudah siap closing jika value jelas.",
        next_best_action="Dorong ke langkah closing.",
        content_insight="Perkuat social proof.",
        internal_notes="Prospek siap lanjut.",
        confidence_score=0.94,
        created_at=message_time + timedelta(minutes=20),
    )
    db.add(second_extraction)
    db.flush()

    second_suggestion = ReplySuggestion(
        conversation_id=conversation.id,
        ai_extraction_id=second_extraction.id,
        model_name="test-model",
        action_mode="reply_direct",
        approval_status="approved",
        risk_level="low",
        suggested_replies=[
            {
                "tone": "confident",
                "text": "Kalau cocok, hari ini bisa langsung kita bantu proses.",
                "reasoning": "State terbaru yang approved.",
            }
        ],
        policy_reasons=["safe_to_reply"],
        created_at=message_time + timedelta(minutes=25),
    )
    db.add(second_suggestion)
    db.flush()

    db.add(
        SentMessage(
            conversation_id=conversation.id,
            reply_suggestion_id=second_suggestion.id,
            send_mode="manual",
            message_text="Reply final terbaru.",
            sent_by_name="Marketing Beta",
            sent_at=message_time + timedelta(minutes=30),
        )
    )
    db.commit()
    db.close()

    login(client, email=admin_a.email, password="AdminPass123!")

    marketing_response = client.get("/dashboard/marketing/insights-preview")
    assert marketing_response.status_code == 200, marketing_response.text
    marketing_payload = marketing_response.json()

    kpi_response = client.get("/dashboard/kpi/command-center")
    assert kpi_response.status_code == 200, kpi_response.text
    kpi_payload = kpi_response.json()

    assert marketing_payload["total_conversations"] == 1
    assert marketing_payload["kpi_summary"]["reply_sent_rate"] == 1.0
    assert marketing_payload["kpi_summary"]["approved_reply_rate"] == 1.0
    assert marketing_payload["kpi_summary"]["analysis_coverage_rate"] == 1.0

    assert kpi_payload["summary"]["reply_sent_rate"] == 1.0
    assert kpi_payload["summary"]["approved_reply_rate"] == 1.0
    assert kpi_payload["summary"]["analyzed_conversations"] == 1

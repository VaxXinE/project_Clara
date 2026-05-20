from pathlib import Path
import sys

from fastapi.testclient import TestClient
import pytest
from sqlalchemy import select

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.core.config import settings
from app.models.audit_log import AuditLog
from app.schemas.ai_extraction_schema import AIExtractionCreate
from app.schemas.reply_suggestion_schema import ReplySuggestionCreate
from app.services.rate_limiter import sgcc_integration_rate_limiter


@pytest.fixture(autouse=True)
def reset_sgcc_rate_limiter() -> None:
    sgcc_integration_rate_limiter._requests.clear()


def integration_headers() -> dict[str, str]:
    return {"X-Clara-Integration-Key": "test-sgcc-key"}


def sample_messages() -> list[dict]:
    return [
        {
            "sender_type": "customer",
            "sender_name": "Nia",
            "message_text": "Halo kak, saya masih ragu soal legalitasnya.",
            "message_timestamp": "2026-05-19T09:00:00Z",
        },
        {
            "sender_type": "sales",
            "sender_name": "Aria",
            "message_text": "Siap kak, saya bantu jelaskan satu per satu ya.",
            "message_timestamp": "2026-05-19T09:01:00Z",
        },
    ]


def test_sgcc_conversation_analysis_requires_integration_key(
    client: TestClient,
    monkeypatch,
) -> None:
    monkeypatch.setattr(settings, "sgcc_integration_api_key", "test-sgcc-key")

    response = client.post(
        "/integrations/sgcc/conversation-analysis",
        json={"messages": sample_messages()},
    )

    assert response.status_code == 401, response.text
    assert response.json()["detail"] == "Missing SGCC integration key."


def test_sgcc_conversation_analysis_returns_clara_ai_output(
    client: TestClient,
    db_session_factory,
    monkeypatch,
) -> None:
    monkeypatch.setattr(settings, "sgcc_integration_api_key", "test-sgcc-key")
    monkeypatch.setattr(
        "app.services.sgcc_integration_service.call_openai_for_extraction",
        lambda _conversation_text: AIExtractionCreate(
            lead_temperature="warm",
            pipeline_stage="objection",
            buying_intent="medium",
            sentiment="cautious",
            risk_level="medium",
            main_objections=["legalitas"],
            budget_signal={
                "detected": False,
                "amount_text": None,
                "notes": "Belum ada angka budget eksplisit.",
            },
            recommended_reply_strategy={
                "tone": "professional",
                "key_points": ["jelaskan legalitas", "beri bukti resmi"],
                "avoid_topics": ["janji hasil"],
            },
            customer_summary="Lead tertarik tetapi masih perlu penguatan trust.",
            next_best_action="Kirim penjelasan legalitas dan bukti resmi.",
            content_insight="Legalitas adalah isu utama untuk segmen ini.",
            internal_notes="Perlu materi trust yang ringkas.",
            confidence_score=0.91,
        ),
    )

    response = client.post(
        "/integrations/sgcc/conversation-analysis",
        headers=integration_headers(),
        json={
            "external_conversation_id": "sgcc-chat-001",
            "source_channel": "whatsapp",
            "customer_name": "Nia",
            "sales_name": "Aria",
            "account_category": "reguler",
            "messages": sample_messages(),
        },
    )

    assert response.status_code == 200, response.text
    payload = response.json()
    assert payload["provider"] == "clara"
    assert payload["integration_client"] == "sgcc"
    assert payload["model_name"] == settings.openai_model
    assert payload["analysis"]["lead_temperature"] == "warm"
    assert payload["analysis"]["risk_level"] == "medium"
    assert payload["analysis"]["next_best_action"] == (
        "Kirim penjelasan legalitas dan bukti resmi."
    )

    db = db_session_factory()
    audit_logs = db.scalars(
        select(AuditLog).where(
            AuditLog.action == "integration.sgcc.conversation_analysis"
        )
    ).all()
    assert len(audit_logs) == 1
    assert audit_logs[0].resource_id == "sgcc-chat-001"
    assert audit_logs[0].metadata_json["integration_client"] == "sgcc"
    assert audit_logs[0].metadata_json["message_count"] == 2


def test_sgcc_reply_suggestions_can_use_supplied_analysis(
    client: TestClient,
    db_session_factory,
    monkeypatch,
) -> None:
    monkeypatch.setattr(settings, "sgcc_integration_api_key", "test-sgcc-key")
    monkeypatch.setattr(
        "app.services.sgcc_integration_service.call_openai_for_reply_suggestion",
        lambda **_kwargs: ReplySuggestionCreate(
            suggested_replies=[
                {
                    "tone": "friendly",
                    "text": "Siap kak, saya bantu jelaskan legalitasnya dengan ringkas ya.",
                    "reasoning": "Versi ringan untuk membuka follow-up tanpa terasa menekan.",
                },
                {
                    "tone": "professional",
                    "text": "Baik kak, saya kirim penjelasan legalitas beserta referensi resmi yang relevan.",
                    "reasoning": "Versi profesional untuk memperkuat kredibilitas.",
                },
                {
                    "tone": "empathetic",
                    "text": "Wajar kak kalau masih ragu, nanti saya bantu kirim dasar legalitasnya supaya lebih tenang.",
                    "reasoning": "Versi empatik untuk menjawab kekhawatiran trust.",
                },
            ]
        ),
    )

    response = client.post(
        "/integrations/sgcc/reply-suggestions",
        headers=integration_headers(),
        json={
            "external_conversation_id": "sgcc-chat-002",
            "source_channel": "whatsapp",
            "customer_name": "Nia",
            "sales_name": "Aria",
            "messages": sample_messages(),
            "knowledge_snippets": [
                "Legalitas produk hanya boleh dijelaskan berdasarkan dokumen resmi.",
                "Jangan membuat janji hasil atau nominal profit.",
            ],
            "analysis": {
                "lead_temperature": "warm",
                "pipeline_stage": "objection",
                "buying_intent": "medium",
                "sentiment": "cautious",
                "risk_level": "medium",
                "main_objections": ["legalitas"],
                "budget_signal": {
                    "detected": False,
                    "amount_text": None,
                    "notes": "Belum ada budget eksplisit.",
                },
                "recommended_reply_strategy": {
                    "tone": "professional",
                    "key_points": ["jelaskan legalitas", "beri referensi resmi"],
                    "avoid_topics": ["janji hasil"],
                },
                "customer_summary": "Lead masih butuh penguatan trust.",
                "next_best_action": "Jelaskan legalitas dan tawarkan follow-up dokumen resmi.",
                "content_insight": "Legalitas menjadi sumber resistensi utama.",
                "internal_notes": "Jangan overclaim.",
                "confidence_score": 0.9,
            },
        },
    )

    assert response.status_code == 200, response.text
    payload = response.json()
    assert payload["provider"] == "clara"
    assert payload["integration_client"] == "sgcc"
    assert payload["action_mode"] == "human_approval_required"
    assert len(payload["suggested_replies"]) == 3
    assert payload["suggested_replies"][1]["tone"] == "professional"
    assert payload["policy_reasons"] == [
        "Risk level medium: balasan butuh approval sales."
    ]

    db = db_session_factory()
    audit_logs = db.scalars(
        select(AuditLog).where(
            AuditLog.action == "integration.sgcc.reply_suggestions"
        )
    ).all()
    assert len(audit_logs) == 1
    assert audit_logs[0].resource_id == "sgcc-chat-002"
    assert audit_logs[0].metadata_json["used_supplied_analysis"] is True
    assert audit_logs[0].metadata_json["action_mode"] == "human_approval_required"


def test_sgcc_integration_rate_limit_returns_429(
    client: TestClient,
    monkeypatch,
) -> None:
    monkeypatch.setattr(settings, "sgcc_integration_api_key", "test-sgcc-key")
    monkeypatch.setattr(settings, "sgcc_integration_rate_limit_per_minute", 1)
    monkeypatch.setattr(
        "app.services.sgcc_integration_service.call_openai_for_extraction",
        lambda _conversation_text: AIExtractionCreate(
            lead_temperature="cold",
            pipeline_stage="qualification",
            buying_intent="low",
            sentiment="neutral",
            risk_level="low",
            main_objections=[],
            budget_signal={
                "detected": False,
                "amount_text": None,
                "notes": "Belum ada budget eksplisit.",
            },
            recommended_reply_strategy={
                "tone": "friendly",
                "key_points": ["bangun minat awal"],
                "avoid_topics": ["janji hasil"],
            },
            customer_summary="Lead masih tahap awal.",
            next_best_action="Jawab pertanyaan dasar dan bangun ketertarikan.",
            content_insight="Percakapan masih eksploratif.",
            internal_notes="Belum urgent.",
            confidence_score=0.95,
        ),
    )

    first_response = client.post(
        "/integrations/sgcc/conversation-analysis",
        headers=integration_headers(),
        json={"messages": sample_messages()},
    )
    assert first_response.status_code == 200, first_response.text

    second_response = client.post(
        "/integrations/sgcc/conversation-analysis",
        headers=integration_headers(),
        json={"messages": sample_messages()},
    )
    assert second_response.status_code == 429, second_response.text
    assert second_response.json()["detail"] == (
        "Too many SGCC integration requests. Please try again later."
    )


def test_sgcc_objection_insights_returns_aggregate_summary(
    client: TestClient,
    db_session_factory,
    monkeypatch,
) -> None:
    monkeypatch.setattr(settings, "sgcc_integration_api_key", "test-sgcc-key")

    response = client.post(
        "/integrations/sgcc/objection-insights",
        headers=integration_headers(),
        json={
            "period_label": "Minggu 3 Mei 2026",
            "conversations": [
                {
                    "external_conversation_id": "conv-1",
                    "source_channel": "whatsapp",
                    "account_category": "mini",
                    "analysis": {
                        "lead_temperature": "warm",
                        "pipeline_stage": "objection",
                        "buying_intent": "medium",
                        "sentiment": "cautious",
                        "risk_level": "medium",
                        "main_objections": ["legalitas", "harga"],
                        "budget_signal": {
                            "detected": False,
                            "amount_text": None,
                            "notes": "Belum ada budget eksplisit."
                        },
                        "recommended_reply_strategy": {
                            "tone": "professional",
                            "key_points": ["jelaskan legalitas"],
                            "avoid_topics": ["janji hasil"]
                        },
                        "customer_summary": "Masih ragu soal legalitas dan harga.",
                        "next_best_action": "Jawab legalitas dan jelaskan value.",
                        "content_insight": "Butuh konten trust.",
                        "internal_notes": "Perlu asset legalitas.",
                        "confidence_score": 0.92
                    }
                },
                {
                    "external_conversation_id": "conv-2",
                    "source_channel": "telegram",
                    "account_category": "reguler",
                    "analysis": {
                        "lead_temperature": "hot",
                        "pipeline_stage": "closing",
                        "buying_intent": "high",
                        "sentiment": "cautious",
                        "risk_level": "high",
                        "main_objections": ["legalitas"],
                        "budget_signal": {
                            "detected": True,
                            "amount_text": "5 juta",
                            "notes": "Sudah ada indikasi kemampuan bayar."
                        },
                        "recommended_reply_strategy": {
                            "tone": "empathetic",
                            "key_points": ["klarifikasi risiko"],
                            "avoid_topics": ["klaim profit"]
                        },
                        "customer_summary": "Siap lanjut tapi masih tahan karena trust issue.",
                        "next_best_action": "Kirim bukti resmi dan arahkan ke closing.",
                        "content_insight": "Hot lead tertahan oleh trust.",
                        "internal_notes": "Supervisor bisa bantu closing.",
                        "confidence_score": 0.95
                    }
                }
            ]
        },
    )

    assert response.status_code == 200, response.text
    payload = response.json()
    assert payload["total_conversations"] == 2
    assert payload["top_objections"][0]["topic"] == "legalitas"
    assert payload["top_objections"][0]["count"] == 2
    assert payload["risk_level_breakdown"]["high"] == 1
    assert payload["risk_level_breakdown"]["medium"] == 1
    assert payload["content_recommendations"][0]["title"].startswith(
        "Konten edukasi untuk objection:"
    )

    db = db_session_factory()
    audit_logs = db.scalars(
        select(AuditLog).where(
            AuditLog.action == "integration.sgcc.objection_insights"
        )
    ).all()
    assert len(audit_logs) == 1
    assert audit_logs[0].metadata_json["conversation_count"] == 2


def test_sgcc_follow_up_recommendation_returns_priority_and_timing(
    client: TestClient,
    db_session_factory,
    monkeypatch,
) -> None:
    monkeypatch.setattr(settings, "sgcc_integration_api_key", "test-sgcc-key")

    response = client.post(
        "/integrations/sgcc/follow-up-recommendation",
        headers=integration_headers(),
        json={
            "external_conversation_id": "follow-1",
            "source_channel": "whatsapp",
            "customer_name": "Leoni",
            "sales_name": "Aria",
            "next_follow_up_at": "2026-05-18T09:00:00Z",
            "messages": sample_messages(),
            "analysis": {
                "lead_temperature": "hot",
                "pipeline_stage": "closing",
                "buying_intent": "high",
                "sentiment": "cautious",
                "risk_level": "medium",
                "main_objections": ["legalitas"],
                "budget_signal": {
                    "detected": True,
                    "amount_text": "3 juta",
                    "notes": "Sudah ada indikasi budget."
                },
                "recommended_reply_strategy": {
                    "tone": "professional",
                    "key_points": ["klarifikasi legalitas", "dorong keputusan"],
                    "avoid_topics": ["janji hasil"]
                },
                "customer_summary": "Lead sangat dekat ke closing tapi masih ragu trust.",
                "next_best_action": "Hubungi segera, jawab legalitas, dan minta keputusan final.",
                "content_insight": "Trust menjadi hambatan terakhir sebelum closing.",
                "internal_notes": "Jangan biarkan lead pending terlalu lama.",
                "confidence_score": 0.94
            }
        },
    )

    assert response.status_code == 200, response.text
    payload = response.json()
    assert payload["task_type"] == "overdue_follow_up"
    assert payload["urgency_level"] == "critical"
    assert payload["priority_score"] >= 40
    assert payload["recommended_action"] == (
        "Hubungi segera, jawab legalitas, dan minta keputusan final."
    )
    assert payload["action_mode"] == "human_approval_required"
    assert "T" in payload["suggested_next_follow_up_at"]

    db = db_session_factory()
    audit_logs = db.scalars(
        select(AuditLog).where(
            AuditLog.action == "integration.sgcc.follow_up_recommendation"
        )
    ).all()
    assert len(audit_logs) == 1
    assert audit_logs[0].metadata_json["task_type"] == "overdue_follow_up"


def test_sgcc_customer_identity_match_returns_recommended_candidate(
    client: TestClient,
    db_session_factory,
    monkeypatch,
) -> None:
    monkeypatch.setattr(settings, "sgcc_integration_api_key", "test-sgcc-key")

    response = client.post(
        "/integrations/sgcc/customer-identity-match",
        headers=integration_headers(),
        json={
            "primary_profile": {
                "external_customer_id": "cust-primary",
                "display_name": "Nia Putri",
                "phone_number": "0812-3456-7890",
                "email": "nia@example.com",
                "source_channel": "whatsapp",
                "assigned_user_name": "Aria",
            },
            "candidate_profiles": [
                {
                    "external_customer_id": "cust-match",
                    "display_name": "Nia P",
                    "phone_number": "081234567890",
                    "email": "nia@example.com",
                    "source_channel": "telegram",
                    "assigned_user_name": "Aria",
                },
                {
                    "external_customer_id": "cust-other",
                    "display_name": "Raka",
                    "phone_number": "0899999999",
                    "email": "raka@example.com",
                    "source_channel": "other",
                    "assigned_user_name": "Bima",
                },
            ],
            "match_threshold": 0.45,
        },
    )

    assert response.status_code == 200, response.text
    payload = response.json()
    assert payload["should_merge"] is True
    assert payload["recommended_match"]["external_customer_id"] == "cust-match"
    assert payload["recommended_match"]["match_score"] >= 0.7
    assert "email:exact" in payload["recommended_match"]["shared_signals"]

    db = db_session_factory()
    audit_logs = db.scalars(
        select(AuditLog).where(
            AuditLog.action == "integration.sgcc.customer_identity_match"
        )
    ).all()
    assert len(audit_logs) == 1
    assert audit_logs[0].metadata_json["should_merge"] is True


def test_sgcc_kpi_enrichment_returns_alerts_and_recommendations(
    client: TestClient,
    db_session_factory,
    monkeypatch,
) -> None:
    monkeypatch.setattr(settings, "sgcc_integration_api_key", "test-sgcc-key")

    response = client.post(
        "/integrations/sgcc/kpi-enrichment",
        headers=integration_headers(),
        json={
            "period_label": "Daily ops review 2026-05-20",
            "source_channel": "whatsapp",
            "summary": {
                "total_organizations": 1,
                "total_sales_users": 2,
                "total_leads": 12,
                "hot_leads": 5,
                "closing_leads": 2,
                "analyzed_conversations": 8,
                "reply_sent_rate": 0.3,
                "approved_reply_rate": 0.45,
                "overdue_follow_ups": 3,
                "pipeline_value": 15000000,
                "won_value": 2000000,
                "deposit_amount": 1000000,
                "win_rate": 0.2,
            },
            "marketing_execution_summary": {
                "total_items": 4,
                "done_items": 2,
                "published_items": 1,
                "leads_generated": 10,
                "qualified_leads": 4,
                "won_leads": 0,
                "attributed_pipeline_value": 3000000,
                "attributed_won_value": 0,
                "attributed_deposit_amount": 0,
            },
            "sales_performance": [
                {
                    "user_id": "11111111-1111-1111-1111-111111111111",
                    "user_name": "Aria",
                    "organization_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
                    "organization_name": "Clara Demo",
                    "assigned_leads": 6,
                    "hot_leads": 3,
                    "closing_leads": 1,
                    "conversations_owned": 4,
                    "analyzed_conversations": 3,
                    "approved_drafts": 1,
                    "replies_sent": 0,
                    "overdue_follow_ups": 2,
                    "won_leads": 0,
                    "pipeline_value": 8000000,
                    "won_value": 0,
                    "deposit_amount": 500000,
                }
            ],
            "organization_performance": [
                {
                    "organization_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
                    "organization_name": "Clara Demo",
                    "total_leads": 12,
                    "hot_leads": 5,
                    "closing_leads": 2,
                    "conversations": 8,
                    "analyzed_conversations": 8,
                    "reply_sent_rate": 0.3,
                    "approved_reply_rate": 0.45,
                    "overdue_follow_ups": 3,
                    "won_leads": 1,
                    "pipeline_value": 15000000,
                    "won_value": 2000000,
                    "deposit_amount": 1000000,
                }
            ],
            "source_performance": [],
        },
    )

    assert response.status_code == 200, response.text
    payload = response.json()
    assert payload["health_status"] == "critical"
    assert len(payload["alerts"]) >= 2
    assert len(payload["recommendations"]) >= 2
    assert len(payload["top_priorities"]) >= 2

    db = db_session_factory()
    audit_logs = db.scalars(
        select(AuditLog).where(
            AuditLog.action == "integration.sgcc.kpi_enrichment"
        )
    ).all()
    assert len(audit_logs) == 1
    assert audit_logs[0].metadata_json["health_status"] == "critical"

from pathlib import Path
import sys
from uuid import UUID

from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import sessionmaker

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.core.config import settings
from app.models.ai_extraction import AIExtraction
from app.models.approval_log import ApprovalLog
from app.models.conversation import Conversation
from app.models.message import Message
from app.models.reply_suggestion import ReplySuggestion
from app.models.sent_message import SentMessage
from app.schemas.ai_extraction_schema import AIExtractionCreate
from app.schemas.reply_suggestion_schema import ReplySuggestionCreate


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


def test_extension_snapshot_sync_creates_conversation_and_messages(
    client: TestClient,
    db_session_factory: sessionmaker,
    seeded_data: dict[str, object],
) -> None:
    marketing_a = seeded_data["marketing_a"]

    login(client, email=marketing_a.email, password="MarketingPass123!")

    response = client.post(
        "/extension/whatsapp/snapshots",
        json={
            "chatData": {
                "capturedAt": "2026-05-12T09:00:00.000Z",
                "chatTitle": "Leoni Customer",
                "chatSubtitle": "online",
                "messages": [
                    {
                        "id": "09.00-0",
                        "author": "Leoni",
                        "direction": "incoming",
                        "text": "Halo kak, ini legal tidak?",
                        "timestampLabel": "09.00",
                    },
                    {
                        "id": "09.01-1",
                        "author": "Arya",
                        "direction": "outgoing",
                        "text": "Legal, nanti saya kirim penjelasannya.",
                        "timestampLabel": "09.01",
                    },
                ],
            }
        },
        headers=csrf_headers(client),
    )

    assert response.status_code == 201, response.text
    payload = response.json()
    assert payload["status"] == "created"
    assert payload["duplicate"] is False
    assert payload["message_count"] == 2

    db = db_session_factory()
    conversation = db.get(Conversation, UUID(payload["conversation_id"]))
    assert conversation is not None
    assert conversation.source == "whatsapp_extension"
    assert conversation.title == "Leoni Customer"
    assert conversation.sales_user_id == marketing_a.id

    messages = list(
        db.scalars(
            select(Message)
            .where(Message.conversation_id == conversation.id)
            .order_by(Message.message_timestamp.asc())
        ).all()
    )
    assert len(messages) == 2
    assert messages[0].sender_type == "customer"
    assert messages[1].sender_type == "sales"


def test_extension_snapshot_sync_detects_duplicate_payload(
    client: TestClient,
    seeded_data: dict[str, object],
) -> None:
    marketing_a = seeded_data["marketing_a"]
    payload = {
        "chatData": {
            "capturedAt": "2026-05-12T09:00:00.000Z",
            "chatTitle": "Leoni Customer",
            "chatSubtitle": "online",
            "messages": [
                {
                    "id": "09.00-0",
                    "author": "Leoni",
                    "direction": "incoming",
                    "text": "Halo kak, ini legal tidak?",
                    "timestampLabel": "09.00",
                },
                {
                    "id": "09.01-1",
                    "author": "Arya",
                    "direction": "outgoing",
                    "text": "Legal, nanti saya kirim penjelasannya.",
                    "timestampLabel": "09.01",
                },
            ],
        }
    }

    login(client, email=marketing_a.email, password="MarketingPass123!")

    first_response = client.post(
        "/extension/whatsapp/snapshots",
        json=payload,
        headers=csrf_headers(client),
    )
    assert first_response.status_code == 201, first_response.text

    duplicate_response = client.post(
        "/extension/whatsapp/snapshots",
        json=payload,
        headers=csrf_headers(client),
    )
    assert duplicate_response.status_code == 201, duplicate_response.text
    duplicate_payload = duplicate_response.json()
    assert duplicate_payload["status"] == "duplicate"
    assert duplicate_payload["duplicate"] is True


def test_extension_reply_suggestions_endpoint_generates_clara_suggestions(
    client: TestClient,
    db_session_factory: sessionmaker,
    seeded_data: dict[str, object],
    monkeypatch,
) -> None:
    marketing_a = seeded_data["marketing_a"]

    monkeypatch.setattr(
        "app.services.ai_extraction_service.call_openai_for_extraction",
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
                "notes": "Belum ada sinyal budget spesifik.",
            },
            recommended_reply_strategy={
                "tone": "professional",
                "key_points": ["jelaskan legalitas", "beri referensi resmi"],
                "avoid_topics": ["janji hasil"],
            },
            customer_summary="Customer masih ragu pada aspek legalitas produk.",
            next_best_action="Berikan penjelasan legalitas dan dokumen pendukung resmi.",
            content_insight="Topik legalitas paling dominan dalam percakapan.",
            internal_notes="Perlu bukti legal formal.",
            confidence_score=0.91,
        ),
    )
    monkeypatch.setattr(
        "app.services.reply_suggestion_service.call_openai_for_reply_suggestion",
        lambda **_kwargs: ReplySuggestionCreate(
            suggested_replies=[
                {
                    "tone": "friendly",
                    "text": "Siap kak, saya jelaskan legalitasnya pelan-pelan ya.",
                    "reasoning": "Versi ramah untuk menurunkan resistensi awal.",
                },
                {
                    "tone": "professional",
                    "text": "Baik kak, saya bantu kirim penjelasan legalitas dan referensi resmi yang tersedia.",
                    "reasoning": "Versi profesional untuk memperkuat kredibilitas.",
                },
                {
                    "tone": "empathetic",
                    "text": "Wajar kak kalau masih ragu, nanti saya bantu kirim dasar legalitasnya supaya lebih tenang.",
                    "reasoning": "Versi empatik untuk menjawab keraguan customer.",
                },
            ]
        ),
    )

    login(client, email=marketing_a.email, password="MarketingPass123!")

    response = client.post(
        "/extension/whatsapp/reply-suggestions",
        json={
            "chatData": {
                "capturedAt": "2026-05-12T09:00:00.000Z",
                "chatTitle": "Leoni Customer",
                "chatSubtitle": "online",
                "messages": [
                    {
                        "id": "09.00-0",
                        "author": "Leoni",
                        "direction": "incoming",
                        "text": "Ini legal tidak ya kak?",
                        "timestampLabel": "09.00",
                    },
                    {
                        "id": "09.01-1",
                        "author": "Arya",
                        "direction": "outgoing",
                        "text": "Saya bantu jelaskan ya kak.",
                        "timestampLabel": "09.01",
                    },
                ],
            }
        },
        headers=csrf_headers(client),
    )

    assert response.status_code == 201, response.text
    payload = response.json()
    assert payload["status"] == "created"
    assert payload["cached"] is False
    assert payload["risk_level"] == "medium"
    assert payload["next_best_action"] == (
        "Berikan penjelasan legalitas dan dokumen pendukung resmi."
    )
    assert len(payload["suggestions"]) == 3
    assert payload["suggestions"][0] == (
        "Siap kak, saya jelaskan legalitasnya pelan-pelan ya."
    )

    db = db_session_factory()
    conversation_id = UUID(payload["conversation_id"])
    assert db.get(Conversation, conversation_id) is not None

    extraction_count = len(
        list(
            db.scalars(
                select(AIExtraction).where(
                    AIExtraction.conversation_id == conversation_id
                )
            ).all()
        )
    )
    suggestion_count = len(
        list(
            db.scalars(
                select(ReplySuggestion).where(
                    ReplySuggestion.conversation_id == conversation_id
                )
            ).all()
        )
    )
    assert extraction_count == 1
    assert suggestion_count == 1


def test_extension_send_endpoint_auto_approves_and_marks_sent(
    client: TestClient,
    db_session_factory: sessionmaker,
    seeded_data: dict[str, object],
    monkeypatch,
) -> None:
    marketing_a = seeded_data["marketing_a"]

    monkeypatch.setattr(
        "app.services.ai_extraction_service.call_openai_for_extraction",
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
                "notes": "Belum ada sinyal budget spesifik.",
            },
            recommended_reply_strategy={
                "tone": "professional",
                "key_points": ["jelaskan legalitas", "beri referensi resmi"],
                "avoid_topics": ["janji hasil"],
            },
            customer_summary="Customer masih ragu pada aspek legalitas produk.",
            next_best_action="Berikan penjelasan legalitas dan dokumen pendukung resmi.",
            content_insight="Topik legalitas paling dominan dalam percakapan.",
            internal_notes="Perlu bukti legal formal.",
            confidence_score=0.91,
        ),
    )
    monkeypatch.setattr(
        "app.services.reply_suggestion_service.call_openai_for_reply_suggestion",
        lambda **_kwargs: ReplySuggestionCreate(
            suggested_replies=[
                {
                    "tone": "friendly",
                    "text": "Siap kak, saya jelaskan legalitasnya pelan-pelan ya.",
                    "reasoning": "Versi ramah untuk menurunkan resistensi awal.",
                },
                {
                    "tone": "professional",
                    "text": "Baik kak, saya bantu kirim penjelasan legalitas dan referensi resmi yang tersedia.",
                    "reasoning": "Versi profesional untuk memperkuat kredibilitas.",
                },
                {
                    "tone": "empathetic",
                    "text": "Wajar kak kalau masih ragu, nanti saya bantu kirim dasar legalitasnya supaya lebih tenang.",
                    "reasoning": "Versi empatik untuk menjawab keraguan customer.",
                },
            ]
        ),
    )

    login(client, email=marketing_a.email, password="MarketingPass123!")

    suggestion_response = client.post(
        "/extension/whatsapp/reply-suggestions",
        json={
            "chatData": {
                "capturedAt": "2026-05-12T09:00:00.000Z",
                "chatTitle": "Leoni Customer",
                "chatSubtitle": "online",
                "messages": [
                    {
                        "id": "09.00-0",
                        "author": "Leoni",
                        "direction": "incoming",
                        "text": "Ini legal tidak ya kak?",
                        "timestampLabel": "09.00",
                    },
                    {
                        "id": "09.01-1",
                        "author": "Arya",
                        "direction": "outgoing",
                        "text": "Saya bantu jelaskan ya kak.",
                        "timestampLabel": "09.01",
                    },
                ],
            }
        },
        headers=csrf_headers(client),
    )

    assert suggestion_response.status_code == 201, suggestion_response.text
    suggestion_payload = suggestion_response.json()
    reply_suggestion_id = suggestion_payload["reply_suggestion_id"]
    final_reply_text = suggestion_payload["suggestions"][0]

    send_response = client.post(
        f"/extension/whatsapp/reply-suggestions/{reply_suggestion_id}/send",
        json={
            "selectedReplyText": final_reply_text,
            "finalReplyText": final_reply_text,
            "sentByName": "Marketing Alpha",
        },
        headers=csrf_headers(client),
    )

    assert send_response.status_code == 201, send_response.text
    send_payload = send_response.json()
    assert send_payload["status"] == "sent"
    assert send_payload["approval_status"] == "approved"
    assert send_payload["auto_approved"] is True
    assert send_payload["already_sent"] is False

    db = db_session_factory()
    suggestion = db.get(ReplySuggestion, UUID(reply_suggestion_id))
    assert suggestion is not None
    assert suggestion.approval_status == "approved"
    assert suggestion.final_reply_text == final_reply_text

    sent_message = db.get(SentMessage, UUID(send_payload["sent_message_id"]))
    assert sent_message is not None
    assert sent_message.reply_suggestion_id == suggestion.id
    assert sent_message.send_mode == "whatsapp_extension"

    approval_log = db.scalars(
        select(ApprovalLog).where(ApprovalLog.reply_suggestion_id == suggestion.id)
    ).first()
    assert approval_log is not None
    assert approval_log.action == "approved_via_extension_send"


def test_extension_reply_suggestions_endpoint_uses_cache_for_duplicate_snapshot(
    client: TestClient,
    db_session_factory: sessionmaker,
    seeded_data: dict[str, object],
    monkeypatch,
) -> None:
    marketing_a = seeded_data["marketing_a"]
    extraction_calls = {"count": 0}
    reply_calls = {"count": 0}

    def fake_extraction(_conversation_text: str) -> AIExtractionCreate:
        extraction_calls["count"] += 1
        return AIExtractionCreate(
            lead_temperature="warm",
            pipeline_stage="objection",
            buying_intent="medium",
            sentiment="cautious",
            risk_level="medium",
            main_objections=["legalitas"],
            budget_signal={
                "detected": False,
                "amount_text": None,
                "notes": "Belum ada sinyal budget spesifik.",
            },
            recommended_reply_strategy={
                "tone": "professional",
                "key_points": ["jelaskan legalitas"],
                "avoid_topics": ["janji hasil"],
            },
            customer_summary="Customer ragu soal legalitas.",
            next_best_action="Kirim penjelasan legalitas resmi.",
            content_insight="Legalitas adalah isu utama.",
            internal_notes="Perlu dokumen resmi.",
            confidence_score=0.88,
        )

    def fake_reply(**_kwargs) -> ReplySuggestionCreate:
        reply_calls["count"] += 1
        return ReplySuggestionCreate(
            suggested_replies=[
                {
                    "tone": "friendly",
                    "text": "Siap kak, saya bantu jelaskan legalitasnya ya.",
                    "reasoning": "Ramah.",
                },
                {
                    "tone": "professional",
                    "text": "Baik kak, saya kirim penjelasan legalitas resmi yang tersedia.",
                    "reasoning": "Profesional.",
                },
                {
                    "tone": "empathetic",
                    "text": "Wajar kak kalau masih ragu, nanti saya bantu kirim dasar legalitasnya.",
                    "reasoning": "Empatik.",
                },
            ]
        )

    monkeypatch.setattr(
        "app.services.ai_extraction_service.call_openai_for_extraction",
        fake_extraction,
    )
    monkeypatch.setattr(
        "app.services.reply_suggestion_service.call_openai_for_reply_suggestion",
        fake_reply,
    )

    login(client, email=marketing_a.email, password="MarketingPass123!")

    request_payload = {
        "chatData": {
            "capturedAt": "2026-05-12T09:00:00.000Z",
            "chatTitle": "Leoni Customer",
            "chatSubtitle": "online",
            "messages": [
                {
                    "id": "09.00-0",
                    "author": "Leoni",
                    "direction": "incoming",
                    "text": "Ini legal tidak ya kak?",
                    "timestampLabel": "09.00",
                },
                {
                    "id": "09.01-1",
                    "author": "Arya",
                    "direction": "outgoing",
                    "text": "Saya bantu jelaskan ya kak.",
                    "timestampLabel": "09.01",
                },
            ],
        }
    }

    first_response = client.post(
        "/extension/whatsapp/reply-suggestions",
        json=request_payload,
        headers=csrf_headers(client),
    )
    assert first_response.status_code == 201, first_response.text

    second_response = client.post(
        "/extension/whatsapp/reply-suggestions",
        json=request_payload,
        headers=csrf_headers(client),
    )
    assert second_response.status_code == 201, second_response.text

    second_payload = second_response.json()
    assert second_payload["status"] == "duplicate"
    assert second_payload["duplicate"] is True
    assert second_payload["cached"] is True
    assert extraction_calls["count"] == 1
    assert reply_calls["count"] == 1

    db = db_session_factory()
    conversation_id = UUID(second_payload["conversation_id"])
    extraction_count = len(
        list(
            db.scalars(
                select(AIExtraction).where(AIExtraction.conversation_id == conversation_id)
            ).all()
        )
    )
    suggestion_count = len(
        list(
            db.scalars(
                select(ReplySuggestion).where(
                    ReplySuggestion.conversation_id == conversation_id
                )
            ).all()
        )
    )
    assert extraction_count == 1
    assert suggestion_count == 1

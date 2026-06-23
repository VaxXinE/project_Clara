from datetime import datetime, timezone
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
from app.services.extension_ingest_service import (
    NormalizedSnapshotMessage,
    split_reply_context_from_snapshot_text,
)


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


def test_extension_snapshot_sync_updates_messages_when_chat_grows(
    client: TestClient,
    db_session_factory: sessionmaker,
    seeded_data: dict[str, object],
) -> None:
    marketing_a = seeded_data["marketing_a"]

    login(client, email=marketing_a.email, password="MarketingPass123!")

    initial_payload = {
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

    first_response = client.post(
        "/extension/whatsapp/snapshots",
        json=initial_payload,
        headers=csrf_headers(client),
    )
    assert first_response.status_code == 201, first_response.text
    conversation_id = UUID(first_response.json()["conversation_id"])

    updated_payload = {
        "chatData": {
            "capturedAt": "2026-05-12T09:05:00.000Z",
            "chatTitle": "Leoni Customer",
            "chatSubtitle": "online",
            "messages": [
                *initial_payload["chatData"]["messages"],
                {
                    "id": "09.05-2",
                    "author": "Leoni",
                    "direction": "incoming",
                    "text": "Kalau saya kirim datanya hari ini bisa diproses ya?",
                    "timestampLabel": "09.05",
                },
            ],
        }
    }

    update_response = client.post(
        "/extension/whatsapp/snapshots",
        json=updated_payload,
        headers=csrf_headers(client),
    )
    assert update_response.status_code == 201, update_response.text
    assert update_response.json()["status"] == "updated"

    db = db_session_factory()
    messages = list(
        db.scalars(
            select(Message)
            .where(Message.conversation_id == conversation_id)
            .order_by(Message.message_timestamp.asc())
        ).all()
    )
    assert len(messages) == 3


def test_split_reply_context_from_snapshot_text_keeps_only_new_customer_body() -> None:
    previous_messages = [
        NormalizedSnapshotMessage(
            external_message_id="09.27-0",
            author="Arya",
            sender_type="sales",
            text=(
                "Bisa kak, tapi untuk hitung berapa lot dan kira-kira daya tahan dananya, "
                "saya perlu modal depo pastinya berapa dulu. Kalau nominalnya sudah ada, "
                "saya bantu arahkan perkiraan sesuai acuan Mini ya kak."
            ),
            timestamp=datetime(2026, 6, 23, 14, 27, tzinfo=timezone.utc),
            timestamp_label="09.27",
        )
    ]

    normalized = split_reply_context_from_snapshot_text(
        raw_text=(
            "Bisa kak, tapi untuk hitung berapa lot dan kira-kira daya tahan dananya, "
            "saya perlu modal depo pastinya berapa dulu\n"
            "Aku mau deposit 5juta"
        ),
        sender_type="customer",
        previous_messages=previous_messages,
    )

    assert normalized == "Aku mau deposit 5juta"


def test_extension_snapshot_sync_strips_reply_quote_from_new_message(
    client: TestClient,
    db_session_factory: sessionmaker,
    seeded_data: dict[str, object],
) -> None:
    marketing_a = seeded_data["marketing_a"]

    login(client, email=marketing_a.email, password="MarketingPass123!")

    payload = {
        "chatData": {
            "capturedAt": "2026-06-23T14:29:00.000Z",
            "chatTitle": "Bagol A",
            "chatSubtitle": "online",
            "messages": [
                {
                    "id": "14.27-0",
                    "author": "Arya",
                    "direction": "outgoing",
                    "text": (
                        "Bisa kak, tapi untuk hitung berapa lot dan kira-kira daya tahan dananya, "
                        "saya perlu modal depo pastinya berapa dulu. Kalau nominalnya sudah ada, "
                        "saya bantu arahkan perkiraan sesuai acuan Mini ya kak."
                    ),
                    "timestampLabel": "14.27",
                },
                {
                    "id": "14.28-1",
                    "author": "Bagol A",
                    "direction": "incoming",
                    "text": (
                        "Bisa kak, tapi untuk hitung berapa lot dan kira-kira daya tahan dananya, "
                        "saya perlu modal depo pastinya berapa dulu\n"
                        "Aku mau deposit 5juta"
                    ),
                    "timestampLabel": "14.28",
                },
            ],
        }
    }

    response = client.post(
        "/extension/whatsapp/snapshots",
        json=payload,
        headers=csrf_headers(client),
    )

    assert response.status_code == 201, response.text

    db = db_session_factory()
    conversation = db.get(Conversation, UUID(response.json()["conversation_id"]))
    assert conversation is not None

    messages = list(
        db.scalars(
            select(Message)
            .where(Message.conversation_id == conversation.id)
            .order_by(Message.message_timestamp.asc())
        ).all()
    )
    assert messages[-1].sender_type == "customer"
    assert messages[-1].message_text == "Aku mau deposit 5juta"


def test_extension_snapshot_sync_dedupes_repeated_messages_within_single_snapshot(
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
                        "id": "09.00-1",
                        "author": "Leoni",
                        "direction": "incoming",
                        "text": "Halo kak, ini legal tidak?",
                        "timestampLabel": "09.00",
                    },
                    {
                        "id": "09.01-2",
                        "author": "Arya",
                        "direction": "outgoing",
                        "text": "Legal, nanti saya kirim penjelasannya.",
                        "timestampLabel": "09.01",
                    },
                    {
                        "id": "09.01-3",
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
    conversation_id = UUID(payload["conversation_id"])

    db = db_session_factory()
    messages = list(
        db.scalars(
            select(Message)
            .where(Message.conversation_id == conversation_id)
            .order_by(Message.message_timestamp.asc())
        ).all()
    )
    assert len(messages) == 2
    assert messages[0].message_text == "Halo kak, ini legal tidak?"
    assert messages[1].message_text == "Legal, nanti saya kirim penjelasannya."


def test_extension_reply_suggestions_regenerate_when_snapshot_changed_before_request(
    client: TestClient,
    db_session_factory: sessionmaker,
    seeded_data: dict[str, object],
    monkeypatch,
) -> None:
    marketing_a = seeded_data["marketing_a"]
    extraction_calls = {"count": 0}
    reply_calls = {"count": 0}

    def fake_extraction(conversation_text: str) -> AIExtractionCreate:
        extraction_calls["count"] += 1
        has_latest_question = "Kalau saya kirim datanya hari ini bisa diproses ya?" in conversation_text
        return AIExtractionCreate(
            lead_temperature="hot" if has_latest_question else "warm",
            pipeline_stage="closing" if has_latest_question else "objection",
            buying_intent="high" if has_latest_question else "medium",
            sentiment="positive" if has_latest_question else "cautious",
            risk_level="medium",
            main_objections=["legalitas"],
            budget_signal={
                "detected": False,
                "amount_text": None,
                "notes": "Belum ada sinyal budget spesifik.",
            },
            recommended_reply_strategy={
                "tone": "professional",
                "key_points": ["jawab legalitas", "jelaskan proses"],
                "avoid_topics": ["janji hasil"],
            },
            customer_summary=(
                "Customer siap kirim data hari ini."
                if has_latest_question
                else "Customer ragu soal legalitas."
            ),
            next_best_action=(
                "Arahkan langkah kirim data dan validasi proses."
                if has_latest_question
                else "Kirim penjelasan legalitas resmi."
            ),
            content_insight="Legalitas adalah isu utama.",
            internal_notes="Perlu dokumen resmi.",
            confidence_score=0.88,
        )

    def fake_reply(**kwargs) -> ReplySuggestionCreate:
        reply_calls["count"] += 1
        extraction = kwargs["extraction"]
        has_latest_question = extraction.pipeline_stage == "closing"
        return ReplySuggestionCreate(
            suggested_replies=[
                {
                    "tone": "friendly",
                    "text": (
                        "Siap kak, kalau datanya dikirim hari ini saya bantu arahkan prosesnya."
                        if has_latest_question
                        else "Siap kak, saya bantu jelaskan legalitasnya ya."
                    ),
                    "reasoning": "Ramah.",
                },
                {
                    "tone": "professional",
                    "text": (
                        "Baik kak, saya bantu cek data dan jelaskan alur prosesnya."
                        if has_latest_question
                        else "Baik kak, saya kirim penjelasan legalitas resmi yang tersedia."
                    ),
                    "reasoning": "Profesional.",
                },
                {
                    "tone": "empathetic",
                    "text": (
                        "Tenang kak, nanti saya dampingi supaya proses kirim data lebih jelas."
                        if has_latest_question
                        else "Wajar kak kalau masih ragu, nanti saya bantu kirim dasar legalitasnya."
                    ),
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

    initial_payload = {
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
        json=initial_payload,
        headers=csrf_headers(client),
    )
    assert first_response.status_code == 201, first_response.text
    assert first_response.json()["cached"] is False

    updated_snapshot_payload = {
        "chatData": {
            "capturedAt": "2026-05-12T09:05:00.000Z",
            "chatTitle": "Leoni Customer",
            "chatSubtitle": "online",
            "messages": [
                *initial_payload["chatData"]["messages"],
                {
                    "id": "09.05-2",
                    "author": "Leoni",
                    "direction": "incoming",
                    "text": "Kalau saya kirim datanya hari ini bisa diproses ya?",
                    "timestampLabel": "09.05",
                },
            ],
        }
    }

    sync_only_response = client.post(
        "/extension/whatsapp/snapshots",
        json=updated_snapshot_payload,
        headers=csrf_headers(client),
    )
    assert sync_only_response.status_code == 201, sync_only_response.text
    assert sync_only_response.json()["status"] == "updated"

    second_response = client.post(
        "/extension/whatsapp/reply-suggestions",
        json=updated_snapshot_payload,
        headers=csrf_headers(client),
    )
    assert second_response.status_code == 201, second_response.text
    second_payload = second_response.json()
    assert second_payload["status"] == "duplicate"
    assert second_payload["duplicate"] is True
    assert second_payload["cached"] is False
    assert "kirim data hari ini" in second_payload["customer_summary"].lower()
    assert extraction_calls["count"] == 2
    assert reply_calls["count"] == 2

    db = db_session_factory()
    conversation_id = UUID(second_payload["conversation_id"])
    messages = list(
        db.scalars(
            select(Message).where(Message.conversation_id == conversation_id)
        ).all()
    )
    assert len(messages) == 3


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
    assert len(payload["suggestions"]) == 1
    assert payload["suggestions"][0] == (
        "Siap kak, saya jelaskan legalitasnya pelan-pelan ya."
    )
    assert len(payload["suggestion_details"]) == 1
    assert payload["suggestion_details"][0]["tone"] == "friendly"

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

    timeline_messages = list(
        db.scalars(
            select(Message)
            .where(Message.conversation_id == suggestion.conversation_id)
            .order_by(Message.message_timestamp.asc(), Message.created_at.asc())
        ).all()
    )
    assert timeline_messages
    assert timeline_messages[-1].sender_type == "sales"
    assert timeline_messages[-1].sender_name == "Marketing Alpha"
    assert timeline_messages[-1].message_text == final_reply_text

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


def test_extension_snapshot_sync_reuses_synthetic_sales_message_after_send(
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
                "key_points": ["jelaskan legalitas"],
                "avoid_topics": ["janji hasil"],
            },
            customer_summary="Customer bertanya soal legalitas.",
            next_best_action="Jawab legalitas dan lanjutkan arahan.",
            content_insight="Customer butuh kepastian legalitas.",
            internal_notes="Aman untuk follow-up singkat.",
            confidence_score=0.91,
        ),
    )
    monkeypatch.setattr(
        "app.services.reply_suggestion_service.call_openai_for_reply_suggestion",
        lambda **_kwargs: ReplySuggestionCreate(
            suggested_replies=[
                {
                    "tone": "best",
                    "text": "Iya kak, legal dan diawasi BAPPEBTI.",
                    "reasoning": "Jawaban singkat langsung ke inti.",
                }
            ]
        ),
    )

    login(client, email=marketing_a.email, password="MarketingPass123!")

    initial_payload = {
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
                }
            ],
        }
    }

    suggestion_response = client.post(
        "/extension/whatsapp/reply-suggestions",
        json=initial_payload,
        headers=csrf_headers(client),
    )
    assert suggestion_response.status_code == 201, suggestion_response.text
    suggestion_payload = suggestion_response.json()

    send_response = client.post(
        f"/extension/whatsapp/reply-suggestions/{suggestion_payload['reply_suggestion_id']}/send",
        json={
            "selectedReplyText": "Iya kak, legal dan diawasi BAPPEBTI.",
            "finalReplyText": "Iya kak, legal dan diawasi BAPPEBTI.",
            "sentByName": "Marketing Alpha",
        },
        headers=csrf_headers(client),
    )
    assert send_response.status_code == 201, send_response.text

    updated_snapshot = {
        "chatData": {
            "capturedAt": "2026-05-12T09:01:00.000Z",
            "chatTitle": "Leoni Customer",
            "chatSubtitle": "online",
            "messages": [
                *initial_payload["chatData"]["messages"],
                {
                    "id": "09.01-1",
                    "author": "Arya",
                    "direction": "outgoing",
                    "text": "Iya kak, legal dan diawasi BAPPEBTI.",
                    "timestampLabel": "09.01",
                },
            ],
        }
    }

    sync_response = client.post(
        "/extension/whatsapp/snapshots",
        json=updated_snapshot,
        headers=csrf_headers(client),
    )
    assert sync_response.status_code == 201, sync_response.text

    db = db_session_factory()
    conversation_id = UUID(suggestion_payload["conversation_id"])
    timeline_messages = list(
        db.scalars(
            select(Message)
            .where(Message.conversation_id == conversation_id)
            .order_by(Message.message_timestamp.asc(), Message.created_at.asc())
        ).all()
    )
    assert len(timeline_messages) == 2
    assert timeline_messages[0].sender_type == "customer"
    assert timeline_messages[1].sender_type == "sales"
    assert timeline_messages[1].message_text == "Iya kak, legal dan diawasi BAPPEBTI."
    assert timeline_messages[1].external_message_id is not None

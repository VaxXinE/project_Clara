from datetime import datetime, timezone
from uuid import UUID

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import sessionmaker

from app.core.config import settings
from app.models.conversation import Conversation
from app.models.message import Message
from app.schemas.ai_extraction_schema import AIExtractionCreate
from app.schemas.reply_suggestion_schema import ReplySuggestionCreate


PROPERTY_A = "property-alpha"
PROPERTY_B = "property-beta"


def login(client: TestClient, email: str, password: str = "MarketingPass123!") -> None:
    response = client.post("/auth/login", json={"email": email, "password": password})
    assert response.status_code == 200, response.text


def csrf_headers(client: TestClient) -> dict[str, str]:
    token = client.cookies.get(settings.csrf_cookie_name)
    assert token
    return {"X-CSRF-Token": token}


def configure_tawk(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(settings, "extension_tawk_enabled", True)
    monkeypatch.setattr(
        settings,
        "tawk_property_organization_map",
        {PROPERTY_A: "org-alpha", PROPERTY_B: "org-beta"},
    )


def snapshot(
    *,
    property_id: str = PROPERTY_A,
    chat_id: str = "chat-one",
    title: str = "Visitor One",
    text: str = "Halo dari Tawk",
    message_id: str = "dom-message-one",
    timestamp_label: str = "08:02",
) -> dict:
    return {
        "chatData": {
            "capturedAt": "2026-05-12T01:02:00.000Z",
            "channel": "tawk",
            "provider": "extension",
            "externalThreadId": f"tawk:{property_id}:{chat_id}",
            "chatTitle": title,
            "chatSubtitle": "Tawk.to Live Chat",
            "messages": [
                {
                    "id": message_id,
                    "author": title,
                    "direction": "incoming",
                    "text": text,
                    "timestampLabel": timestamp_label,
                }
            ],
        }
    }


def post_snapshot(client: TestClient, payload: dict):
    return client.post(
        "/extension/tawk/snapshots",
        json=payload,
        headers=csrf_headers(client),
    )


def test_disabled_tawk_snapshot_is_rejected(
    client: TestClient,
    seeded_data: dict[str, object],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(settings, "extension_tawk_enabled", False)
    login(client, seeded_data["marketing_a"].email)

    response = post_snapshot(client, snapshot())

    assert response.status_code == 403
    assert response.json()["detail"]["code"] == "FEATURE_DISABLED"


@pytest.mark.parametrize(
    "external_thread_id",
    [None, "", "property-alpha:chat-one", "tawk:property-alpha", "tawk:a:b:c"],
)
def test_tawk_requires_canonical_identity_before_writes(
    client: TestClient,
    db_session_factory: sessionmaker,
    seeded_data: dict[str, object],
    monkeypatch: pytest.MonkeyPatch,
    external_thread_id: str | None,
) -> None:
    configure_tawk(monkeypatch)
    login(client, seeded_data["marketing_a"].email)
    payload = snapshot()
    if external_thread_id is None:
        payload["chatData"].pop("externalThreadId")
    else:
        payload["chatData"]["externalThreadId"] = external_thread_id

    response = post_snapshot(client, payload)

    assert response.status_code == 400
    db = db_session_factory()
    assert not db.scalars(
        select(Conversation).where(Conversation.provider_key == "tawk")
    ).all()
    db.close()


@pytest.mark.parametrize("property_id", [PROPERTY_B, "unmapped-property"])
def test_tawk_property_is_authenticated_organization_boundary(
    client: TestClient,
    db_session_factory: sessionmaker,
    seeded_data: dict[str, object],
    monkeypatch: pytest.MonkeyPatch,
    property_id: str,
) -> None:
    configure_tawk(monkeypatch)
    login(client, seeded_data["marketing_a"].email)

    response = post_snapshot(client, snapshot(property_id=property_id))

    assert response.status_code == 400
    assert "org-beta" not in response.text
    db = db_session_factory()
    assert not db.scalars(
        select(Conversation).where(Conversation.provider_key == "tawk")
    ).all()
    db.close()


def test_tawk_extension_chat_storage_replay_and_title_change(
    client: TestClient,
    db_session_factory: sessionmaker,
    seeded_data: dict[str, object],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    configure_tawk(monkeypatch)
    login(client, seeded_data["marketing_a"].email)

    first = post_snapshot(client, snapshot())
    renamed = post_snapshot(client, snapshot(title="Visitor Renamed"))

    assert first.status_code == renamed.status_code == 201
    assert renamed.json()["conversation_id"] == first.json()["conversation_id"]
    assert renamed.json()["source"] == "tawk_extension"
    db = db_session_factory()
    conversations = db.scalars(
        select(Conversation).where(Conversation.provider_key == "tawk")
    ).all()
    assert len(conversations) == 1
    conversation = conversations[0]
    assert conversation.title == "Visitor Renamed"
    assert conversation.channel == "live_chat"
    assert conversation.provider == "extension"
    assert conversation.provider_key == "tawk"
    assert conversation.source == "tawk_extension"
    assert conversation.sales_user_id == seeded_data["marketing_a"].id
    messages = db.scalars(
        select(Message).where(Message.conversation_id == conversation.id)
    ).all()
    assert len(messages) == 1
    assert messages[0].channel == "live_chat"
    assert messages[0].provider == "extension"
    assert messages[0].external_message_id.startswith("twext:")
    db.close()


def test_equal_titles_with_different_chat_ids_stay_separate(
    client: TestClient,
    db_session_factory: sessionmaker,
    seeded_data: dict[str, object],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    configure_tawk(monkeypatch)
    login(client, seeded_data["marketing_a"].email)

    first = post_snapshot(client, snapshot(chat_id="chat-one", title="Same Visitor"))
    second = post_snapshot(client, snapshot(chat_id="chat-two", title="Same Visitor"))

    assert first.status_code == second.status_code == 201
    assert first.json()["conversation_id"] != second.json()["conversation_id"]
    db = db_session_factory()
    conversations = db.scalars(
        select(Conversation).where(Conversation.provider_key == "tawk")
    ).all()
    assert len(conversations) == 2
    db.close()


def test_existing_owner_cannot_be_hijacked_and_manager_cannot_create(
    client: TestClient,
    seeded_data: dict[str, object],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    configure_tawk(monkeypatch)
    login(client, seeded_data["marketing_a"].email)
    created = post_snapshot(client, snapshot())
    assert created.status_code == 201

    login(client, seeded_data["marketing_b"].email)
    rejected_sales = post_snapshot(client, snapshot())
    assert rejected_sales.status_code == 400

    login(client, seeded_data["manager_a"].email, "ManagerPass123!")
    rejected_manager = post_snapshot(client, snapshot(chat_id="new-manager-chat"))
    assert rejected_manager.status_code == 400


def create_official_conversation(
    db_session_factory: sessionmaker,
    seeded_data: dict[str, object],
    *,
    duplicate_official_message: bool = False,
) -> UUID:
    db = db_session_factory()
    conversation = Conversation(
        organization_id=seeded_data["org_a"].id,
        sales_user_id=seeded_data["marketing_b"].id,
        lead_id=seeded_data["owned_lead"].id,
        title="Webhook Visitor",
        channel="live_chat",
        provider="official_api",
        provider_key="tawk",
        external_thread_id=f"tawk:{PROPERTY_A}:official-chat",
        external_thread_key=f"tawk:{PROPERTY_A}:official-chat",
        source="tawk_webhook",
        status="webhook_synced",
        raw_text="official transcript",
        started_at=datetime(2026, 5, 12, 1, 2, tzinfo=timezone.utc),
        last_message_at=datetime(2026, 5, 12, 1, 2, tzinfo=timezone.utc),
    )
    db.add(conversation)
    db.flush()
    for index in range(2 if duplicate_official_message else 1):
        db.add(
            Message(
                conversation_id=conversation.id,
                channel="live_chat",
                provider="official_api",
                external_message_id=f"tawkmsg:official-{index}",
                sender_name="Webhook Visitor",
                sender_type="customer",
                message_text="Halo dari Tawk",
                message_timestamp=datetime(
                    2026, 5, 12, 1, 2, index, tzinfo=timezone.utc
                ),
            )
        )
    db.commit()
    conversation_id = conversation.id
    db.close()
    return conversation_id


def test_official_conversation_is_reused_without_downgrade(
    client: TestClient,
    db_session_factory: sessionmaker,
    seeded_data: dict[str, object],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    configure_tawk(monkeypatch)
    conversation_id = create_official_conversation(
        db_session_factory,
        seeded_data,
    )
    login(client, seeded_data["manager_a"].email, "ManagerPass123!")

    response = post_snapshot(
        client,
        snapshot(chat_id="official-chat", title="Updated Visitor"),
    )

    assert response.status_code == 201, response.text
    assert UUID(response.json()["conversation_id"]) == conversation_id
    db = db_session_factory()
    conversation = db.get(Conversation, conversation_id)
    assert conversation.provider == "official_api"
    assert conversation.source == "tawk_webhook"
    assert conversation.sales_user_id == seeded_data["marketing_b"].id
    assert conversation.lead_id == seeded_data["owned_lead"].id
    assert conversation.title == "Updated Visitor"
    messages = db.scalars(
        select(Message).where(Message.conversation_id == conversation_id)
    ).all()
    assert len(messages) == 1
    assert messages[0].provider == "official_api"
    assert messages[0].external_message_id == "tawkmsg:official-0"
    db.close()


def test_ambiguous_official_messages_are_not_destructively_collapsed(
    client: TestClient,
    db_session_factory: sessionmaker,
    seeded_data: dict[str, object],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    configure_tawk(monkeypatch)
    conversation_id = create_official_conversation(
        db_session_factory,
        seeded_data,
        duplicate_official_message=True,
    )
    login(client, seeded_data["manager_a"].email, "ManagerPass123!")

    response = post_snapshot(client, snapshot(chat_id="official-chat"))

    assert response.status_code == 201, response.text
    db = db_session_factory()
    messages = db.scalars(
        select(Message).where(Message.conversation_id == conversation_id)
    ).all()
    assert len(messages) == 3
    assert sum(message.provider == "official_api" for message in messages) == 2
    assert sum(message.provider == "extension" for message in messages) == 1
    db.close()


def test_tawk_uses_generic_ai_flow_and_send_stays_unavailable(
    client: TestClient,
    seeded_data: dict[str, object],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    configure_tawk(monkeypatch)
    monkeypatch.setattr(
        "app.services.ai_extraction_service.call_openai_for_extraction",
        lambda _conversation_text: AIExtractionCreate(
            lead_temperature="warm",
            pipeline_stage="qualification",
            buying_intent="medium",
            sentiment="neutral",
            risk_level="low",
            main_objections=[],
            budget_signal={
                "detected": False,
                "amount_text": None,
                "notes": "Belum ada budget.",
            },
            recommended_reply_strategy={
                "tone": "friendly",
                "key_points": ["jawab kebutuhan"],
                "avoid_topics": ["janji hasil"],
            },
            customer_summary="Visitor meminta informasi.",
            next_best_action="Jawab pertanyaan visitor.",
            content_insight="Pertanyaan awal.",
            internal_notes="Tawk extension.",
            confidence_score=0.9,
        ),
    )
    monkeypatch.setattr(
        "app.services.reply_suggestion_service.call_openai_for_reply_suggestion",
        lambda **_kwargs: ReplySuggestionCreate(
            suggested_replies=[
                {
                    "tone": "friendly",
                    "text": "Siap, saya bantu informasinya ya.",
                    "reasoning": "Jawaban awal yang ringkas.",
                }
            ]
        ),
    )
    login(client, seeded_data["marketing_a"].email)

    suggestion = client.post(
        "/extension/tawk/reply-suggestions",
        json=snapshot(),
        headers=csrf_headers(client),
    )

    assert suggestion.status_code == 201, suggestion.text
    body = suggestion.json()
    assert body["source"] == "tawk_extension"
    assert body["suggestions"] == ["Siap, saya bantu informasinya ya."]

    send = client.post(
        f"/extension/tawk/reply-suggestions/{body['reply_suggestion_id']}/send",
        json={
            "selectedReplyText": body["suggestions"][0],
            "finalReplyText": body["suggestions"][0],
            "sentByName": "Marketing Alpha",
        },
        headers=csrf_headers(client),
    )
    assert send.status_code == 400
    assert send.json()["detail"]["code"] == "TAWK_REPLY_ACTION_NOT_AVAILABLE"


@pytest.mark.parametrize(
    ("channel", "flag_name", "expected_source"),
    [
        ("whatsapp", "extension_whatsapp_enabled", "whatsapp_extension"),
        ("instagram", "extension_instagram_enabled", "instagram_extension"),
        ("tiktok", "extension_tiktok_enabled", "tiktok_extension"),
    ],
)
def test_generic_extension_response_uses_channel_source(
    client: TestClient,
    seeded_data: dict[str, object],
    monkeypatch: pytest.MonkeyPatch,
    channel: str,
    flag_name: str,
    expected_source: str,
) -> None:
    monkeypatch.setattr(settings, flag_name, True)
    login(client, seeded_data["marketing_a"].email)
    payload = snapshot()
    payload["chatData"].pop("externalThreadId")
    payload["chatData"]["channel"] = channel

    response = client.post(
        f"/extension/{channel}/snapshots",
        json=payload,
        headers=csrf_headers(client),
    )

    assert response.status_code == 201, response.text
    assert response.json()["source"] == expected_source

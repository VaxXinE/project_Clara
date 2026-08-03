from datetime import datetime, timedelta, timezone
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session, sessionmaker

from app.core.config import settings
from app.models.ai_extraction import AIExtraction
from app.models.extension_delivery import (
    ExtensionDeliveryAuthorization,
    ExtensionDeliveryEvent,
)
from app.models.reply_suggestion import ReplySuggestion
from app.models.sent_message import SentMessage
from app.services.clara_extension_delivery_service import (
    CLARA_EXTENSION_DELIVERY_CONTRACT_VERSION,
    DeliveryPermission,
    ExtensionDeliveryError,
    ExtensionDeliveryMode,
    authorize_extension_delivery,
    claim_extension_delivery,
    normalize_extension_delivery_mode,
    reconcile_extension_delivery,
)


SNAPSHOT = "a" * 64
LATEST = "b" * 64
ACTIVE_CHAT = "c" * 64
SAFE_REPLY = "Baik, saya bantu cek langkah berikutnya secara aman."


def create_suggestion(
    db: Session,
    seeded_data: dict[str, object],
    *,
    action_mode: str = "reply_now",
    approval_status: str = "pending",
    risk_level: str = "low",
) -> ReplySuggestion:
    conversation = db.get(
        type(seeded_data["owned_conversation"]),
        seeded_data["owned_conversation"].id,
    )
    extraction = AIExtraction(
        conversation_id=conversation.id,
        model_name="test-model",
        schema_version="v1",
        lead_temperature="warm",
        pipeline_stage="qualification",
        buying_intent="medium",
        sentiment="neutral",
        risk_level=risk_level,
        main_objections=[],
        budget_signal={"detected": False, "amount_text": None, "notes": "n/a"},
        recommended_reply_strategy={"tone": "professional", "key_points": [], "avoid_topics": []},
        customer_summary="Safe test summary.",
        next_best_action="Review manually.",
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
        action_mode=action_mode,
        approval_status=approval_status,
        risk_level=risk_level,
        suggested_replies=[{"tone": "best", "text": SAFE_REPLY, "reasoning": "safe"}],
        policy_reasons=[],
        selected_reply_text=SAFE_REPLY if approval_status == "approved" else None,
        final_reply_text=SAFE_REPLY if approval_status == "approved" else None,
        extension_snapshot_fingerprint=SNAPSHOT,
        extension_latest_message_fingerprint=LATEST,
        extension_active_chat_fingerprint=ACTIVE_CHAT,
    )
    db.add(suggestion)
    db.commit()
    db.refresh(suggestion)
    return suggestion


def authorize(
    db: Session,
    user,
    suggestion: ReplySuggestion,
    **overrides,
):
    values = {
        "channel": "whatsapp",
        "current_user": user,
        "suggestion": suggestion,
        "final_reply_text": SAFE_REPLY,
        "snapshot_fingerprint": SNAPSHOT,
        "latest_message_fingerprint": LATEST,
        "active_chat_fingerprint": ACTIVE_CHAT,
        "suggestion_version": suggestion.version,
        "idempotency_key": f"delivery-{uuid4()}",
        "explicit_human_action": True,
    }
    values.update(overrides)
    return authorize_extension_delivery(db, **values)


def login(client: TestClient, email: str, password: str) -> dict[str, str]:
    response = client.post("/auth/login", json={"email": email, "password": password})
    assert response.status_code == 200
    return {"X-CSRF-Token": client.cookies.get(settings.csrf_cookie_name)}


def test_configuration_defaults_and_normalization() -> None:
    assert settings.clara_extension_delivery_mode == "LEGACY"
    assert settings.clara_persona_authority_mode == "LEGACY"
    assert settings.clara_semantic_revalidation_mode == "OFF"
    assert settings.clara_policy_enforcement_mode == "OBSERVE"
    assert settings.clara_product_fact_mode == "LEGACY"
    assert settings.clara_process_state_mode == "LEGACY"
    assert settings.clara_service_routing_mode == "LEGACY"
    assert normalize_extension_delivery_mode("governed").mode == ExtensionDeliveryMode.GOVERNED
    assert normalize_extension_delivery_mode("ObSeRvE").mode == ExtensionDeliveryMode.OBSERVE
    assert normalize_extension_delivery_mode("invalid").mode == ExtensionDeliveryMode.LEGACY
    assert CLARA_EXTENSION_DELIVERY_CONTRACT_VERSION == "1.0"


def test_governed_api_authorizes_before_send_and_rejects_legacy_post_send(
    client: TestClient,
    db_session_factory: sessionmaker,
    seeded_data: dict[str, object],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(settings, "clara_extension_delivery_mode", "GOVERNED")
    db = db_session_factory()
    suggestion = create_suggestion(db, seeded_data)
    suggestion_id = suggestion.id
    db.close()
    headers = login(client, "marketing.beta@clara.local", "MarketingPass123!")

    authorization = client.post(
        f"/extension/whatsapp/reply-suggestions/{suggestion_id}/delivery-authorizations",
        headers=headers,
        json={
            "activeChatFingerprint": ACTIVE_CHAT,
            "explicitHumanAction": True,
            "finalReplyText": SAFE_REPLY,
            "idempotencyKey": f"delivery-{uuid4()}",
            "latestMessageFingerprint": LATEST,
            "snapshotFingerprint": SNAPSHOT,
            "suggestionVersion": 1,
        },
    )
    assert authorization.status_code == 201, authorization.text
    payload = authorization.json()
    assert payload["mode"] == "GOVERNED"
    assert payload["authorization_token"]
    assert "token_hash" not in payload

    legacy_send = client.post(
        f"/extension/whatsapp/reply-suggestions/{suggestion_id}/send",
        headers=headers,
        json={
            "finalReplyText": SAFE_REPLY,
            "selectedReplyText": SAFE_REPLY,
            "sentByName": "extension_user",
        },
    )
    assert legacy_send.status_code == 409
    assert legacy_send.json()["detail"]["code"] == "DELIVERY_AUTHORIZATION_REQUIRED"


def test_observe_records_safe_decision_without_approval_or_token(
    db_session_factory: sessionmaker,
    seeded_data: dict[str, object],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(settings, "clara_extension_delivery_mode", "OBSERVE")
    db = db_session_factory()
    user = db.get(type(seeded_data["marketing_b"]), seeded_data["marketing_b"].id)
    suggestion = create_suggestion(db, seeded_data)

    decision = authorize(db, user, suggestion)

    db.refresh(suggestion)
    stored = db.get(ExtensionDeliveryAuthorization, decision.authorization_id)
    assert decision.delivery_permission == DeliveryPermission.ALLOW_MANUAL_SEND
    assert decision.authorization_token is None
    assert suggestion.approval_status == "pending"
    assert stored.token_hash is None
    assert stored.status == "OBSERVED"
    assert SAFE_REPLY not in str(decision.debug_metadata())
    assert "authorization_token" not in decision.debug_metadata()
    db.close()


def test_governed_authorize_claim_and_sent_reconciliation_are_single_use(
    db_session_factory: sessionmaker,
    seeded_data: dict[str, object],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(settings, "clara_extension_delivery_mode", "GOVERNED")
    db = db_session_factory()
    user = db.get(type(seeded_data["marketing_b"]), seeded_data["marketing_b"].id)
    suggestion = create_suggestion(db, seeded_data)
    idempotency_key = f"delivery-{uuid4()}"

    decision = authorize(db, user, suggestion, idempotency_key=idempotency_key)

    assert decision.delivery_permission == DeliveryPermission.ALLOW_MANUAL_SEND
    assert decision.authorization_token
    assert decision.authorization_expires_at > datetime.now(timezone.utc)
    db.refresh(suggestion)
    assert suggestion.approval_status == "approved"
    assert suggestion.version == 2
    authorization = db.get(ExtensionDeliveryAuthorization, decision.authorization_id)
    assert authorization.token_hash
    assert authorization.token_hash != decision.authorization_token
    assert SAFE_REPLY not in str(authorization.__dict__)

    replay = authorize(
        db,
        user,
        suggestion,
        idempotency_key=idempotency_key,
        suggestion_version=suggestion.version,
    )
    assert replay.authorization_token is None
    assert replay.authorization_id == authorization.id

    claimed = claim_extension_delivery(
        db,
        authorization_id=authorization.id,
        current_user=user,
        authorization_token=decision.authorization_token,
        conversation_id=suggestion.conversation_id,
        suggestion_id=suggestion.id,
        snapshot_fingerprint=SNAPSHOT,
        latest_message_fingerprint=LATEST,
        active_chat_fingerprint=ACTIVE_CHAT,
        final_text_hash=decision.final_text_hash,
    )
    assert claimed.status == "SENDING"
    with pytest.raises(ExtensionDeliveryError, match="ALREADY_CLAIMED"):
        claim_extension_delivery(
            db,
            authorization_id=authorization.id,
            current_user=user,
            authorization_token=decision.authorization_token,
            conversation_id=suggestion.conversation_id,
            suggestion_id=suggestion.id,
            snapshot_fingerprint=SNAPSHOT,
            latest_message_fingerprint=LATEST,
            active_chat_fingerprint=ACTIVE_CHAT,
            final_text_hash=decision.final_text_hash,
        )

    browser_event_id = f"browser-{uuid4()}"
    completed, sent_message, duplicate = reconcile_extension_delivery(
        db,
        authorization_id=authorization.id,
        current_user=user,
        authorization_token=decision.authorization_token,
        result_status="SENT",
        browser_event_id=browser_event_id,
        adapter_result_code="SEND_CONFIRMED",
        active_chat_fingerprint=ACTIVE_CHAT,
        latest_message_fingerprint=LATEST,
        final_text_hash=decision.final_text_hash,
    )
    assert completed.status == "SENT"
    assert sent_message is not None
    assert duplicate is False

    _, replayed_sent, duplicate = reconcile_extension_delivery(
        db,
        authorization_id=authorization.id,
        current_user=user,
        authorization_token=decision.authorization_token,
        result_status="SENT",
        browser_event_id=browser_event_id,
        adapter_result_code="SEND_CONFIRMED",
        active_chat_fingerprint=ACTIVE_CHAT,
        latest_message_fingerprint=LATEST,
        final_text_hash=decision.final_text_hash,
    )
    assert duplicate is True
    assert replayed_sent.id == sent_message.id
    assert len(
        list(
            db.scalars(
                select(SentMessage).where(
                    SentMessage.reply_suggestion_id == suggestion.id
                )
            )
        )
    ) == 1
    event_types = set(
        db.scalars(
            select(ExtensionDeliveryEvent.event_type).where(
                ExtensionDeliveryEvent.authorization_id == authorization.id
            )
        ).all()
    )
    assert {"AUTHORIZED", "CLAIMED", "SENDING", "SENT"} <= event_types
    db.close()


@pytest.mark.parametrize(
    ("override", "reason"),
    [
        ({"snapshot_fingerprint": "d" * 64}, "snapshot_mismatch"),
        ({"latest_message_fingerprint": "d" * 64}, "latest_message_mismatch"),
        ({"active_chat_fingerprint": "d" * 64}, "active_chat_mismatch"),
        ({"suggestion_version": 99}, "suggestion_version_outdated"),
    ],
)
def test_governed_stale_context_requires_refresh(
    db_session_factory: sessionmaker,
    seeded_data: dict[str, object],
    monkeypatch: pytest.MonkeyPatch,
    override: dict,
    reason: str,
) -> None:
    monkeypatch.setattr(settings, "clara_extension_delivery_mode", "GOVERNED")
    db = db_session_factory()
    user = db.get(type(seeded_data["marketing_b"]), seeded_data["marketing_b"].id)
    suggestion = create_suggestion(db, seeded_data)

    decision = authorize(db, user, suggestion, **override)

    assert decision.delivery_permission == DeliveryPermission.REQUIRE_REFRESH
    assert reason in decision.reason_codes
    assert decision.authorization_token is None
    db.close()


def test_governed_requires_review_for_elevated_and_blocks_blocked_suggestion(
    db_session_factory: sessionmaker,
    seeded_data: dict[str, object],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(settings, "clara_extension_delivery_mode", "GOVERNED")
    db = db_session_factory()
    user = db.get(type(seeded_data["marketing_b"]), seeded_data["marketing_b"].id)
    elevated = create_suggestion(db, seeded_data, action_mode="human_review", risk_level="high")
    blocked = create_suggestion(db, seeded_data, action_mode="BLOCK", approval_status="blocked")

    review_decision = authorize(db, user, elevated)
    block_decision = authorize(db, user, blocked)

    assert review_decision.delivery_permission == DeliveryPermission.REQUIRE_REVIEW
    assert elevated.approval_status == "pending"
    assert block_decision.delivery_permission == DeliveryPermission.BLOCK
    db.close()


@pytest.mark.parametrize(
    ("browser_result", "expected_status", "sent_count"),
    [("FAILED", "FAILED", 0), ("UNKNOWN", "RECONCILIATION_REQUIRED", 0)],
)
def test_failed_and_unknown_do_not_create_sent_message(
    db_session_factory: sessionmaker,
    seeded_data: dict[str, object],
    monkeypatch: pytest.MonkeyPatch,
    browser_result: str,
    expected_status: str,
    sent_count: int,
) -> None:
    monkeypatch.setattr(settings, "clara_extension_delivery_mode", "GOVERNED")
    db = db_session_factory()
    user = db.get(type(seeded_data["marketing_b"]), seeded_data["marketing_b"].id)
    suggestion = create_suggestion(db, seeded_data)
    decision = authorize(db, user, suggestion)
    claim_extension_delivery(
        db,
        authorization_id=decision.authorization_id,
        current_user=user,
        authorization_token=decision.authorization_token,
        conversation_id=suggestion.conversation_id,
        suggestion_id=suggestion.id,
        snapshot_fingerprint=SNAPSHOT,
        latest_message_fingerprint=LATEST,
        active_chat_fingerprint=ACTIVE_CHAT,
        final_text_hash=decision.final_text_hash,
    )

    authorization, _, _ = reconcile_extension_delivery(
        db,
        authorization_id=decision.authorization_id,
        current_user=user,
        authorization_token=decision.authorization_token,
        result_status=browser_result,
        browser_event_id=f"browser-{uuid4()}",
        adapter_result_code=f"TEST_{browser_result}",
        active_chat_fingerprint=ACTIVE_CHAT,
        latest_message_fingerprint=LATEST,
        final_text_hash=decision.final_text_hash,
    )

    assert authorization.status == expected_status
    assert len(
        list(
            db.scalars(
                select(SentMessage).where(
                    SentMessage.reply_suggestion_id == suggestion.id
                )
            )
        )
    ) == sent_count
    if browser_result == "UNKNOWN":
        retry = authorize(
            db,
            user,
            suggestion,
            suggestion_version=suggestion.version,
        )
        assert retry.delivery_permission == DeliveryPermission.RECONCILIATION_REQUIRED
    db.close()


def test_expired_authorization_cannot_be_claimed(
    db_session_factory: sessionmaker,
    seeded_data: dict[str, object],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(settings, "clara_extension_delivery_mode", "GOVERNED")
    db = db_session_factory()
    user = db.get(type(seeded_data["marketing_b"]), seeded_data["marketing_b"].id)
    suggestion = create_suggestion(db, seeded_data)
    decision = authorize(db, user, suggestion)
    authorization = db.get(ExtensionDeliveryAuthorization, decision.authorization_id)
    authorization.expires_at = datetime.now(timezone.utc) - timedelta(seconds=1)
    db.commit()

    with pytest.raises(ExtensionDeliveryError, match="expired"):
        claim_extension_delivery(
            db,
            authorization_id=authorization.id,
            current_user=user,
            authorization_token=decision.authorization_token,
            conversation_id=suggestion.conversation_id,
            suggestion_id=suggestion.id,
            snapshot_fingerprint=SNAPSHOT,
            latest_message_fingerprint=LATEST,
            active_chat_fingerprint=ACTIVE_CHAT,
            final_text_hash=decision.final_text_hash,
        )
    assert authorization.status == "EXPIRED"
    db.close()

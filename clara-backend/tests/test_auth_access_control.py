import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

from fastapi.testclient import TestClient
from sqlalchemy.orm import sessionmaker

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.core.config import settings
from app.models.ai_extraction import AIExtraction
from app.models.message import Message
from app.models.reply_suggestion import ReplySuggestion
from app.models.sent_message import SentMessage
from app.models.user import User
from app.services.access_control_service import can_access_conversation
from app.services.auth_service import verify_password


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


def test_login_sets_cookie_session_and_allows_fetching_current_user(
    client: TestClient,
    seeded_data: dict[str, object],
) -> None:
    owner = seeded_data["owner"]

    login(client, email=owner.email, password="OwnerPass123!")

    assert client.cookies.get("clara_access_token")
    assert client.cookies.get("clara_csrf_token")

    response = client.get("/auth/me")

    assert response.status_code == 200
    payload = response.json()
    assert payload["email"] == owner.email
    assert payload["role"] == "owner"
    assert payload["organization_name"] == "Org Alpha"


def test_authenticated_user_can_issue_bearer_access_token_for_extension(
    client: TestClient,
    seeded_data: dict[str, object],
) -> None:
    owner = seeded_data["owner"]

    login(client, email=owner.email, password="OwnerPass123!")

    response = client.post("/auth/access-token", headers=csrf_headers(client))

    assert response.status_code == 200, response.text
    payload = response.json()
    assert payload["token_type"] == "bearer"
    assert isinstance(payload["access_token"], str)
    assert len(payload["access_token"]) > 20


def test_inactive_user_cannot_login(
    client: TestClient,
    seeded_data: dict[str, object],
) -> None:
    inactive_user = seeded_data["inactive_user"]

    response = client.post(
        "/auth/login",
        json={
            "email": inactive_user.email,
            "password": "InactivePass123!",
        },
    )

    assert response.status_code == 401
    assert response.json()["detail"] == "User is inactive."


def test_admin_can_only_reset_password_for_user_they_created(
    client: TestClient,
    db_session_factory: sessionmaker,
    seeded_data: dict[str, object],
) -> None:
    admin_a = seeded_data["admin_a"]
    marketing_a = seeded_data["marketing_a"]
    marketing_b = seeded_data["marketing_b"]

    login(client, email=admin_a.email, password="AdminPass123!")

    allowed_response = client.post(
        f"/auth/users/{marketing_a.id}/reset-password",
        json={"password": "ResetPass123!"},
        headers=csrf_headers(client),
    )
    assert allowed_response.status_code == 200, allowed_response.text

    forbidden_response = client.post(
        f"/auth/users/{marketing_b.id}/reset-password",
        json={"password": "NopePass123!"},
        headers=csrf_headers(client),
    )
    assert forbidden_response.status_code == 403
    assert (
        forbidden_response.json()["detail"]
        == "Admin can only reset passwords for users they created."
    )

    db = db_session_factory()
    refreshed_user = db.get(User, marketing_a.id)
    assert refreshed_user is not None
    assert verify_password("ResetPass123!", refreshed_user.hashed_password)


def test_owner_can_reset_any_user_password(
    client: TestClient,
    db_session_factory: sessionmaker,
    seeded_data: dict[str, object],
) -> None:
    owner = seeded_data["owner"]
    marketing_b = seeded_data["marketing_b"]

    login(client, email=owner.email, password="OwnerPass123!")

    response = client.post(
        f"/auth/users/{marketing_b.id}/reset-password",
        json={"password": "OwnerReset123!"},
        headers=csrf_headers(client),
    )

    assert response.status_code == 200, response.text

    db = db_session_factory()
    refreshed_user = db.get(User, marketing_b.id)
    assert refreshed_user is not None
    assert verify_password("OwnerReset123!", refreshed_user.hashed_password)


def test_only_owner_can_create_product_knowledge(
    client: TestClient,
    seeded_data: dict[str, object],
) -> None:
    admin_a = seeded_data["admin_a"]
    owner = seeded_data["owner"]

    login(client, email=admin_a.email, password="AdminPass123!")
    forbidden_response = client.post(
        "/product-knowledge",
        json={
            "title": "Admin Attempt",
            "category": "general",
            "content": "Ini tidak boleh lolos.",
            "source_type": "manual_note",
            "is_active": True,
        },
        headers=csrf_headers(client),
    )
    assert forbidden_response.status_code == 403

    client.post("/auth/logout", headers=csrf_headers(client))

    login(client, email=owner.email, password="OwnerPass123!")
    success_response = client.post(
        "/product-knowledge",
        json={
            "title": "Knowledge Owner",
            "category": "general",
            "content": "Knowledge ini dibuat owner.",
            "source_type": "manual_note",
            "is_active": True,
        },
        headers=csrf_headers(client),
    )

    assert success_response.status_code == 201, success_response.text
    payload = success_response.json()
    assert payload["title"] == "Knowledge Owner"
    assert payload["organization_id"] is None
    assert payload["scope_type"] == "global"


def test_marketing_can_view_global_product_knowledge_but_cannot_access_marketing_insights(
    client: TestClient,
    seeded_data: dict[str, object],
) -> None:
    marketing_a = seeded_data["marketing_a"]

    login(client, email=marketing_a.email, password="MarketingPass123!")

    knowledge_response = client.get("/product-knowledge")
    assert knowledge_response.status_code == 200, knowledge_response.text
    knowledge_items = knowledge_response.json()
    assert len(knowledge_items) == 1
    assert knowledge_items[0]["title"] == "Legalitas Global"
    assert knowledge_items[0]["scope_type"] == "global"

    insights_response = client.get("/dashboard/marketing/insights-preview")
    assert insights_response.status_code == 403
    assert (
        insights_response.json()["detail"]
        == "You do not have permission to access this resource."
    )


def test_conversation_access_control_respects_role_and_ownership(
    seeded_data: dict[str, object],
) -> None:
    owner = seeded_data["owner"]
    admin_a = seeded_data["admin_a"]
    marketing_a = seeded_data["marketing_a"]
    marketing_b = seeded_data["marketing_b"]
    marketing_other_org = seeded_data["marketing_other_org"]
    conversation = seeded_data["owned_conversation"]

    assert can_access_conversation(owner, conversation) is True
    assert can_access_conversation(admin_a, conversation) is True
    assert can_access_conversation(marketing_b, conversation) is True
    assert can_access_conversation(marketing_a, conversation) is False
    assert can_access_conversation(marketing_other_org, conversation) is False


def test_sales_inbox_clears_sent_state_when_customer_replies_after_send(
    client: TestClient,
    db_session_factory: sessionmaker,
    seeded_data: dict[str, object],
) -> None:
    marketing_b = seeded_data["marketing_b"]
    conversation = seeded_data["owned_conversation"]

    db = db_session_factory()
    base_time = datetime.now(timezone.utc) - timedelta(minutes=5)

    first_customer_message = Message(
        conversation_id=conversation.id,
        sender_name="Customer",
        sender_type="customer",
        message_text="Halo, saya mau tanya dulu.",
        message_timestamp=base_time,
    )
    extraction = AIExtraction(
        conversation_id=conversation.id,
        model_name="gpt-4.1-mini",
        schema_version="v1",
        customer_summary="Customer masih ragu.",
        lead_temperature="warm",
        pipeline_stage="consideration",
        buying_intent="medium",
        sentiment="cautious",
        risk_level="medium",
        main_objections=["legalitas"],
        budget_signal={},
        recommended_reply_strategy={"mode": "educate_with_proof"},
        next_best_action="Jawab keberatan customer dengan bukti legalitas.",
        content_insight="Customer butuh bukti legalitas dan social proof.",
        internal_notes="Refresh analysis after every new customer objection.",
        confidence_score=0.78,
        created_at=base_time + timedelta(seconds=30),
    )
    db.add_all([first_customer_message, extraction])
    db.flush()

    suggestion = ReplySuggestion(
        conversation_id=conversation.id,
        ai_extraction_id=extraction.id,
        model_name="gpt-4.1-mini",
        schema_version="v1",
        risk_level="medium",
        action_mode="reply_ready",
        approval_status="approved",
        suggested_replies=[{"label": "friendly", "text": "Siap, kami bantu jelaskan."}],
        policy_reasons=["safe"],
        created_at=base_time + timedelta(minutes=1),
    )
    sent_message = SentMessage(
        conversation_id=conversation.id,
        reply_suggestion_id=suggestion.id,
        send_mode="extension_direct_send",
        message_text="Siap, kami bantu jelaskan.",
        sent_by_name="Marketing Beta",
        sent_at=base_time + timedelta(minutes=2),
    )
    latest_customer_message = Message(
        conversation_id=conversation.id,
        sender_name="Customer",
        sender_type="customer",
        message_text="Oke, tapi saya masih belum yakin.",
        message_timestamp=base_time + timedelta(minutes=3),
    )

    db.add(suggestion)
    db.flush()
    sent_message.reply_suggestion_id = suggestion.id

    db.add_all([sent_message, latest_customer_message])
    conversation.last_message_at = latest_customer_message.message_timestamp
    db.commit()
    db.close()

    login(client, email=marketing_b.email, password="MarketingPass123!")

    response = client.get("/dashboard/sales/inbox")

    assert response.status_code == 200, response.text
    payload = response.json()
    owned_item = next(
        item for item in payload if item["conversation_id"] == str(conversation.id)
    )
    assert owned_item["latest_sent_message"] is None
    assert owned_item["ui_status"] == "needs_analysis"

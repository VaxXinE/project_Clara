from pathlib import Path
import sys

from fastapi.testclient import TestClient
from sqlalchemy.orm import sessionmaker

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.core.config import settings
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

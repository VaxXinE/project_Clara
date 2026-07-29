from datetime import datetime, timedelta, timezone
from pathlib import Path
import sys
from uuid import UUID

from fastapi.testclient import TestClient
from sqlalchemy.orm import sessionmaker

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.core.config import settings
from app.models.performance_action import PerformanceAction
from app.models.sales_team import SalesTeam
from app.models.sales_unit import SalesUnit


def login(client: TestClient, *, email: str, password: str) -> None:
    response = client.post("/auth/login", json={"email": email, "password": password})
    assert response.status_code == 200, response.text


def csrf_headers(client: TestClient) -> dict[str, str]:
    csrf_token = client.cookies.get(settings.csrf_cookie_name)
    assert csrf_token
    return {"X-CSRF-Token": csrf_token}


def seed_manager_scope(
    *,
    db_session_factory: sessionmaker,
    seeded_data: dict[str, object],
) -> dict[str, str]:
    db = db_session_factory()
    org_a = seeded_data["org_a"]
    manager_a = db.get(type(seeded_data["manager_a"]), seeded_data["manager_a"].id)
    manager_b = db.get(type(seeded_data["manager_b"]), seeded_data["manager_b"].id)
    marketing_a = db.get(type(seeded_data["marketing_a"]), seeded_data["marketing_a"].id)
    marketing_b = db.get(type(seeded_data["marketing_b"]), seeded_data["marketing_b"].id)
    assert all(item is not None for item in [manager_a, manager_b, marketing_a, marketing_b])

    unit_alpha = SalesUnit(
        organization_id=org_a.id,
        name="Unit Alpha Action",
        code="unit-alpha-action",
    )
    unit_beta = SalesUnit(
        organization_id=org_a.id,
        name="Unit Beta Action",
        code="unit-beta-action",
    )
    db.add_all([unit_alpha, unit_beta])
    db.flush()

    team_red = SalesTeam(
        organization_id=org_a.id,
        unit_id=unit_alpha.id,
        manager_user_id=manager_a.id,
        name="Team Red Action",
        code="team-red-action",
    )
    team_blue = SalesTeam(
        organization_id=org_a.id,
        unit_id=unit_beta.id,
        manager_user_id=manager_b.id,
        name="Team Blue Action",
        code="team-blue-action",
    )
    db.add_all([team_red, team_blue])
    db.flush()

    manager_a.team_id = team_red.id
    marketing_b.team_id = team_red.id
    manager_b.team_id = team_blue.id
    marketing_a.team_id = team_blue.id

    db.commit()
    db.close()

    return {
        "team_red_id": str(team_red.id),
        "team_blue_id": str(team_blue.id),
        "marketing_b_id": str(marketing_b.id),
        "marketing_a_id": str(marketing_a.id),
    }


def build_action_payload(scope_ids: dict[str, str]) -> dict[str, object]:
    return {
        "assigned_to_user_id": scope_ids["marketing_b_id"],
        "team_id": scope_ids["team_red_id"],
        "sales_user_id": scope_ids["marketing_b_id"],
        "source_type": "sales_performance",
        "source_reference_id": scope_ids["marketing_b_id"],
        "title": "Rapikan backlog reply Sales B",
        "description": "Balas chat yang masih pending lalu cek hot lead dulu.",
        "action_type": "reply_backlog_review",
        "priority_label": "high",
        "due_at": (datetime.now(timezone.utc) + timedelta(days=1)).isoformat(),
    }


def test_manager_can_create_performance_action_in_scope(
    client: TestClient,
    db_session_factory: sessionmaker,
    seeded_data: dict[str, object],
) -> None:
    scope_ids = seed_manager_scope(
        db_session_factory=db_session_factory,
        seeded_data=seeded_data,
    )
    manager_a = seeded_data["manager_a"]

    login(client, email=manager_a.email, password="ManagerPass123!")
    response = client.post(
        "/dashboard/performance-actions",
        json=build_action_payload(scope_ids),
        headers=csrf_headers(client),
    )

    assert response.status_code == 201, response.text
    payload = response.json()
    assert payload["sales_user_id"] == scope_ids["marketing_b_id"]
    assert payload["team_id"] == scope_ids["team_red_id"]
    assert payload["status"] == "open"
    assert payload["priority_label"] == "high"


def test_manager_cannot_create_performance_action_outside_scope(
    client: TestClient,
    db_session_factory: sessionmaker,
    seeded_data: dict[str, object],
) -> None:
    scope_ids = seed_manager_scope(
        db_session_factory=db_session_factory,
        seeded_data=seeded_data,
    )
    manager_a = seeded_data["manager_a"]
    payload = build_action_payload(scope_ids)
    payload["assigned_to_user_id"] = scope_ids["marketing_a_id"]
    payload["sales_user_id"] = scope_ids["marketing_a_id"]
    payload["team_id"] = scope_ids["team_blue_id"]

    login(client, email=manager_a.email, password="ManagerPass123!")
    response = client.post(
        "/dashboard/performance-actions",
        json=payload,
        headers=csrf_headers(client),
    )

    assert response.status_code == 403, response.text


def test_head_can_create_performance_action_org_wide(
    client: TestClient,
    db_session_factory: sessionmaker,
    seeded_data: dict[str, object],
) -> None:
    scope_ids = seed_manager_scope(
        db_session_factory=db_session_factory,
        seeded_data=seeded_data,
    )
    admin_b = seeded_data["admin_b"]
    payload = build_action_payload(scope_ids)
    payload["assigned_to_user_id"] = scope_ids["marketing_a_id"]
    payload["sales_user_id"] = scope_ids["marketing_a_id"]
    payload["team_id"] = scope_ids["team_blue_id"]

    login(client, email=admin_b.email, password="AdminPass123!")
    response = client.post(
        "/dashboard/performance-actions",
        json=payload,
        headers=csrf_headers(client),
    )

    assert response.status_code == 201, response.text
    assert response.json()["team_id"] == scope_ids["team_blue_id"]


def test_sales_cannot_create_performance_action(
    client: TestClient,
    db_session_factory: sessionmaker,
    seeded_data: dict[str, object],
) -> None:
    scope_ids = seed_manager_scope(
        db_session_factory=db_session_factory,
        seeded_data=seeded_data,
    )
    marketing_b = seeded_data["marketing_b"]

    login(client, email=marketing_b.email, password="MarketingPass123!")
    response = client.post(
        "/dashboard/performance-actions",
        json=build_action_payload(scope_ids),
        headers=csrf_headers(client),
    )

    assert response.status_code == 403, response.text


def test_manager_list_performance_actions_is_scoped(
    client: TestClient,
    db_session_factory: sessionmaker,
    seeded_data: dict[str, object],
) -> None:
    scope_ids = seed_manager_scope(
        db_session_factory=db_session_factory,
        seeded_data=seeded_data,
    )
    db = db_session_factory()
    org_a = seeded_data["org_a"]
    manager_a = seeded_data["manager_a"]
    manager_b = seeded_data["manager_b"]
    db.add_all(
        [
            PerformanceAction(
                organization_id=org_a.id,
                created_by_user_id=manager_a.id,
                assigned_to_user_id=seeded_data["marketing_b"].id,
                team_id=UUID(scope_ids["team_red_id"]),
                sales_user_id=seeded_data["marketing_b"].id,
                source_type="sales_performance",
                source_reference_id=seeded_data["marketing_b"].id,
                title="Scoped action",
                description="Masuk scope manager A.",
                action_type="coaching",
                status="open",
                priority_label="high",
            ),
            PerformanceAction(
                organization_id=org_a.id,
                created_by_user_id=manager_b.id,
                assigned_to_user_id=seeded_data["marketing_a"].id,
                team_id=UUID(scope_ids["team_blue_id"]),
                sales_user_id=seeded_data["marketing_a"].id,
                source_type="team_performance",
                source_reference_id=UUID(scope_ids["team_blue_id"]),
                title="Out of scope action",
                description="Jangan terlihat oleh manager A.",
                action_type="crm_cleanup",
                status="open",
                priority_label="urgent",
            ),
        ]
    )
    db.commit()
    db.close()

    login(client, email=manager_a.email, password="ManagerPass123!")
    response = client.get("/dashboard/performance-actions")
    assert response.status_code == 200, response.text
    payload = response.json()
    assert payload["open_count"] == 1
    assert len(payload["items"]) == 1
    assert payload["items"][0]["title"] == "Scoped action"


def test_update_performance_action_status_is_validated(
    client: TestClient,
    db_session_factory: sessionmaker,
    seeded_data: dict[str, object],
) -> None:
    scope_ids = seed_manager_scope(
        db_session_factory=db_session_factory,
        seeded_data=seeded_data,
    )
    manager_a = seeded_data["manager_a"]

    login(client, email=manager_a.email, password="ManagerPass123!")
    create_response = client.post(
        "/dashboard/performance-actions",
        json=build_action_payload(scope_ids),
        headers=csrf_headers(client),
    )
    action_id = create_response.json()["id"]

    progress_response = client.patch(
        f"/dashboard/performance-actions/{action_id}",
        json={"status": "in_progress"},
        headers=csrf_headers(client),
    )
    assert progress_response.status_code == 200, progress_response.text
    assert progress_response.json()["status"] == "in_progress"

    done_response = client.patch(
        f"/dashboard/performance-actions/{action_id}",
        json={"status": "done", "resolution_note": "Sudah dibahas dengan sales."},
        headers=csrf_headers(client),
    )
    assert done_response.status_code == 200, done_response.text
    assert done_response.json()["status"] == "done"
    assert done_response.json()["completed_at"] is not None


def test_invalid_performance_action_transition_is_rejected(
    client: TestClient,
    db_session_factory: sessionmaker,
    seeded_data: dict[str, object],
) -> None:
    scope_ids = seed_manager_scope(
        db_session_factory=db_session_factory,
        seeded_data=seeded_data,
    )
    manager_a = seeded_data["manager_a"]

    login(client, email=manager_a.email, password="ManagerPass123!")
    create_response = client.post(
        "/dashboard/performance-actions",
        json=build_action_payload(scope_ids),
        headers=csrf_headers(client),
    )
    action_id = create_response.json()["id"]

    done_response = client.patch(
        f"/dashboard/performance-actions/{action_id}",
        json={"status": "done"},
        headers=csrf_headers(client),
    )
    assert done_response.status_code == 200, done_response.text

    invalid_response = client.patch(
        f"/dashboard/performance-actions/{action_id}",
        json={"status": "open"},
        headers=csrf_headers(client),
    )
    assert invalid_response.status_code == 400, invalid_response.text

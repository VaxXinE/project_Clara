from datetime import datetime, timedelta, timezone
from pathlib import Path
import sys
from uuid import UUID

from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import sessionmaker

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.core.config import settings
from app.models.ops_notification import OpsNotification
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


def seed_operational_alert_scope(
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
        name="Unit Alpha Alert",
        code="unit-alpha-alert",
    )
    unit_beta = SalesUnit(
        organization_id=org_a.id,
        name="Unit Beta Alert",
        code="unit-beta-alert",
    )
    db.add_all([unit_alpha, unit_beta])
    db.flush()

    team_red = SalesTeam(
        organization_id=org_a.id,
        unit_id=unit_alpha.id,
        manager_user_id=manager_a.id,
        name="Team Red Alert",
        code="team-red-alert",
    )
    team_blue = SalesTeam(
        organization_id=org_a.id,
        unit_id=unit_beta.id,
        manager_user_id=manager_b.id,
        name="Team Blue Alert",
        code="team-blue-alert",
    )
    db.add_all([team_red, team_blue])
    db.flush()

    manager_a.team_id = team_red.id
    marketing_b.team_id = team_red.id
    manager_b.team_id = team_blue.id
    marketing_a.team_id = team_blue.id

    db.add(
        PerformanceAction(
            organization_id=org_a.id,
            created_by_user_id=manager_a.id,
            assigned_to_user_id=marketing_b.id,
            team_id=team_red.id,
            sales_user_id=marketing_b.id,
            source_type="sales_performance",
            source_reference_id=marketing_b.id,
            title="Follow up backlog Sales B",
            description="Manager perlu dorong sales untuk menutup backlog.",
            action_type="coaching",
            status="open",
            priority_label="high",
            created_at=datetime.now(timezone.utc) - timedelta(days=4),
            updated_at=datetime.now(timezone.utc) - timedelta(days=4),
        )
    )
    db.commit()
    db.close()

    return {
        "team_red_id": str(team_red.id),
        "marketing_b_id": str(marketing_b.id),
    }


def test_manager_operational_alerts_are_generated_and_deduplicated(
    client: TestClient,
    db_session_factory: sessionmaker,
    seeded_data: dict[str, object],
) -> None:
    seed_operational_alert_scope(
        db_session_factory=db_session_factory,
        seeded_data=seeded_data,
    )
    manager_a = seeded_data["manager_a"]

    login(client, email=manager_a.email, password="ManagerPass123!")

    first_response = client.get("/dashboard/notifications")
    assert first_response.status_code == 200, first_response.text
    first_payload = first_response.json()
    first_alerts = [
        item for item in first_payload["items"] if item["source_type"] == "operational_alert"
    ]
    assert first_alerts
    assert all(item["target_role"] == "manager" for item in first_alerts)

    second_response = client.get("/dashboard/notifications")
    assert second_response.status_code == 200, second_response.text

    db = db_session_factory()
    rows = db.scalars(
        select(OpsNotification).where(
            OpsNotification.source_type == "operational_alert",
            OpsNotification.user_id == UUID(str(manager_a.id)),
        )
    ).all()
    db.close()

    assert len(rows) == 1
    assert rows[0].alert_type == "stale_coaching_action"


def test_head_sees_org_wide_operational_alerts_only(
    client: TestClient,
    db_session_factory: sessionmaker,
    seeded_data: dict[str, object],
) -> None:
    scope_ids = seed_operational_alert_scope(
        db_session_factory=db_session_factory,
        seeded_data=seeded_data,
    )
    admin_a = seeded_data["admin_a"]

    login(client, email=admin_a.email, password="AdminPass123!")
    response = client.get("/dashboard/notifications")

    assert response.status_code == 200, response.text
    payload = response.json()
    alerts = [item for item in payload["items"] if item["source_type"] == "operational_alert"]
    assert alerts
    assert all(item["user_id"] is None for item in alerts)
    assert any(item["team_id"] == scope_ids["team_red_id"] for item in alerts)


def test_sales_cannot_see_operational_alerts(
    client: TestClient,
    db_session_factory: sessionmaker,
    seeded_data: dict[str, object],
) -> None:
    seed_operational_alert_scope(
        db_session_factory=db_session_factory,
        seeded_data=seeded_data,
    )
    marketing_b = seeded_data["marketing_b"]

    login(client, email=marketing_b.email, password="MarketingPass123!")
    response = client.get("/dashboard/notifications")

    assert response.status_code == 200, response.text
    payload = response.json()
    assert not any(item["source_type"] == "operational_alert" for item in payload["items"])


def test_manager_operational_alert_status_transition_is_validated(
    client: TestClient,
    db_session_factory: sessionmaker,
    seeded_data: dict[str, object],
) -> None:
    seed_operational_alert_scope(
        db_session_factory=db_session_factory,
        seeded_data=seeded_data,
    )
    manager_a = seeded_data["manager_a"]

    login(client, email=manager_a.email, password="ManagerPass123!")
    list_response = client.get("/dashboard/notifications")
    assert list_response.status_code == 200, list_response.text
    alert = next(
        item
        for item in list_response.json()["items"]
        if item["source_type"] == "operational_alert"
    )

    ack_response = client.patch(
        f"/dashboard/notifications/{alert['id']}/acknowledge",
        headers=csrf_headers(client),
    )
    assert ack_response.status_code == 200, ack_response.text
    assert ack_response.json()["status"] == "acknowledged"

    ignore_response = client.patch(
        f"/dashboard/notifications/{alert['id']}/ignore",
        json={"resolution_note": "Akan dipantau manual."},
        headers=csrf_headers(client),
    )
    assert ignore_response.status_code == 200, ignore_response.text
    assert ignore_response.json()["status"] == "ignored"

    invalid_response = client.patch(
        f"/dashboard/notifications/{alert['id']}/resolve",
        json={"resolution_note": "Tidak boleh setelah ignored."},
        headers=csrf_headers(client),
    )
    assert invalid_response.status_code == 404, invalid_response.text

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
from app.services.dashboard_service import _deduplicate_operational_alert_seeds


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
    third_response = client.get("/dashboard/notifications")
    assert third_response.status_code == 200, third_response.text

    def logical_alerts(payload: dict[str, object]) -> set[tuple[str, str, str, str | None]]:
        return {
            (
                item["source_key"],
                item["alert_type"],
                item["severity"],
                item["sales_user_id"],
            )
            for item in payload["items"]
            if item["source_type"] == "operational_alert"
        }

    first_logical_alerts = logical_alerts(first_payload)
    assert {item[1] for item in first_logical_alerts} >= {
        "crm_discipline_drop",
        "stale_coaching_action",
    }
    assert logical_alerts(second_response.json()) == first_logical_alerts
    assert logical_alerts(third_response.json()) == first_logical_alerts

    db = db_session_factory()
    rows = db.scalars(
        select(OpsNotification).where(
            OpsNotification.source_type == "operational_alert",
            OpsNotification.user_id == UUID(str(manager_a.id)),
        )
    ).all()
    db.close()

    assert len(rows) == len(first_logical_alerts)
    assert len({row.source_key for row in rows}) == len(rows)


def test_duplicate_desired_operational_alert_seeds_choose_stronger_severity() -> None:
    warning = {
        "source_key": "ops-alert:hot_lead_stagnation:sales:example",
        "severity": "warning",
        "title": "Hot lead tertahan",
    }
    critical = {**warning, "severity": "critical"}

    assert _deduplicate_operational_alert_seeds([warning, warning]) == [warning]
    assert _deduplicate_operational_alert_seeds([warning, critical]) == [critical]
    assert _deduplicate_operational_alert_seeds([critical, warning]) == [critical]


def test_existing_duplicate_operational_alert_rows_are_reconciled(
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
    response = client.get("/dashboard/notifications")
    assert response.status_code == 200, response.text

    db = db_session_factory()
    original = db.scalars(
        select(OpsNotification).where(
            OpsNotification.user_id == manager_a.id,
            OpsNotification.alert_type == "stale_coaching_action",
        )
    ).one()
    original.status = "acknowledged"
    original.acknowledged_by_user_id = manager_a.id
    original.acknowledged_at = datetime.now(timezone.utc)
    duplicate = OpsNotification(
        organization_id=original.organization_id,
        user_id=original.user_id,
        team_id=original.team_id,
        sales_user_id=original.sales_user_id,
        source_type=original.source_type,
        source_key=original.source_key,
        source_reference_id=original.source_reference_id,
        alert_type=original.alert_type,
        workflow_scope=original.workflow_scope,
        owner_role=original.owner_role,
        target_role=original.target_role,
        severity=original.severity,
        title=original.title,
        body=original.body,
        target_href=original.target_href,
        status="active",
        delivery_channel="in_app",
        delivery_status="delivered",
        delivered_at=datetime.now(timezone.utc),
        metadata_json=original.metadata_json,
        triggered_at=datetime.now(timezone.utc),
        created_at=datetime.now(timezone.utc),
    )
    db.add_all([original, duplicate])
    db.commit()
    original_id = original.id
    duplicate_id = duplicate.id
    source_key = original.source_key
    db.close()

    sync_response = client.get("/dashboard/notifications")
    assert sync_response.status_code == 200, sync_response.text

    db = db_session_factory()
    rows = list(
        db.scalars(
            select(OpsNotification).where(OpsNotification.source_key == source_key)
        ).all()
    )
    db.close()

    open_rows = [row for row in rows if row.status in {"active", "acknowledged"}]
    assert [(row.id, row.status) for row in open_rows] == [
        (original_id, "acknowledged")
    ]
    assert next(row for row in rows if row.id == duplicate_id).status == "resolved"


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

    resync_response = client.get("/dashboard/notifications")
    assert resync_response.status_code == 200, resync_response.text

    db = db_session_factory()
    ignored_alert = db.get(OpsNotification, UUID(alert["id"]))
    assert ignored_alert is not None
    assert ignored_alert.status == "ignored"
    db.close()

    invalid_response = client.patch(
        f"/dashboard/notifications/{alert['id']}/resolve",
        json={"resolution_note": "Tidak boleh setelah ignored."},
        headers=csrf_headers(client),
    )
    assert invalid_response.status_code == 404, invalid_response.text

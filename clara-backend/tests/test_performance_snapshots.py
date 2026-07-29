from datetime import datetime, timedelta, timezone
from pathlib import Path
import sys
from uuid import UUID

from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import sessionmaker

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.core.config import settings
from app.models.ai_extraction import AIExtraction
from app.models.conversation import Conversation
from app.models.lead import Lead
from app.models.lead_discipline_log import LeadDisciplineLog
from app.models.message import Message
from app.models.sales_performance_snapshot import SalesPerformanceSnapshot
from app.models.sales_team import SalesTeam
from app.models.sales_unit import SalesUnit
from app.models.team_performance_snapshot import TeamPerformanceSnapshot


def login(client: TestClient, *, email: str, password: str) -> None:
    response = client.post("/auth/login", json={"email": email, "password": password})
    assert response.status_code == 200, response.text


def csrf_headers(client: TestClient) -> dict[str, str]:
    csrf_token = client.cookies.get(settings.csrf_cookie_name)
    assert csrf_token
    return {"X-CSRF-Token": csrf_token}


def prepare_snapshot_scope_data(
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
    marketing_other_org = db.get(
        type(seeded_data["marketing_other_org"]),
        seeded_data["marketing_other_org"].id,
    )
    owned_lead = db.get(type(seeded_data["owned_lead"]), seeded_data["owned_lead"].id)
    owned_conversation = db.get(
        type(seeded_data["owned_conversation"]),
        seeded_data["owned_conversation"].id,
    )
    assert all(
        value is not None
        for value in [
            manager_a,
            manager_b,
            marketing_a,
            marketing_b,
            marketing_other_org,
            owned_lead,
            owned_conversation,
        ]
    )

    now = datetime.now(timezone.utc)

    unit_red = SalesUnit(
        organization_id=org_a.id,
        name="Unit Snapshot Red",
        code="unit-snapshot-red",
    )
    unit_blue = SalesUnit(
        organization_id=org_a.id,
        name="Unit Snapshot Blue",
        code="unit-snapshot-blue",
    )
    db.add_all([unit_red, unit_blue])
    db.flush()

    team_red = SalesTeam(
        organization_id=org_a.id,
        unit_id=unit_red.id,
        manager_user_id=manager_a.id,
        name="Team Snapshot Red",
        code="team-snapshot-red",
    )
    team_blue = SalesTeam(
        organization_id=org_a.id,
        unit_id=unit_blue.id,
        manager_user_id=manager_b.id,
        name="Team Snapshot Blue",
        code="team-snapshot-blue",
    )
    db.add_all([team_red, team_blue])
    db.flush()

    manager_a.team_id = team_red.id
    manager_b.team_id = team_blue.id
    marketing_a.team_id = team_red.id
    marketing_b.team_id = team_blue.id

    lead_a = Lead(
        organization_id=org_a.id,
        assigned_user_id=marketing_a.id,
        display_name="Lead Snapshot Alpha",
        source="whatsapp_txt",
        current_stage="qualification",
        lead_temperature="hot",
        last_contact_at=now - timedelta(hours=8),
        next_follow_up_at=now - timedelta(days=2),
    )
    db.add(lead_a)
    db.flush()

    conversation_a = Conversation(
        organization_id=org_a.id,
        sales_user_id=marketing_a.id,
        lead_id=lead_a.id,
        title="Conversation Snapshot Alpha",
        source="whatsapp_txt",
        status="uploaded",
        current_stage="qualification",
        lead_temperature="hot",
        last_message_at=now - timedelta(hours=2),
    )
    db.add(conversation_a)
    db.flush()

    db.add(
        Message(
            conversation_id=conversation_a.id,
            sender_name="Customer Alpha",
            sender_type="customer",
            message_text="Tolong jelaskan lagi paketnya.",
            message_timestamp=now - timedelta(hours=2),
        )
    )
    db.add(
        AIExtraction(
            conversation_id=conversation_a.id,
            model_name="test-model",
            schema_version="v1",
            lead_temperature="hot",
            pipeline_stage="objection",
            buying_intent="medium",
            sentiment="curious",
            risk_level="medium",
            main_objections=["harga"],
            budget_signal={"detected": False, "amount_text": None, "notes": "n/a"},
            recommended_reply_strategy={
                "tone": "helpful",
                "key_points": ["jelaskan paket"],
                "avoid_topics": [],
            },
            customer_summary="Butuh follow up paket.",
            next_best_action="Buat draft balasan.",
            content_insight="Ada kebutuhan detail produk.",
            internal_notes="Snapshot current week.",
            confidence_score=0.9,
            created_at=now - timedelta(hours=1),
        )
    )
    db.add(
        LeadDisciplineLog(
            lead_id=lead_a.id,
            organization_id=org_a.id,
            actor_user_id=marketing_a.id,
            log_date=now.date(),
            activity_type="follow_up_chat",
            result_status="waiting_customer",
            notes="Log hari ini supaya discipline tetap rapi.",
        )
    )

    owned_lead.next_follow_up_at = now - timedelta(hours=6)
    owned_lead.last_contact_at = now - timedelta(hours=10)
    owned_conversation.last_message_at = now - timedelta(hours=5)
    marketing_other_org.team_id = None

    db.commit()
    db.close()

    return {
        "team_red_id": str(team_red.id),
        "team_blue_id": str(team_blue.id),
        "sales_allowed_id": str(marketing_a.id),
        "sales_denied_id": str(marketing_b.id),
        "other_org_sales_id": str(marketing_other_org.id),
    }


def test_sales_snapshots_can_be_generated(
    client: TestClient,
    db_session_factory: sessionmaker,
    seeded_data: dict[str, object],
) -> None:
    prepare_snapshot_scope_data(
        db_session_factory=db_session_factory,
        seeded_data=seeded_data,
    )
    login(client, email=seeded_data["manager_a"].email, password="ManagerPass123!")

    response = client.post(
        "/dashboard/performance-snapshots/generate?weeks=4",
        headers=csrf_headers(client),
    )
    assert response.status_code == 200, response.text
    payload = response.json()
    assert payload["sales_snapshot_count"] >= 4

    db = db_session_factory()
    rows = db.scalars(select(SalesPerformanceSnapshot)).all()
    assert len(rows) >= 4
    db.close()


def test_team_snapshots_can_be_generated(
    client: TestClient,
    db_session_factory: sessionmaker,
    seeded_data: dict[str, object],
) -> None:
    scope_ids = prepare_snapshot_scope_data(
        db_session_factory=db_session_factory,
        seeded_data=seeded_data,
    )
    login(client, email=seeded_data["manager_a"].email, password="ManagerPass123!")

    response = client.post(
        "/dashboard/performance-snapshots/generate?weeks=4",
        headers=csrf_headers(client),
    )
    assert response.status_code == 200, response.text

    db = db_session_factory()
    team_rows = db.scalars(
        select(TeamPerformanceSnapshot).where(
            TeamPerformanceSnapshot.team_id == UUID(scope_ids["team_red_id"]),
        )
    ).all()
    assert len(team_rows) == 4
    db.close()


def test_snapshot_generation_does_not_leak_other_organization(
    client: TestClient,
    db_session_factory: sessionmaker,
    seeded_data: dict[str, object],
) -> None:
    scope_ids = prepare_snapshot_scope_data(
        db_session_factory=db_session_factory,
        seeded_data=seeded_data,
    )
    login(client, email=seeded_data["manager_a"].email, password="ManagerPass123!")

    response = client.post(
        "/dashboard/performance-snapshots/generate?weeks=4",
        headers=csrf_headers(client),
    )
    assert response.status_code == 200, response.text

    db = db_session_factory()
    leaked = db.scalars(
        select(SalesPerformanceSnapshot).where(
            SalesPerformanceSnapshot.sales_user_id
            == UUID(scope_ids["other_org_sales_id"]),
        )
    ).all()
    assert leaked == []
    db.close()


def test_manager_can_only_read_historical_data_within_scope(
    client: TestClient,
    db_session_factory: sessionmaker,
    seeded_data: dict[str, object],
) -> None:
    scope_ids = prepare_snapshot_scope_data(
        db_session_factory=db_session_factory,
        seeded_data=seeded_data,
    )
    login(client, email=seeded_data["manager_a"].email, password="ManagerPass123!")

    generate_response = client.post(
        "/dashboard/performance-snapshots/generate?weeks=4",
        headers=csrf_headers(client),
    )
    assert generate_response.status_code == 200, generate_response.text

    allowed_response = client.get(
        f"/dashboard/manager-insights/sales/{scope_ids['sales_allowed_id']}/history?weeks=4",
    )
    assert allowed_response.status_code == 200, allowed_response.text
    assert allowed_response.json()["sales_user"]["id"] == scope_ids["sales_allowed_id"]

    denied_response = client.get(
        f"/dashboard/manager-insights/sales/{scope_ids['sales_denied_id']}/history?weeks=4",
    )
    assert denied_response.status_code == 403, denied_response.text

    allowed_team_response = client.get(
        f"/dashboard/manager-insights/teams/{scope_ids['team_red_id']}/history?weeks=4",
    )
    assert allowed_team_response.status_code == 200, allowed_team_response.text

    denied_team_response = client.get(
        f"/dashboard/manager-insights/teams/{scope_ids['team_blue_id']}/history?weeks=4",
    )
    assert denied_team_response.status_code == 403, denied_team_response.text


def test_head_can_read_historical_data_org_wide(
    client: TestClient,
    db_session_factory: sessionmaker,
    seeded_data: dict[str, object],
) -> None:
    scope_ids = prepare_snapshot_scope_data(
        db_session_factory=db_session_factory,
        seeded_data=seeded_data,
    )
    login(client, email=seeded_data["admin_a"].email, password="AdminPass123!")

    generate_response = client.post(
        "/dashboard/performance-snapshots/generate?weeks=4",
        headers=csrf_headers(client),
    )
    assert generate_response.status_code == 200, generate_response.text

    response = client.get(
        f"/dashboard/manager-insights/sales/{scope_ids['sales_denied_id']}/history?weeks=4",
    )
    assert response.status_code == 200, response.text
    assert response.json()["history_summary"]["trend_label"] in {
        "improving",
        "stable",
        "declining",
    }


def test_historical_trend_is_formed_from_weekly_snapshots(
    client: TestClient,
    db_session_factory: sessionmaker,
    seeded_data: dict[str, object],
) -> None:
    scope_ids = prepare_snapshot_scope_data(
        db_session_factory=db_session_factory,
        seeded_data=seeded_data,
    )
    login(client, email=seeded_data["manager_a"].email, password="ManagerPass123!")

    generate_response = client.post(
        "/dashboard/performance-snapshots/generate?weeks=4",
        headers=csrf_headers(client),
    )
    assert generate_response.status_code == 200, generate_response.text

    response = client.get(
        f"/dashboard/manager-insights/sales/{scope_ids['sales_allowed_id']}/history?weeks=4",
    )
    assert response.status_code == 200, response.text
    payload = response.json()
    assert payload["history_summary"]["trend_label"] == "declining"
    assert payload["history_summary"]["delta_needs_reply"] >= 1
    assert len(payload["weekly_history"]) == 4


def test_duplicate_snapshot_generation_does_not_duplicate_rows(
    client: TestClient,
    db_session_factory: sessionmaker,
    seeded_data: dict[str, object],
) -> None:
    prepare_snapshot_scope_data(
        db_session_factory=db_session_factory,
        seeded_data=seeded_data,
    )
    login(client, email=seeded_data["manager_a"].email, password="ManagerPass123!")

    first_response = client.post(
        "/dashboard/performance-snapshots/generate?weeks=4",
        headers=csrf_headers(client),
    )
    second_response = client.post(
        "/dashboard/performance-snapshots/generate?weeks=4",
        headers=csrf_headers(client),
    )
    assert first_response.status_code == 200, first_response.text
    assert second_response.status_code == 200, second_response.text

    db = db_session_factory()
    sales_rows = db.scalars(select(SalesPerformanceSnapshot)).all()
    team_rows = db.scalars(select(TeamPerformanceSnapshot)).all()
    assert len(sales_rows) == 4
    assert len(team_rows) == 4
    db.close()

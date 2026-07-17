from pathlib import Path
import sys

from fastapi.testclient import TestClient
from sqlalchemy.orm import sessionmaker

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.services.dashboard_service import _build_operational_scorecard
from tests.test_performance_snapshots import (
    csrf_headers,
    login,
    prepare_snapshot_scope_data,
)


def test_sales_scorecard_is_present_in_manager_insights(
    client: TestClient,
    db_session_factory: sessionmaker,
    seeded_data: dict[str, object],
) -> None:
    prepare_snapshot_scope_data(
        db_session_factory=db_session_factory,
        seeded_data=seeded_data,
    )
    login(client, email=seeded_data["manager_a"].email, password="ManagerPass123!")

    response = client.get("/dashboard/manager-insights?range=7d")
    assert response.status_code == 200, response.text
    payload = response.json()
    scorecard = payload["sales_performance"][0]["scorecard"]

    assert 0 <= scorecard["overall_score"] <= 100
    assert scorecard["score_label"] in {
        "excellent",
        "stable",
        "needs_attention",
        "critical",
    }
    assert "response_discipline_score" in scorecard
    assert "follow_up_discipline_score" in scorecard
    assert "hot_lead_handling_score" in scorecard
    assert "pipeline_movement_score" in scorecard
    assert "crm_hygiene_score" in scorecard


def test_team_scorecard_is_present_in_manager_insights(
    client: TestClient,
    db_session_factory: sessionmaker,
    seeded_data: dict[str, object],
) -> None:
    prepare_snapshot_scope_data(
        db_session_factory=db_session_factory,
        seeded_data=seeded_data,
    )
    login(client, email=seeded_data["manager_a"].email, password="ManagerPass123!")

    response = client.get("/dashboard/manager-insights?range=7d")
    assert response.status_code == 200, response.text
    payload = response.json()
    scorecard = payload["team_performance"][0]["scorecard"]

    assert 0 <= scorecard["overall_score"] <= 100
    assert scorecard["primary_reason"]
    assert scorecard["recommended_action"]


def test_score_label_changes_with_operational_conditions() -> None:
    critical = _build_operational_scorecard(
        active_leads_count=2,
        needs_reply_count=4,
        overdue_follow_up_count=3,
        hot_leads_count=2,
        analyzed_conversations_count=0,
        needs_analysis_count=2,
        won_deals_count=0,
        open_deals_count=2,
        crm_discipline_status="needs_attention",
        avg_response_sla_status="critical",
    )
    stable = _build_operational_scorecard(
        active_leads_count=3,
        needs_reply_count=0,
        overdue_follow_up_count=0,
        hot_leads_count=0,
        analyzed_conversations_count=3,
        needs_analysis_count=0,
        won_deals_count=1,
        open_deals_count=3,
        crm_discipline_status="disciplined",
        avg_response_sla_status="healthy",
    )

    assert critical.score_label == "critical"
    assert stable.score_label in {"stable", "excellent"}


def test_scorecard_explanation_is_present() -> None:
    scorecard = _build_operational_scorecard(
        active_leads_count=1,
        needs_reply_count=2,
        overdue_follow_up_count=1,
        hot_leads_count=1,
        analyzed_conversations_count=1,
        needs_analysis_count=0,
        won_deals_count=0,
        open_deals_count=1,
        crm_discipline_status="needs_attention",
        avg_response_sla_status="warning",
    )

    assert scorecard.primary_reason
    assert scorecard.recommended_action


def test_historical_score_delta_and_trend_are_present_in_sales_detail(
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
        f"/dashboard/manager-insights/sales/{scope_ids['sales_allowed_id']}?range=7d",
    )
    assert response.status_code == 200, response.text
    scorecard = response.json()["summary"]["scorecard"]

    assert isinstance(scorecard["score_delta_vs_previous"], int)
    assert scorecard["score_trend_label"] in {"improving", "stable", "declining"}


def test_scoped_manager_only_sees_scorecards_within_scope(
    client: TestClient,
    db_session_factory: sessionmaker,
    seeded_data: dict[str, object],
) -> None:
    scope_ids = prepare_snapshot_scope_data(
        db_session_factory=db_session_factory,
        seeded_data=seeded_data,
    )
    login(client, email=seeded_data["manager_a"].email, password="ManagerPass123!")

    response = client.get("/dashboard/manager-insights?range=7d")
    assert response.status_code == 200, response.text
    payload = response.json()
    sales_user_ids = {item["sales_user_id"] for item in payload["sales_performance"]}
    assert scope_ids["sales_allowed_id"] in sales_user_ids
    assert scope_ids["sales_denied_id"] not in sales_user_ids


def test_head_can_see_scorecards_org_wide_without_cross_org_leak(
    client: TestClient,
    db_session_factory: sessionmaker,
    seeded_data: dict[str, object],
) -> None:
    scope_ids = prepare_snapshot_scope_data(
        db_session_factory=db_session_factory,
        seeded_data=seeded_data,
    )
    login(client, email=seeded_data["admin_a"].email, password="AdminPass123!")

    response = client.get("/dashboard/manager-insights?range=7d")
    assert response.status_code == 200, response.text
    payload = response.json()
    sales_user_ids = {item["sales_user_id"] for item in payload["sales_performance"]}

    assert scope_ids["sales_allowed_id"] in sales_user_ids
    assert scope_ids["sales_denied_id"] in sales_user_ids
    assert scope_ids["other_org_sales_id"] not in sales_user_ids
    assert all("scorecard" in item for item in payload["sales_performance"])

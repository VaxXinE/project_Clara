from datetime import datetime, timedelta, timezone
from pathlib import Path
import sys

from fastapi.testclient import TestClient
from sqlalchemy.orm import sessionmaker

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.core.config import settings
from app.models.ai_extraction import AIExtraction
from app.models.lead_discipline_log import LeadDisciplineLog
from app.models.message import Message
from app.models.sales_team import SalesTeam
from app.models.sales_unit import SalesUnit


def login(client: TestClient, *, email: str, password: str) -> None:
    response = client.post("/auth/login", json={"email": email, "password": password})
    assert response.status_code == 200, response.text


def csrf_headers(client: TestClient) -> dict[str, str]:
    csrf_token = client.cookies.get(settings.csrf_cookie_name)
    assert csrf_token
    return {"X-CSRF-Token": csrf_token}


def prepare_manager_scope_data(
    *,
    db_session_factory: sessionmaker,
    seeded_data: dict[str, object],
) -> None:
    db = db_session_factory()
    org_a = seeded_data["org_a"]
    manager_b = db.get(type(seeded_data["manager_b"]), seeded_data["manager_b"].id)
    marketing_b = db.get(type(seeded_data["marketing_b"]), seeded_data["marketing_b"].id)
    owned_lead = db.get(type(seeded_data["owned_lead"]), seeded_data["owned_lead"].id)
    owned_conversation = db.get(
        type(seeded_data["owned_conversation"]),
        seeded_data["owned_conversation"].id,
    )
    assert manager_b and marketing_b and owned_lead and owned_conversation

    unit = SalesUnit(
        organization_id=org_a.id,
        name="Unit Beta",
        code="unit-beta",
    )
    db.add(unit)
    db.flush()

    team = SalesTeam(
        organization_id=org_a.id,
        unit_id=unit.id,
        manager_user_id=manager_b.id,
        name="Team Beta",
        code="team-beta",
    )
    db.add(team)
    db.flush()

    marketing_b.team_id = team.id
    owned_lead.next_follow_up_at = datetime.now(timezone.utc) - timedelta(hours=4)

    db.add(
        LeadDisciplineLog(
            lead_id=owned_lead.id,
            organization_id=owned_lead.organization_id,
            actor_user_id=marketing_b.id,
            log_date=(datetime.now(timezone.utc) - timedelta(days=2)).date(),
            activity_type="follow_up_chat",
            result_status="waiting_customer",
            notes="Log lama untuk memicu stale ratio.",
        )
    )
    db.add(
        Message(
            conversation_id=owned_conversation.id,
            sender_name="Owned Customer",
            sender_type="customer",
            message_text="Legalitasnya gimana ya, saya masih belum yakin.",
            message_timestamp=datetime.now(timezone.utc) - timedelta(hours=2),
        )
    )
    db.add(
        AIExtraction(
            conversation_id=owned_conversation.id,
            model_name="test-model",
            schema_version="v1",
            lead_temperature="hot",
            pipeline_stage="objection",
            buying_intent="medium",
            sentiment="cautious",
            risk_level="high",
            main_objections=["legalitas", "trust"],
            budget_signal={"detected": False, "amount_text": None, "notes": "n/a"},
            recommended_reply_strategy={
                "tone": "professional",
                "key_points": ["jawab legalitas"],
                "avoid_topics": [],
            },
            customer_summary="Customer tertarik tapi ragu legalitas.",
            next_best_action="Jelaskan legalitas resmi dan lanjutkan follow-up.",
            content_insight="Butuh jawaban legalitas yang konsisten.",
            internal_notes="Manager perlu review.",
            confidence_score=0.91,
        )
    )
    db.commit()
    db.close()


def create_review_case_and_proposal(
    client: TestClient,
    *,
    conversation_id: str,
) -> None:
    review_response = client.put(
        f"/dashboard/sales/conversations/{conversation_id}/review-case",
        json={
            "reviewer_user_id": None,
            "status": "in_review",
            "review_label": "perlu_eskalasi",
            "review_summary": "Butuh pola jawaban legalitas yang lebih rapi.",
            "coaching_focus": "Ketepatan membaca objection legalitas.",
            "recommended_action": "Naikkan insight ini jadi knowledge proposal.",
        },
        headers=csrf_headers(client),
    )
    assert review_response.status_code == 200, review_response.text

    proposal_response = client.put(
        f"/product-knowledge/conversations/{conversation_id}/proposal",
        json={
          "title": "Playbook objection legalitas",
          "category": "legalitas",
          "proposed_content": "Sales harus merujuk ke dokumen resmi saat objection legalitas muncul.",
          "source_type": "coaching_case",
          "rationale": "Hambatan ini berulang di team.",
          "status": "pending_approval",
        },
        headers=csrf_headers(client),
    )
    assert proposal_response.status_code == 200, proposal_response.text


def test_manager_insights_scoped_manager_sees_team_metrics(
    client: TestClient,
    db_session_factory: sessionmaker,
    seeded_data: dict[str, object],
) -> None:
    prepare_manager_scope_data(
        db_session_factory=db_session_factory,
        seeded_data=seeded_data,
    )

    manager_b = seeded_data["manager_b"]
    owned_conversation = seeded_data["owned_conversation"]

    login(client, email=manager_b.email, password="ManagerPass123!")
    create_review_case_and_proposal(
        client,
        conversation_id=str(owned_conversation.id),
    )

    response = client.get("/dashboard/manager-insights")
    assert response.status_code == 200, response.text
    payload = response.json()
    assert payload["scope_team_count"] == 1
    assert payload["total_leads"] == 1
    assert payload["missing_or_stale_log_count"] == 1
    assert payload["overdue_follow_up_count"] == 1
    assert payload["open_coaching_case_count"] == 1
    assert payload["pending_knowledge_proposal_count"] == 1
    assert payload["team_discipline"][0]["team_name"] == "Team Beta"
    assert payload["coaching_priority"][0]["conversation_id"] == str(
        owned_conversation.id
    )
    objection_labels = {item["objection"] for item in payload["objection_trends"]}
    assert "legalitas" in objection_labels


def test_head_can_access_manager_insights_org_wide(
    client: TestClient,
    db_session_factory: sessionmaker,
    seeded_data: dict[str, object],
) -> None:
    prepare_manager_scope_data(
        db_session_factory=db_session_factory,
        seeded_data=seeded_data,
    )
    admin_b = seeded_data["admin_b"]

    login(client, email=admin_b.email, password="AdminPass123!")

    response = client.get("/dashboard/manager-insights")
    assert response.status_code == 200, response.text
    payload = response.json()
    assert payload["scope_label"] == "Organization-wide manager view"
    assert payload["scope_team_count"] >= 1

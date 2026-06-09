from datetime import datetime, timedelta, timezone
from pathlib import Path
import sys

from fastapi.testclient import TestClient
from sqlalchemy.orm import sessionmaker

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.core.config import settings
from app.models.ai_extraction import AIExtraction
from app.models.conversation import Conversation
from app.models.lead import Lead
from app.models.lead_task import LeadTask
from app.models.message import Message
from app.models.reply_suggestion import ReplySuggestion
from app.models.sales_team import SalesTeam
from app.models.sales_unit import SalesUnit


def login(client: TestClient, *, email: str, password: str) -> None:
    response = client.post("/auth/login", json={"email": email, "password": password})
    assert response.status_code == 200, response.text


def csrf_headers(client: TestClient) -> dict[str, str]:
    csrf_token = client.cookies.get(settings.csrf_cookie_name)
    assert csrf_token
    return {"X-CSRF-Token": csrf_token}


def seed_team_scope(
    db_session_factory: sessionmaker,
    seeded_data: dict[str, object],
) -> dict[str, object]:
    db = db_session_factory()
    org_a = seeded_data["org_a"]
    manager_a = db.get(type(seeded_data["manager_a"]), seeded_data["manager_a"].id)
    manager_b = db.get(type(seeded_data["manager_b"]), seeded_data["manager_b"].id)
    marketing_a = db.get(type(seeded_data["marketing_a"]), seeded_data["marketing_a"].id)
    marketing_b = db.get(type(seeded_data["marketing_b"]), seeded_data["marketing_b"].id)
    owned_conversation = db.get(
        type(seeded_data["owned_conversation"]),
        seeded_data["owned_conversation"].id,
    )
    owned_lead = db.get(type(seeded_data["owned_lead"]), seeded_data["owned_lead"].id)

    assert all(
        item is not None
        for item in [manager_a, manager_b, marketing_a, marketing_b, owned_conversation, owned_lead]
    )

    unit_alpha = SalesUnit(
        organization_id=org_a.id,
        name="Unit Alpha",
        code="unit-alpha",
    )
    unit_beta = SalesUnit(
        organization_id=org_a.id,
        name="Unit Beta",
        code="unit-beta",
    )
    db.add_all([unit_alpha, unit_beta])
    db.flush()

    team_red = SalesTeam(
        organization_id=org_a.id,
        unit_id=unit_alpha.id,
        manager_user_id=manager_a.id,
        name="Team Red",
        code="team-red",
    )
    team_blue = SalesTeam(
        organization_id=org_a.id,
        unit_id=unit_beta.id,
        manager_user_id=manager_b.id,
        name="Team Blue",
        code="team-blue",
    )
    db.add_all([team_red, team_blue])
    db.flush()

    manager_a.team_id = team_red.id
    marketing_b.team_id = team_red.id
    manager_b.team_id = team_blue.id
    marketing_a.team_id = team_blue.id

    other_conversation = Conversation(
        organization_id=org_a.id,
        sales_user_id=marketing_a.id,
        title="Scoped Away Conversation",
        source="whatsapp_txt",
        status="uploaded",
        current_stage="objection",
        lead_temperature="warm",
        last_message_at=datetime.now(timezone.utc) - timedelta(hours=1),
    )
    db.add(other_conversation)
    db.flush()
    db.add(
        Message(
            conversation_id=other_conversation.id,
            sender_name="Scoped Away Customer",
            sender_type="customer",
            message_text="Tolong follow up saya.",
            message_timestamp=other_conversation.last_message_at,
        )
    )

    other_lead = Lead(
        organization_id=org_a.id,
        assigned_user_id=marketing_a.id,
        display_name="Scoped Away Lead",
        source="whatsapp_txt",
        current_stage="objection",
        lead_temperature="warm",
        last_contact_at=other_conversation.last_message_at,
        next_follow_up_at=datetime.now(timezone.utc) - timedelta(hours=2),
    )
    db.add(other_lead)
    db.flush()
    other_conversation.lead_id = other_lead.id

    owned_lead.next_follow_up_at = datetime.now(timezone.utc) - timedelta(hours=3)
    owned_lead.last_contact_at = datetime.now(timezone.utc) - timedelta(hours=4)
    owned_conversation.last_message_at = datetime.now(timezone.utc) - timedelta(hours=4)
    db.add(
        Message(
            conversation_id=owned_conversation.id,
            sender_name="Owned Customer",
            sender_type="customer",
            message_text="Follow up lagi ya.",
            message_timestamp=owned_conversation.last_message_at,
        )
    )

    db.add_all(
        [
            LeadTask(
                lead_id=owned_lead.id,
                organization_id=owned_lead.organization_id,
                assigned_user_id=marketing_b.id,
                task_type="manual_follow_up",
                status="open",
                title="Owned follow up",
                due_at=datetime.now(timezone.utc) - timedelta(hours=26),
            ),
            LeadTask(
                lead_id=other_lead.id,
                organization_id=other_lead.organization_id,
                assigned_user_id=marketing_a.id,
                task_type="manual_follow_up",
                status="open",
                title="Hidden follow up",
                due_at=datetime.now(timezone.utc) - timedelta(hours=26),
            ),
        ]
    )

    owned_extraction = AIExtraction(
        conversation_id=owned_conversation.id,
        model_name="test-model",
        schema_version="v1",
        lead_temperature="warm",
        pipeline_stage="objection",
        buying_intent="medium",
        sentiment="cautious",
        risk_level="high",
        main_objections=["legalitas"],
        budget_signal={"detected": False, "amount_text": None, "notes": "n/a"},
        recommended_reply_strategy={"tone": "professional", "key_points": [], "avoid_topics": []},
        customer_summary="Butuh review.",
        next_best_action="Review cepat.",
        content_insight="n/a",
        internal_notes="n/a",
        confidence_score=0.9,
    )
    other_extraction = AIExtraction(
        conversation_id=other_conversation.id,
        model_name="test-model",
        schema_version="v1",
        lead_temperature="warm",
        pipeline_stage="objection",
        buying_intent="medium",
        sentiment="cautious",
        risk_level="high",
        main_objections=["harga"],
        budget_signal={"detected": False, "amount_text": None, "notes": "n/a"},
        recommended_reply_strategy={"tone": "professional", "key_points": [], "avoid_topics": []},
        customer_summary="Butuh review lain.",
        next_best_action="Review lain.",
        content_insight="n/a",
        internal_notes="n/a",
        confidence_score=0.88,
    )
    db.add_all([owned_extraction, other_extraction])
    db.flush()

    db.add_all(
        [
            ReplySuggestion(
                conversation_id=owned_conversation.id,
                ai_extraction_id=owned_extraction.id,
                model_name="test-model",
                action_mode="escalate_to_human",
                approval_status="pending",
                risk_level="high",
                suggested_replies=[{"text": "Owned reply"}],
                policy_reasons=["human_review"],
            ),
            ReplySuggestion(
                conversation_id=other_conversation.id,
                ai_extraction_id=other_extraction.id,
                model_name="test-model",
                action_mode="escalate_to_human",
                approval_status="pending",
                risk_level="high",
                suggested_replies=[{"text": "Hidden reply"}],
                policy_reasons=["human_review"],
            ),
        ]
    )

    db.commit()
    db.close()

    return {
        "owned_conversation_id": str(owned_conversation.id),
        "owned_lead_id": str(owned_lead.id),
        "other_conversation_id": str(other_conversation.id),
        "other_lead_id": str(other_lead.id),
    }


def test_manager_hierarchy_scope_limits_conversation_access(
    client: TestClient,
    db_session_factory: sessionmaker,
    seeded_data: dict[str, object],
) -> None:
    ids = seed_team_scope(db_session_factory, seeded_data)
    manager_a = seeded_data["manager_a"]

    login(client, email=manager_a.email, password="ManagerPass123!")

    list_response = client.get("/conversations")
    assert list_response.status_code == 200, list_response.text
    payload = list_response.json()
    returned_ids = {item["id"] for item in payload}
    assert ids["owned_conversation_id"] in returned_ids
    assert ids["other_conversation_id"] not in returned_ids

    allowed_detail = client.get(f"/conversations/{ids['owned_conversation_id']}")
    assert allowed_detail.status_code == 200, allowed_detail.text

    denied_detail = client.get(f"/conversations/{ids['other_conversation_id']}")
    assert denied_detail.status_code == 404, denied_detail.text


def test_manager_hierarchy_scope_limits_crm_and_worklist(
    client: TestClient,
    db_session_factory: sessionmaker,
    seeded_data: dict[str, object],
) -> None:
    ids = seed_team_scope(db_session_factory, seeded_data)
    manager_a = seeded_data["manager_a"]

    login(client, email=manager_a.email, password="ManagerPass123!")

    leads_response = client.get("/leads")
    assert leads_response.status_code == 200, leads_response.text
    leads_payload = leads_response.json()
    returned_lead_ids = {item["id"] for item in leads_payload}
    assert ids["owned_lead_id"] in returned_lead_ids
    assert ids["other_lead_id"] not in returned_lead_ids

    worklist_response = client.get("/dashboard/sales/worklist")
    assert worklist_response.status_code == 200, worklist_response.text
    worklist_payload = worklist_response.json()
    worklist_lead_ids = {item["lead_id"] for item in worklist_payload["items"]}
    assert ids["owned_lead_id"] in worklist_lead_ids
    assert ids["other_lead_id"] not in worklist_lead_ids


def test_manager_hierarchy_scope_limits_approval_queue(
    client: TestClient,
    db_session_factory: sessionmaker,
    seeded_data: dict[str, object],
) -> None:
    ids = seed_team_scope(db_session_factory, seeded_data)
    manager_a = seeded_data["manager_a"]

    login(client, email=manager_a.email, password="ManagerPass123!")

    response = client.get("/dashboard/sales/approval-queue")
    assert response.status_code == 200, response.text
    payload = response.json()
    returned_conversation_ids = {item["conversation_id"] for item in payload["items"]}
    assert ids["owned_conversation_id"] in returned_conversation_ids
    assert ids["other_conversation_id"] not in returned_conversation_ids

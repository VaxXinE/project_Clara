from datetime import datetime, timedelta, timezone
from pathlib import Path
import sys

from fastapi.testclient import TestClient
from sqlalchemy.orm import sessionmaker

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.core.config import settings
from app.models.ai_extraction import AIExtraction
from app.models.conversation import Conversation
from app.models.kpi_alert_record import KpiAlertRecord
from app.models.kpi_command_snapshot import KpiCommandSnapshot
from app.models.lead import Lead
from app.models.lead_deal import LeadDeal
from app.models.organization import Organization
from app.models.reply_suggestion import ReplySuggestion
from app.models.sent_message import SentMessage


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


def seed_kpi_data(
    db_session_factory: sessionmaker,
    seeded_data: dict[str, object],
) -> None:
    db = db_session_factory()

    owned_conversation = seeded_data["owned_conversation"]
    owned_lead = seeded_data["owned_lead"]
    marketing_other_org = seeded_data["marketing_other_org"]
    org_b = seeded_data["org_b"]

    conversation_a = db.get(type(owned_conversation), owned_conversation.id)
    lead_a = db.get(type(owned_lead), owned_lead.id)
    org_b_record = db.get(Organization, org_b.id)
    assert conversation_a is not None
    assert lead_a is not None
    assert org_b_record is not None

    lead_a.lead_temperature = "hot"
    lead_a.current_stage = "closing"
    lead_a.next_follow_up_at = datetime.now(timezone.utc) - timedelta(hours=2)
    db.add(
        LeadDeal(
            lead_id=lead_a.id,
            organization_id=lead_a.organization_id,
            owner_user_id=lead_a.assigned_user_id,
            status="won",
            currency="IDR",
            expected_value=5_000_000,
            deposit_amount=1_500_000,
        )
    )
    db.add(
        AIExtraction(
            conversation_id=conversation_a.id,
            model_name="test-model",
            schema_version="v1",
            lead_temperature="hot",
            pipeline_stage="closing",
            buying_intent="high",
            sentiment="positive",
            risk_level="medium",
            main_objections=["legalitas"],
            budget_signal={
                "detected": True,
                "amount_text": "budget siap",
                "notes": "mau lanjut cepat",
            },
            recommended_reply_strategy={
                "tone": "professional",
                "key_points": ["close cepat"],
                "avoid_topics": ["janji hasil"],
            },
            customer_summary="Lead siap closing.",
            next_best_action="Dorong ke langkah akhir closing.",
            content_insight="Legalitas masih relevan.",
            internal_notes="n/a",
            confidence_score=0.93,
        )
    )
    db.flush()
    extraction_a = (
        db.query(AIExtraction)
        .filter(AIExtraction.conversation_id == conversation_a.id)
        .order_by(AIExtraction.created_at.desc())
        .first()
    )
    assert extraction_a is not None
    suggestion_a = ReplySuggestion(
        conversation_id=conversation_a.id,
        ai_extraction_id=extraction_a.id,
        model_name="test-model",
        action_mode="reply_direct",
        approval_status="approved",
        risk_level="medium",
        suggested_replies=[
            {
                "tone": "professional",
                "text": "Kami siap bantu langkah akhir closing.",
                "reasoning": "Lead sudah siap lanjut.",
            }
        ],
        policy_reasons=["safe_to_reply"],
    )
    db.add(suggestion_a)
    db.flush()
    db.add(
        SentMessage(
            conversation_id=conversation_a.id,
            reply_suggestion_id=suggestion_a.id,
            send_mode="manual",
            message_text="Kami siap bantu langkah akhir closing.",
            sent_by_name="Marketing Beta",
            sent_at=datetime.now(timezone.utc) - timedelta(hours=1),
        )
    )

    lead_b = Lead(
        organization_id=org_b_record.id,
        assigned_user_id=marketing_other_org.id,
        display_name="Gamma Prospect",
        source="whatsapp_extension",
        current_stage="negotiation",
        lead_temperature="warm",
        last_contact_at=datetime.now(timezone.utc) - timedelta(hours=3),
    )
    db.add(lead_b)
    db.flush()
    db.add(
        LeadDeal(
            lead_id=lead_b.id,
            organization_id=lead_b.organization_id,
            owner_user_id=lead_b.assigned_user_id,
            status="open",
            currency="IDR",
            expected_value=3_500_000,
            deposit_amount=0,
        )
    )

    conversation_b = Conversation(
        organization_id=org_b_record.id,
        sales_user_id=marketing_other_org.id,
        lead_id=lead_b.id,
        title="Gamma Conversation",
        source="whatsapp_extension",
        status="replied",
        current_stage="negotiation",
        lead_temperature="warm",
        last_message_at=datetime.now(timezone.utc) - timedelta(hours=3),
    )
    db.add(conversation_b)
    db.flush()
    db.add(
        AIExtraction(
            conversation_id=conversation_b.id,
            model_name="test-model",
            schema_version="v1",
            lead_temperature="warm",
            pipeline_stage="negotiation",
            buying_intent="medium",
            sentiment="cautious",
            risk_level="high",
            main_objections=["keamanan dana"],
            budget_signal={
                "detected": False,
                "amount_text": None,
                "notes": "masih wait and see",
            },
            recommended_reply_strategy={
                "tone": "empathetic",
                "key_points": ["bangun trust"],
                "avoid_topics": ["hard sell"],
            },
            customer_summary="Lead hangat tapi masih menimbang.",
            next_best_action="Kirim bukti trust dan jadwalkan follow up.",
            content_insight="Trust masih jadi blocker.",
            internal_notes="n/a",
            confidence_score=0.88,
        )
    )
    db.commit()
    db.close()


def test_owner_kpi_command_center_returns_global_view(
    client: TestClient,
    db_session_factory: sessionmaker,
    seeded_data: dict[str, object],
) -> None:
    seed_kpi_data(db_session_factory, seeded_data)
    owner = seeded_data["owner"]

    login(client, email=owner.email, password="OwnerPass123!")

    response = client.get("/dashboard/kpi/command-center")
    assert response.status_code == 200, response.text
    payload = response.json()

    assert payload["scope_type"] == "global"
    assert payload["summary"]["total_organizations"] == 2
    assert payload["summary"]["total_sales_users"] == 3
    assert payload["summary"]["total_leads"] >= 2
    assert payload["summary"]["won_value"] == 5000000
    assert payload["summary"]["deposit_amount"] == 1500000
    assert payload["summary"]["pipeline_value"] == 3500000
    assert payload["summary"]["win_rate"] == 1.0
    assert len(payload["alerts"]) >= 1
    assert len(payload["recommendations"]) >= 1
    assert len(payload["organization_performance"]) == 2
    assert payload["sales_performance"][0]["user_name"] == "Marketing Beta"


def test_admin_kpi_command_center_is_scoped_to_own_organization(
    client: TestClient,
    db_session_factory: sessionmaker,
    seeded_data: dict[str, object],
) -> None:
    seed_kpi_data(db_session_factory, seeded_data)
    admin_a = seeded_data["admin_a"]

    login(client, email=admin_a.email, password="AdminPass123!")

    response = client.get("/dashboard/kpi/command-center")
    assert response.status_code == 200, response.text
    payload = response.json()

    assert payload["scope_type"] == "organization"
    assert payload["summary"]["total_organizations"] == 1
    assert payload["summary"]["won_value"] == 5000000
    assert payload["summary"]["deposit_amount"] == 1500000
    assert len(payload["alerts"]) >= 1
    assert len(payload["recommendations"]) >= 1
    assert len(payload["organization_performance"]) == 1
    assert payload["organization_performance"][0]["organization_name"] == "Org Alpha"
    assert all(
        row["organization_name"] == "Org Alpha"
        for row in payload["sales_performance"]
    )


def test_refresh_kpi_command_center_persists_snapshot_and_alerts(
    client: TestClient,
    db_session_factory: sessionmaker,
    seeded_data: dict[str, object],
) -> None:
    seed_kpi_data(db_session_factory, seeded_data)
    admin_a = seeded_data["admin_a"]

    login(client, email=admin_a.email, password="AdminPass123!")

    response = client.post(
        "/dashboard/kpi/command-center/refresh",
        headers=csrf_headers(client),
    )
    assert response.status_code == 200, response.text
    payload = response.json()
    assert "persisted_alerts" in payload

    db = db_session_factory()
    snapshots = db.query(KpiCommandSnapshot).all()
    alerts = db.query(KpiAlertRecord).all()
    assert len(snapshots) == 1
    assert len(alerts) >= 1


def test_acknowledge_persisted_kpi_alert_updates_status(
    client: TestClient,
    db_session_factory: sessionmaker,
    seeded_data: dict[str, object],
) -> None:
    seed_kpi_data(db_session_factory, seeded_data)
    admin_a = seeded_data["admin_a"]

    login(client, email=admin_a.email, password="AdminPass123!")
    refresh_response = client.post(
        "/dashboard/kpi/command-center/refresh",
        headers=csrf_headers(client),
    )
    assert refresh_response.status_code == 200, refresh_response.text

    alerts_response = client.get("/dashboard/kpi/alerts")
    assert alerts_response.status_code == 200, alerts_response.text
    alert_id = alerts_response.json()["items"][0]["id"]

    ack_response = client.patch(
        f"/dashboard/kpi/alerts/{alert_id}/acknowledge",
        headers=csrf_headers(client),
    )
    assert ack_response.status_code == 200, ack_response.text
    assert ack_response.json()["status"] == "acknowledged"

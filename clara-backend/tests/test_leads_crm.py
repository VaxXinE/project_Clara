from datetime import datetime, timedelta, timezone
from pathlib import Path
import sys
from uuid import UUID

from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import sessionmaker

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.core.config import settings
from app.models.conversation import Conversation
from app.models.lead import Lead
from app.models.lead_task import LeadTask
from app.schemas.ai_extraction_schema import AIExtractionCreate


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


def test_extension_snapshot_auto_creates_linked_lead(
    client: TestClient,
    db_session_factory: sessionmaker,
    seeded_data: dict[str, object],
) -> None:
    marketing_a = seeded_data["marketing_a"]
    login(client, email=marketing_a.email, password="MarketingPass123!")

    response = client.post(
        "/extension/whatsapp/snapshots",
        json={
            "chatData": {
                "capturedAt": "2026-05-12T09:00:00.000Z",
                "chatTitle": "Leoni Customer",
                "chatSubtitle": "online",
                "messages": [
                    {
                        "id": "09.00-0",
                        "author": "Leoni",
                        "direction": "incoming",
                        "text": "Halo kak, ini legal tidak?",
                        "timestampLabel": "09.00",
                    }
                ],
            }
        },
        headers=csrf_headers(client),
    )
    assert response.status_code == 201, response.text

    db = db_session_factory()
    conversation = db.get(Conversation, UUID(response.json()["conversation_id"]))
    assert conversation is not None
    assert conversation.lead_id is not None

    lead = db.get(Lead, conversation.lead_id)
    assert lead is not None
    assert lead.display_name == "Leoni"
    assert lead.assigned_user_id == marketing_a.id


def test_superadmin_can_list_cross_org_leads(
    client: TestClient,
    db_session_factory: sessionmaker,
    seeded_data: dict[str, object],
) -> None:
    owner = seeded_data["owner"]
    marketing_other_org = seeded_data["marketing_other_org"]
    org_b = seeded_data["org_b"]

    db = db_session_factory()
    db.add(
        Lead(
            organization_id=org_b.id,
            assigned_user_id=marketing_other_org.id,
            display_name="Cross Org Lead",
            source="manual_test",
            current_stage="qualification",
            lead_temperature="warm",
        )
    )
    db.commit()

    login(client, email=owner.email, password="OwnerPass123!")

    response = client.get("/leads")
    assert response.status_code == 200, response.text
    payload = response.json()

    assert any(item["display_name"] == "Owned Customer" for item in payload)
    assert any(item["display_name"] == "Cross Org Lead" for item in payload)


def test_analyze_conversation_updates_linked_lead(
    client: TestClient,
    db_session_factory: sessionmaker,
    seeded_data: dict[str, object],
    monkeypatch,
) -> None:
    marketing_a = seeded_data["marketing_a"]
    login(client, email=marketing_a.email, password="MarketingPass123!")

    sync_response = client.post(
        "/extension/whatsapp/snapshots",
        json={
            "chatData": {
                "capturedAt": "2026-05-12T09:00:00.000Z",
                "chatTitle": "Leoni Customer",
                "chatSubtitle": "online",
                "messages": [
                    {
                        "id": "09.00-0",
                        "author": "Leoni",
                        "direction": "incoming",
                        "text": "Saya masih ragu, tapi tertarik coba.",
                        "timestampLabel": "09.00",
                    }
                ],
            }
        },
        headers=csrf_headers(client),
    )
    assert sync_response.status_code == 201, sync_response.text
    conversation_id = sync_response.json()["conversation_id"]

    monkeypatch.setattr(
        "app.services.ai_extraction_service.call_openai_for_extraction",
        lambda _conversation_text: AIExtractionCreate(
            lead_temperature="warm",
            pipeline_stage="negotiation",
            buying_intent="medium",
            sentiment="cautious",
            risk_level="medium",
            main_objections=["legalitas"],
            budget_signal={
                "detected": False,
                "amount_text": None,
                "notes": "Belum ada budget.",
            },
            recommended_reply_strategy={
                "tone": "professional",
                "key_points": ["jawab legalitas"],
                "avoid_topics": ["janji hasil"],
            },
            customer_summary="Lead tertarik tapi masih butuh penguatan trust.",
            next_best_action="Kirim bukti legalitas dan ajak follow up.",
            content_insight="Trust masih isu utama.",
            internal_notes="Perlu materi bukti sosial.",
            confidence_score=0.87,
        ),
    )

    analyze_response = client.post(
        f"/conversations/{conversation_id}/analyze",
        headers=csrf_headers(client),
    )
    assert analyze_response.status_code == 200, analyze_response.text

    db = db_session_factory()
    conversation = db.get(Conversation, UUID(conversation_id))
    assert conversation is not None
    assert conversation.lead_id is not None

    lead = db.get(Lead, conversation.lead_id)
    assert lead is not None
    assert lead.current_stage == "negotiation"
    assert lead.lead_temperature == "warm"
    assert lead.summary == "Lead tertarik tapi masih butuh penguatan trust."


def test_leads_list_is_scoped_by_assignment_for_marketing(
    client: TestClient,
    seeded_data: dict[str, object],
) -> None:
    marketing_a = seeded_data["marketing_a"]
    login(client, email=marketing_a.email, password="MarketingPass123!")

    response = client.get("/leads")
    assert response.status_code == 200, response.text
    payload = response.json()
    assert payload == []


def test_admin_can_list_and_update_org_leads(
    client: TestClient,
    db_session_factory: sessionmaker,
    seeded_data: dict[str, object],
) -> None:
    admin_a = seeded_data["admin_a"]
    owned_lead = seeded_data["owned_lead"]
    owned_conversation = seeded_data["owned_conversation"]
    login(client, email=admin_a.email, password="AdminPass123!")

    list_response = client.get("/leads")
    assert list_response.status_code == 200, list_response.text
    payload = list_response.json()
    assert len(payload) == 1
    assert payload[0]["id"] == str(owned_lead.id)
    assert payload[0]["source_channel"] == "whatsapp"
    assert payload[0]["source_label"] == "WhatsApp TXT Import"

    patch_response = client.patch(
        f"/leads/{owned_lead.id}",
        json={
            "current_stage": "closing",
            "lead_temperature": "hot",
            "summary": "Sudah sangat dekat ke closing.",
        },
        headers=csrf_headers(client),
    )
    assert patch_response.status_code == 200, patch_response.text
    assert patch_response.json()["current_stage"] == "closing"
    assert patch_response.json()["lead_temperature"] == "hot"

    db = db_session_factory()
    conversation = db.get(Conversation, owned_conversation.id)
    assert conversation is not None
    assert conversation.current_stage == "closing"
    assert conversation.lead_temperature == "hot"

    lead = db.scalars(select(Lead).where(Lead.id == owned_lead.id)).first()
    assert lead is not None
    assert lead.summary == "Sudah sangat dekat ke closing."


def test_admin_can_filter_leads_by_source_channel(
    client: TestClient,
    db_session_factory: sessionmaker,
    seeded_data: dict[str, object],
) -> None:
    admin_a = seeded_data["admin_a"]
    marketing_a = seeded_data["marketing_a"]
    org_a = seeded_data["org_a"]

    db = db_session_factory()
    telegram_lead = Lead(
        organization_id=org_a.id,
        assigned_user_id=marketing_a.id,
        display_name="Telegram Prospect",
        source="telegram_txt",
        current_stage="qualification",
        lead_temperature="warm",
        last_contact_at=datetime.now(timezone.utc),
    )
    db.add(telegram_lead)
    db.commit()
    db.close()

    login(client, email=admin_a.email, password="AdminPass123!")

    whatsapp_response = client.get("/leads?source_channel=whatsapp")
    assert whatsapp_response.status_code == 200, whatsapp_response.text
    whatsapp_payload = whatsapp_response.json()
    assert len(whatsapp_payload) == 1
    assert whatsapp_payload[0]["source_channel"] == "whatsapp"

    telegram_response = client.get("/leads?source_channel=telegram")
    assert telegram_response.status_code == 200, telegram_response.text
    telegram_payload = telegram_response.json()
    assert len(telegram_payload) == 1
    assert telegram_payload[0]["display_name"] == "Telegram Prospect"
    assert telegram_payload[0]["source_label"] == "Telegram TXT Import"


def test_auto_archived_conversation_is_hidden_from_active_lists(
    client: TestClient,
    db_session_factory: sessionmaker,
    seeded_data: dict[str, object],
) -> None:
    admin_a = seeded_data["admin_a"]
    owned_conversation = seeded_data["owned_conversation"]
    login(client, email=admin_a.email, password="AdminPass123!")

    db = db_session_factory()
    conversation = db.get(Conversation, owned_conversation.id)
    assert conversation is not None
    conversation.last_message_at = datetime.now(timezone.utc) - timedelta(days=10)
    db.add(conversation)
    db.commit()
    db.close()

    conversations_response = client.get("/conversations")
    assert conversations_response.status_code == 200, conversations_response.text
    assert all(
        item["id"] != str(owned_conversation.id)
        for item in conversations_response.json()
    )

    inbox_response = client.get("/dashboard/sales/inbox")
    assert inbox_response.status_code == 200, inbox_response.text
    assert all(
        item["conversation_id"] != str(owned_conversation.id)
        for item in inbox_response.json()
    )

    archived_inbox_response = client.get(
        "/dashboard/sales/inbox?archive_scope=archived"
    )
    assert archived_inbox_response.status_code == 200, archived_inbox_response.text
    archived_payload = archived_inbox_response.json()
    assert any(
        item["conversation_id"] == str(owned_conversation.id)
        and item["is_archived"] is True
        for item in archived_payload
    )


def test_updating_lead_to_won_clears_follow_up_and_cancels_open_task(
    client: TestClient,
    db_session_factory: sessionmaker,
    seeded_data: dict[str, object],
) -> None:
    admin_a = seeded_data["admin_a"]
    owned_lead = seeded_data["owned_lead"]
    login(client, email=admin_a.email, password="AdminPass123!")

    db = db_session_factory()
    lead = db.get(Lead, owned_lead.id)
    assert lead is not None
    lead.next_follow_up_at = datetime(2026, 5, 26, 10, 0, tzinfo=timezone.utc)
    db.add(lead)
    db.flush()
    task = LeadTask(
        lead_id=lead.id,
        organization_id=lead.organization_id,
        assigned_user_id=lead.assigned_user_id,
        task_type="scheduled_follow_up",
        status="open",
        title="Follow up lead",
        due_at=lead.next_follow_up_at,
    )
    db.add(task)
    db.commit()
    db.close()

    patch_response = client.patch(
        f"/leads/{owned_lead.id}",
        json={"current_stage": "won"},
        headers=csrf_headers(client),
    )
    assert patch_response.status_code == 200, patch_response.text

    db = db_session_factory()
    refreshed_lead = db.get(Lead, owned_lead.id)
    assert refreshed_lead is not None
    assert refreshed_lead.current_stage == "won"
    assert refreshed_lead.next_follow_up_at is None

    refreshed_task = db.get(LeadTask, task.id)
    assert refreshed_task is not None
    assert refreshed_task.status == "cancelled"


def test_admin_can_reassign_lead_and_auto_create_follow_up_task(
    client: TestClient,
    db_session_factory: sessionmaker,
    seeded_data: dict[str, object],
) -> None:
    admin_a = seeded_data["admin_a"]
    marketing_a = seeded_data["marketing_a"]
    owned_lead = seeded_data["owned_lead"]
    owned_conversation = seeded_data["owned_conversation"]

    login(client, email=admin_a.email, password="AdminPass123!")

    patch_response = client.patch(
        f"/leads/{owned_lead.id}",
        json={
            "assigned_user_id": str(marketing_a.id),
            "next_follow_up_at": "2026-05-20T10:30:00Z",
        },
        headers=csrf_headers(client),
    )
    assert patch_response.status_code == 200, patch_response.text
    payload = patch_response.json()
    assert payload["assigned_user_id"] == str(marketing_a.id)
    assert payload["tasks"][0]["task_type"] == "scheduled_follow_up"

    db = db_session_factory()
    lead = db.get(Lead, owned_lead.id)
    conversation = db.get(Conversation, owned_conversation.id)
    task = db.scalars(select(LeadTask).where(LeadTask.lead_id == owned_lead.id)).first()

    assert lead is not None
    assert conversation is not None
    assert task is not None
    assert lead.assigned_user_id == marketing_a.id
    assert conversation.sales_user_id == marketing_a.id
    assert task.assigned_user_id == marketing_a.id
    assert task.status == "open"


def test_marketing_can_upsert_lead_deal_metrics(
    client: TestClient,
    db_session_factory: sessionmaker,
    seeded_data: dict[str, object],
) -> None:
    marketing_b = seeded_data["marketing_b"]
    owned_lead = seeded_data["owned_lead"]

    login(client, email=marketing_b.email, password="MarketingPass123!")

    response = client.put(
        f"/leads/{owned_lead.id}/deal",
        json={
            "status": "won",
            "currency": "idr",
            "expected_value": 2500000,
            "deposit_amount": 750000,
            "expected_close_date": "2026-05-25",
            "notes": "Lead sudah masuk deal dan tinggal onboarding.",
        },
        headers=csrf_headers(client),
    )
    assert response.status_code == 200, response.text
    payload = response.json()
    assert payload["status"] == "won"
    assert payload["currency"] == "IDR"
    assert payload["expected_value"] == 2500000
    assert payload["deposit_amount"] == 750000

    detail_response = client.get(f"/leads/{owned_lead.id}")
    assert detail_response.status_code == 200, detail_response.text
    assert detail_response.json()["deal"]["status"] == "won"


def test_task_status_update_creates_persisted_task_events(
    client: TestClient,
    seeded_data: dict[str, object],
) -> None:
    marketing_b = seeded_data["marketing_b"]
    owned_lead = seeded_data["owned_lead"]

    login(client, email=marketing_b.email, password="MarketingPass123!")

    create_response = client.post(
        f"/leads/{owned_lead.id}/tasks",
        json={
            "title": "Follow up legalitas",
            "description": "Hubungi lagi besok pagi.",
            "due_at": "2026-05-20T09:00:00Z",
        },
        headers=csrf_headers(client),
    )
    assert create_response.status_code == 201, create_response.text
    task_id = create_response.json()["id"]

    update_response = client.patch(
        f"/leads/{owned_lead.id}/tasks/{task_id}",
        json={
            "status": "snoozed",
            "due_at": "2026-05-21T09:00:00Z",
            "notes": "Customer minta follow up besok.",
        },
        headers=csrf_headers(client),
    )
    assert update_response.status_code == 200, update_response.text
    assert update_response.json()["status"] == "snoozed"

    events_response = client.get(f"/leads/{owned_lead.id}/tasks/{task_id}/events")
    assert events_response.status_code == 200, events_response.text
    events = events_response.json()
    assert len(events) >= 2
    assert events[0]["event_type"] in {"status_changed", "rescheduled"}
    assert any(event["event_type"] == "created" for event in events)


def test_lead_detail_exposes_activity_timeline(
    client: TestClient,
    seeded_data: dict[str, object],
) -> None:
    admin_a = seeded_data["admin_a"]
    owned_lead = seeded_data["owned_lead"]

    login(client, email=admin_a.email, password="AdminPass123!")

    update_response = client.patch(
        f"/leads/{owned_lead.id}",
        json={
            "current_stage": "closing",
            "next_follow_up_at": "2026-05-22T10:00:00Z",
            "notes": "Lead ini perlu dikawal sampai deal.",
        },
        headers=csrf_headers(client),
    )
    assert update_response.status_code == 200, update_response.text

    timeline_response = client.get(f"/leads/{owned_lead.id}/timeline")
    assert timeline_response.status_code == 200, timeline_response.text
    timeline = timeline_response.json()
    assert len(timeline) >= 3
    assert any(item["event_type"] == "stage_changed" for item in timeline)
    assert any(item["event_type"] == "follow_up_updated" for item in timeline)
    assert any(item["event_type"] == "notes_updated" for item in timeline)

    detail_response = client.get(f"/leads/{owned_lead.id}")
    assert detail_response.status_code == 200, detail_response.text
    assert len(detail_response.json()["timeline"]) >= 3


def test_marketing_cannot_reassign_lead(
    client: TestClient,
    seeded_data: dict[str, object],
) -> None:
    marketing_b = seeded_data["marketing_b"]
    marketing_a = seeded_data["marketing_a"]
    owned_lead = seeded_data["owned_lead"]

    login(client, email=marketing_b.email, password="MarketingPass123!")

    response = client.patch(
        f"/leads/{owned_lead.id}",
        json={"assigned_user_id": str(marketing_a.id)},
        headers=csrf_headers(client),
    )
    assert response.status_code == 403, response.text

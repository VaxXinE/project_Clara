from pathlib import Path
import sys
from uuid import UUID

import pytest
from sqlalchemy import select
from sqlalchemy.orm import sessionmaker

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.core.config import settings
from app.models.conversation import Conversation
from app.models.customer_profile import CustomerProfile
from app.models.lead import Lead


def login(client, *, email: str, password: str) -> None:
    response = client.post(
        "/auth/login",
        json={"email": email, "password": password},
    )
    assert response.status_code == 200, response.text


def csrf_headers(client) -> dict[str, str]:
    csrf_token = client.cookies.get(settings.csrf_cookie_name)
    assert csrf_token
    return {"X-CSRF-Token": csrf_token}


def test_same_customer_name_across_channels_links_to_one_customer_profile(
    client,
    db_session_factory: sessionmaker,
    seeded_data: dict[str, object],
) -> None:
    marketing_a = seeded_data["marketing_a"]
    login(client, email=marketing_a.email, password="MarketingPass123!")

    whatsapp_text = """
    12/04/26, 09.12 - Nia: Halo kak, saya lihat iklannya tadi.
    12/04/26, 09.13 - Aria: Halo kak Nia, siap saya bantu.
    """.strip()
    telegram_text = """
    [18.05.2026 09:12] Nia: Halo kak, saya tertarik juga dari Telegram.
    [18.05.2026 09:13] Aria: Siap kak, saya bantu jelaskan.
    """.strip()

    whatsapp_response = client.post(
        "/upload/whatsapp-text",
        json={"title": "Nia on WhatsApp", "raw_text": whatsapp_text},
        headers=csrf_headers(client),
    )
    assert whatsapp_response.status_code == 201, whatsapp_response.text

    telegram_response = client.post(
        "/upload/telegram-text",
        json={"title": "Nia on Telegram", "raw_text": telegram_text},
        headers=csrf_headers(client),
    )
    assert telegram_response.status_code == 201, telegram_response.text

    db = db_session_factory()
    whatsapp_conversation = db.get(
        Conversation,
        UUID(whatsapp_response.json()["conversation_id"]),
    )
    telegram_conversation = db.get(
        Conversation,
        UUID(telegram_response.json()["conversation_id"]),
    )
    assert whatsapp_conversation is not None
    assert telegram_conversation is not None
    assert whatsapp_conversation.lead_id is not None
    assert telegram_conversation.lead_id is not None

    whatsapp_lead = db.get(Lead, whatsapp_conversation.lead_id)
    telegram_lead = db.get(Lead, telegram_conversation.lead_id)
    assert whatsapp_lead is not None
    assert telegram_lead is not None
    assert whatsapp_lead.id != telegram_lead.id
    assert whatsapp_lead.customer_profile_id is not None
    assert whatsapp_lead.customer_profile_id == telegram_lead.customer_profile_id

    profiles = list(
        db.scalars(
            select(CustomerProfile).where(
                CustomerProfile.organization_id == marketing_a.organization_id,
                CustomerProfile.canonical_key == "nia",
            )
        ).all()
    )
    assert len(profiles) == 1


def test_lead_detail_and_customer_endpoint_return_unified_identity(
    client,
    db_session_factory: sessionmaker,
    seeded_data: dict[str, object],
) -> None:
    marketing_a = seeded_data["marketing_a"]
    login(client, email=marketing_a.email, password="MarketingPass123!")

    whatsapp_text = """
    12/04/26, 09.12 - Leoni: Halo kak, saya tertarik dari WhatsApp.
    12/04/26, 09.13 - Aria: Siap kak, saya bantu jelaskan.
    """.strip()
    telegram_text = """
    [18.05.2026 09:12] Leoni: Halo kak, saya follow up lagi via Telegram.
    [18.05.2026 09:13] Aria: Siap kak, saya bantu lanjutkan.
    """.strip()

    whatsapp_response = client.post(
        "/upload/whatsapp-text",
        json={"title": "Leoni on WhatsApp", "raw_text": whatsapp_text},
        headers=csrf_headers(client),
    )
    telegram_response = client.post(
        "/upload/telegram-text",
        json={"title": "Leoni on Telegram", "raw_text": telegram_text},
        headers=csrf_headers(client),
    )
    assert whatsapp_response.status_code == 201, whatsapp_response.text
    assert telegram_response.status_code == 201, telegram_response.text

    db = db_session_factory()
    whatsapp_conversation = db.get(
        Conversation,
        UUID(whatsapp_response.json()["conversation_id"]),
    )
    assert whatsapp_conversation is not None
    assert whatsapp_conversation.lead_id is not None
    whatsapp_lead = db.get(Lead, whatsapp_conversation.lead_id)
    assert whatsapp_lead is not None
    assert whatsapp_lead.customer_profile_id is not None

    lead_response = client.get(f"/leads/{whatsapp_lead.id}")
    assert lead_response.status_code == 200, lead_response.text
    lead_payload = lead_response.json()
    assert lead_payload["customer_profile"]["lead_count"] == 2
    assert set(lead_payload["customer_profile"]["source_channels"]) == {
        "whatsapp",
        "telegram",
    }

    customer_response = client.get(
        f"/customers/{whatsapp_lead.customer_profile_id}"
    )
    assert customer_response.status_code == 200, customer_response.text
    customer_payload = customer_response.json()
    assert customer_payload["display_name"] == "Leoni"
    assert customer_payload["lead_count"] == 2
    assert len(customer_payload["related_leads"]) == 2
    assert customer_payload["identity_confidence"] > 0
    assert customer_payload["match_strategy"] in {
        "name_exact",
        "name_normalized",
        "single_token_name",
    }


def test_customer_profile_merge_candidates_and_manual_merge(
    client,
    db_session_factory: sessionmaker,
    seeded_data: dict[str, object],
) -> None:
    admin_a = seeded_data["admin_a"]
    login(client, email=admin_a.email, password="AdminPass123!")

    first_text = """
    12/04/26, 09.12 - Nia Putri: Halo kak, saya lihat info ini.
    12/04/26, 09.13 - Aria: Siap kak, saya bantu.
    """.strip()
    second_text = """
    [18.05.2026 09:12] Nia P: Halo kak, saya follow up lagi.
    [18.05.2026 09:13] Aria: Siap kak, saya lanjutkan ya.
    """.strip()

    first_response = client.post(
        "/upload/whatsapp-text",
        json={"title": "Nia Putri on WhatsApp", "raw_text": first_text},
        headers=csrf_headers(client),
    )
    second_response = client.post(
        "/upload/telegram-text",
        json={"title": "Nia P on Telegram", "raw_text": second_text},
        headers=csrf_headers(client),
    )
    assert first_response.status_code == 201, first_response.text
    assert second_response.status_code == 201, second_response.text

    db = db_session_factory()
    first_conversation = db.get(Conversation, UUID(first_response.json()["conversation_id"]))
    second_conversation = db.get(Conversation, UUID(second_response.json()["conversation_id"]))
    assert first_conversation is not None and first_conversation.lead_id is not None
    assert second_conversation is not None and second_conversation.lead_id is not None

    first_lead = db.get(Lead, first_conversation.lead_id)
    second_lead = db.get(Lead, second_conversation.lead_id)
    assert first_lead is not None and first_lead.customer_profile_id is not None
    assert second_lead is not None and second_lead.customer_profile_id is not None
    assert first_lead.customer_profile_id != second_lead.customer_profile_id

    profile_response = client.get(f"/customers/{first_lead.customer_profile_id}")
    assert profile_response.status_code == 200, profile_response.text
    profile_payload = profile_response.json()
    assert len(profile_payload["merge_candidates"]) >= 1
    candidate_ids = {candidate["id"] for candidate in profile_payload["merge_candidates"]}
    assert str(second_lead.customer_profile_id) in candidate_ids

    merge_response = client.post(
        "/customers/merge",
        json={
            "source_profile_id": str(second_lead.customer_profile_id),
            "target_profile_id": str(first_lead.customer_profile_id),
            "merge_notes": "Manual merge karena customer sama lintas channel.",
        },
        headers=csrf_headers(client),
    )
    assert merge_response.status_code == 200, merge_response.text
    merge_payload = merge_response.json()
    assert merge_payload["match_strategy"] == "manual_merge"
    assert merge_payload["lead_count"] == 2

    db.expire_all()
    refreshed_second_lead = db.get(Lead, second_lead.id)
    assert refreshed_second_lead is not None
    assert refreshed_second_lead.customer_profile_id == first_lead.customer_profile_id


def test_same_thread_continuation_preserves_lead_and_profile(
    client,
    db_session_factory: sessionmaker,
    seeded_data: dict[str, object],
) -> None:
    marketing_a = seeded_data["marketing_a"]
    login(client, email=marketing_a.email, password="MarketingPass123!")
    headers = csrf_headers(client)

    first_response = client.post(
        "/upload/whatsapp-text",
        json={
            "title": "Rani",
            "raw_text": "12/04/26, 09.12 - Rani: Halo kak.",
        },
        headers=headers,
    )
    continued_response = client.post(
        "/upload/whatsapp-text",
        json={
            "title": "Rani",
            "raw_text": "12/04/26, 09.15 - Rani: Saya lanjut bertanya ya.",
        },
        headers=headers,
    )
    assert first_response.status_code == 201, first_response.text
    assert continued_response.status_code == 201, continued_response.text
    assert continued_response.json()["conversation_id"] == first_response.json()[
        "conversation_id"
    ]

    db = db_session_factory()
    conversations = list(
        db.scalars(
            select(Conversation).where(
                Conversation.organization_id == marketing_a.organization_id,
                Conversation.title == "Rani",
            )
        ).all()
    )
    assert len(conversations) == 1
    assert conversations[0].lead_id is not None
    lead = db.get(Lead, conversations[0].lead_id)
    assert lead is not None and lead.customer_profile_id is not None
    assert len(
        db.scalars(
            select(Lead).where(
                Lead.organization_id == marketing_a.organization_id,
                Lead.display_name == "Rani",
            )
        ).all()
    ) == 1
    assert len(
        db.scalars(
            select(CustomerProfile).where(
                CustomerProfile.organization_id == marketing_a.organization_id,
                CustomerProfile.canonical_key == "rani",
            )
        ).all()
    ) == 1


def test_customer_profile_identity_is_isolated_by_organization(
    client,
    db_session_factory: sessionmaker,
    seeded_data: dict[str, object],
) -> None:
    marketing_a = seeded_data["marketing_a"]
    marketing_other_org = seeded_data["marketing_other_org"]

    for user in (marketing_a, marketing_other_org):
        login(client, email=user.email, password="MarketingPass123!")
        response = client.post(
            "/upload/whatsapp-text",
            json={
                "title": "Dina",
                "raw_text": "12/04/26, 09.12 - Dina: Halo kak.",
            },
            headers=csrf_headers(client),
        )
        assert response.status_code == 201, response.text

    db = db_session_factory()
    profiles = list(
        db.scalars(
            select(CustomerProfile).where(CustomerProfile.canonical_key == "dina")
        ).all()
    )
    assert len(profiles) == 2
    assert {profile.organization_id for profile in profiles} == {
        marketing_a.organization_id,
        marketing_other_org.organization_id,
    }
    assert all(
        lead.organization_id == profile.organization_id
        for profile in profiles
        for lead in profile.leads
    )


def test_profile_resolution_failure_rolls_back_new_conversation_graph(
    client,
    db_session_factory: sessionmaker,
    seeded_data: dict[str, object],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    marketing_a = seeded_data["marketing_a"]
    login(client, email=marketing_a.email, password="MarketingPass123!")

    def fail_profile_resolution(*_args, **_kwargs):
        raise RuntimeError("profile resolution failed")

    monkeypatch.setattr(
        "app.services.lead_service.ensure_customer_profile_for_lead",
        fail_profile_resolution,
    )

    with pytest.raises(RuntimeError, match="profile resolution failed"):
        client.post(
            "/upload/whatsapp-text",
            json={
                "title": "Atomic Customer",
                "raw_text": "12/04/26, 09.12 - Atomic Customer: Halo kak.",
            },
            headers=csrf_headers(client),
        )

    db = db_session_factory()
    assert db.scalar(
        select(Conversation).where(
            Conversation.organization_id == marketing_a.organization_id,
            Conversation.title == "Atomic Customer",
        )
    ) is None
    assert db.scalar(
        select(Lead).where(
            Lead.organization_id == marketing_a.organization_id,
            Lead.display_name == "Atomic Customer",
        )
    ) is None

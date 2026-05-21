from pathlib import Path
import sys
from uuid import UUID

from fastapi.testclient import TestClient
from sqlalchemy.orm import sessionmaker
from sqlalchemy import select

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.core.config import settings
from app.models.product_knowledge import ProductKnowledge


def login(client: TestClient, *, email: str, password: str) -> None:
    response = client.post("/auth/login", json={"email": email, "password": password})
    assert response.status_code == 200, response.text


def csrf_headers(client: TestClient) -> dict[str, str]:
    csrf_token = client.cookies.get(settings.csrf_cookie_name)
    assert csrf_token
    return {"X-CSRF-Token": csrf_token}


def create_review_case(
    client: TestClient,
    *,
    conversation_id: str,
) -> str:
    response = client.put(
        f"/dashboard/sales/conversations/{conversation_id}/review-case",
        json={
            "reviewer_user_id": None,
            "status": "in_review",
            "review_label": "unik",
            "review_summary": "Kasus ini memunculkan pola objection legalitas yang berulang.",
            "coaching_focus": "Butuh jawaban standar yang aman dan konsisten.",
            "recommended_action": "Naikkan jadi update knowledge untuk tim sales.",
        },
        headers=csrf_headers(client),
    )
    assert response.status_code == 200, response.text
    return response.json()["id"]


def test_head_can_create_knowledge_update_proposal_from_review_case(
    client: TestClient,
    seeded_data: dict[str, object],
) -> None:
    admin_a = seeded_data["admin_a"]
    owned_conversation = seeded_data["owned_conversation"]

    login(client, email=admin_a.email, password="AdminPass123!")
    create_review_case(client, conversation_id=str(owned_conversation.id))

    response = client.put(
        f"/product-knowledge/conversations/{owned_conversation.id}/proposal",
        json={
            "title": "Handling objection legalitas",
            "category": "legalitas",
            "proposed_content": "Jika customer ragu legalitas, sales wajib merujuk ke dokumen resmi dan tidak boleh overclaim.",
            "source_type": "coaching_case",
            "rationale": "Kasus legalitas muncul berulang di lapangan.",
            "status": "pending_approval",
        },
        headers=csrf_headers(client),
    )
    assert response.status_code == 200, response.text
    payload = response.json()
    assert payload["status"] == "pending_approval"
    assert payload["chat_review_case_id"] is not None
    assert payload["proposed_by_user_name"] == admin_a.name

    list_response = client.get("/product-knowledge/proposals")
    assert list_response.status_code == 200, list_response.text
    listed = list_response.json()
    assert len(listed) == 1
    assert listed[0]["title"] == "Handling objection legalitas"


def test_head_can_approve_and_publish_knowledge_update_proposal(
    client: TestClient,
    db_session_factory: sessionmaker,
    seeded_data: dict[str, object],
) -> None:
    admin_a = seeded_data["admin_a"]
    owned_conversation = seeded_data["owned_conversation"]

    login(client, email=admin_a.email, password="AdminPass123!")
    create_review_case(client, conversation_id=str(owned_conversation.id))

    create_response = client.put(
        f"/product-knowledge/conversations/{owned_conversation.id}/proposal",
        json={
            "title": "Trust issue legalitas",
            "category": "trust",
            "proposed_content": "Sales harus menjelaskan legalitas memakai sumber resmi dan menghindari janji hasil.",
            "source_type": "coaching_case",
            "rationale": "Diperlukan guardrail jawaban yang seragam.",
            "status": "pending_approval",
        },
        headers=csrf_headers(client),
    )
    assert create_response.status_code == 200, create_response.text
    proposal_id = create_response.json()["id"]

    review_response = client.patch(
        f"/product-knowledge/proposals/{proposal_id}/review",
        json={
            "status": "approved",
            "review_decision_note": "Layak dipublish untuk organization ini.",
        },
        headers=csrf_headers(client),
    )
    assert review_response.status_code == 200, review_response.text
    payload = review_response.json()
    assert payload["status"] == "approved"
    assert payload["published_product_knowledge_id"] is not None
    assert payload["published_product_knowledge_title"] == "Trust issue legalitas"

    db = db_session_factory()
    entry = db.scalars(
        select(ProductKnowledge).where(
            ProductKnowledge.id == UUID(payload["published_product_knowledge_id"])
        )
    ).first()
    assert entry is not None
    assert entry.organization_id == admin_a.organization_id
    assert "menghindari janji hasil" in entry.content
    db.close()


def test_sales_cannot_create_knowledge_update_proposal(
    client: TestClient,
    seeded_data: dict[str, object],
) -> None:
    marketing_b = seeded_data["marketing_b"]
    owned_conversation = seeded_data["owned_conversation"]

    login(client, email=marketing_b.email, password="MarketingPass123!")

    response = client.put(
        f"/product-knowledge/conversations/{owned_conversation.id}/proposal",
        json={
            "title": "Tidak boleh",
            "category": "legalitas",
            "proposed_content": "Sales biasa tidak boleh submit proposal ini.",
            "source_type": "coaching_case",
            "rationale": "Harus diblok.",
            "status": "draft",
        },
        headers=csrf_headers(client),
    )
    assert response.status_code == 403, response.text

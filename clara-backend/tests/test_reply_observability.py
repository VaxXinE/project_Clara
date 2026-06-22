from datetime import datetime, timedelta, timezone
from pathlib import Path
import sys

from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import sessionmaker

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.api import routes_reply
from app.core.config import settings
from app.models.audit_log import AuditLog
from app.services.reply_suggestion_service import ReplySuggestionError


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


def test_reply_suggestion_generation_failure_creates_audit_log(
    client: TestClient,
    db_session_factory: sessionmaker,
    seeded_data: dict[str, object],
    monkeypatch,
) -> None:
    marketing_b = seeded_data["marketing_b"]
    owned_conversation = seeded_data["owned_conversation"]

    def raise_generation_error(*_args, **_kwargs):
        raise ReplySuggestionError("OpenAI returned empty structured output.")

    monkeypatch.setattr(routes_reply, "create_reply_suggestion", raise_generation_error)

    login(client, email=marketing_b.email, password="MarketingPass123!")

    response = client.post(
        f"/conversations/{owned_conversation.id}/reply-suggestions",
        headers=csrf_headers(client),
    )

    assert response.status_code == 400
    assert response.json()["detail"] == "OpenAI returned empty structured output."

    db = db_session_factory()
    audit_log = db.scalars(
        select(AuditLog)
        .where(AuditLog.action == "reply_suggestion.generate_failed")
        .order_by(AuditLog.created_at.desc())
    ).first()
    assert audit_log is not None
    assert audit_log.actor_email == marketing_b.email
    assert audit_log.resource_id == str(owned_conversation.id)
    assert audit_log.metadata_json["error_type"] == "ReplySuggestionError"


def test_head_can_view_reply_suggestion_health_summary(
    client: TestClient,
    db_session_factory: sessionmaker,
    seeded_data: dict[str, object],
) -> None:
    admin_a = seeded_data["admin_a"]
    marketing_b = seeded_data["marketing_b"]
    org_a = seeded_data["org_a"]

    db = db_session_factory()
    now = datetime.now(timezone.utc)
    db.add_all(
        [
            AuditLog(
                organization_id=str(org_a.id),
                actor_user_id=str(marketing_b.id),
                actor_email=marketing_b.email,
                actor_role=marketing_b.role,
                action="reply_suggestion.generate",
                resource_type="reply_suggestion",
                resource_id="rs-1",
                metadata_json={},
                created_at=now - timedelta(minutes=30),
            ),
            AuditLog(
                organization_id=str(org_a.id),
                actor_user_id=str(marketing_b.id),
                actor_email=marketing_b.email,
                actor_role=marketing_b.role,
                action="reply_suggestion.generate_failed",
                resource_type="conversation",
                resource_id="conv-1",
                metadata_json={"error_type": "ReplySuggestionError"},
                created_at=now - timedelta(minutes=25),
            ),
            AuditLog(
                organization_id=str(org_a.id),
                actor_user_id=str(marketing_b.id),
                actor_email=marketing_b.email,
                actor_role=marketing_b.role,
                action="extension.whatsapp.reply_suggestions_generate",
                resource_type="reply_suggestion",
                resource_id="rs-2",
                metadata_json={"cached": True, "duplicate": True},
                created_at=now - timedelta(minutes=20),
            ),
            AuditLog(
                organization_id=str(org_a.id),
                actor_user_id=str(marketing_b.id),
                actor_email=marketing_b.email,
                actor_role=marketing_b.role,
                action="extension.whatsapp.reply_suggestions_generate_failed",
                resource_type="conversation",
                resource_id=None,
                metadata_json={"error_type": "ReplySuggestionError"},
                created_at=now - timedelta(minutes=15),
            ),
            AuditLog(
                organization_id=str(org_a.id),
                actor_user_id=str(marketing_b.id),
                actor_email=marketing_b.email,
                actor_role=marketing_b.role,
                action="extension.whatsapp.reply_suggestion_send",
                resource_type="reply_suggestion",
                resource_id="rs-2",
                metadata_json={},
                created_at=now - timedelta(minutes=10),
            ),
            AuditLog(
                organization_id=str(org_a.id),
                actor_user_id=str(marketing_b.id),
                actor_email=marketing_b.email,
                actor_role=marketing_b.role,
                action="extension.whatsapp.reply_suggestion_send_failed",
                resource_type="reply_suggestion",
                resource_id="rs-3",
                metadata_json={"error_type": "ReplySuggestionError"},
                created_at=now - timedelta(minutes=5),
            ),
        ]
    )
    db.commit()

    login(client, email=admin_a.email, password="AdminPass123!")

    response = client.get("/audit-logs/reply-suggestions/health?window_hours=24")

    assert response.status_code == 200, response.text
    payload = response.json()
    assert payload["organization_id"] == str(org_a.id)
    assert payload["generated_total"] == 2
    assert payload["generated_success"] == 1
    assert payload["generated_failed"] == 1
    assert payload["extension_generated_total"] == 2
    assert payload["extension_generated_success"] == 1
    assert payload["extension_generated_failed"] == 1
    assert payload["cached_hits"] == 1
    assert payload["duplicate_snapshot_hits"] == 1
    assert payload["send_success"] == 1
    assert payload["send_failed"] == 1
    assert payload["latest_success_at"] is not None
    assert payload["latest_failure_at"] is not None
    assert payload["top_failures"][0]["count"] >= 1


def test_sales_cannot_view_reply_suggestion_health_summary(
    client: TestClient,
    seeded_data: dict[str, object],
) -> None:
    marketing_b = seeded_data["marketing_b"]

    login(client, email=marketing_b.email, password="MarketingPass123!")

    response = client.get("/audit-logs/reply-suggestions/health")

    assert response.status_code == 403

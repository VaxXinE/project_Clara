from sqlalchemy import select
from sqlalchemy.orm import sessionmaker
from fastapi.testclient import TestClient

from app.core.config import settings
from app.models.ai_persona_config_version import AIPersonaConfigVersion
from app.models.audit_log import AuditLog


def login(
    client: TestClient,
    email: str,
    password: str,
) -> None:
    response = client.post(
        "/auth/login",
        json={"email": email, "password": password},
    )
    assert response.status_code == 200, response.text


def csrf_headers(client: TestClient) -> dict[str, str]:
    token = client.cookies.get(settings.csrf_cookie_name)
    assert token
    return {"X-CSRF-Token": token}


def create_draft(client: TestClient, content: str) -> dict:
    response = client.post(
        "/ai-persona-config/mini/personality_mode/drafts",
        json={"content": content},
        headers=csrf_headers(client),
    )
    assert response.status_code == 201, response.text
    return response.json()


def test_persona_config_is_superadmin_only(
    client: TestClient,
    seeded_data: dict[str, object],
) -> None:
    login(client, seeded_data["marketing_a"].email, "MarketingPass123!")
    assert client.get("/ai-persona-config").status_code == 403
    assert (
        client.get("/ai-persona-config/effective", params={"variant": "mini"}).status_code
        == 403
    )
    response = client.post(
        "/ai-persona-config/mini/flow/drafts",
        json={"content": "Updated flow"},
        headers=csrf_headers(client),
    )
    assert response.status_code == 403


def test_persona_mutation_requires_csrf(
    client: TestClient,
    seeded_data: dict[str, object],
) -> None:
    login(client, seeded_data["owner"].email, "OwnerPass123!")
    response = client.post(
        "/ai-persona-config/mini/flow/drafts",
        json={"content": "Updated flow"},
    )
    assert response.status_code == 403


def test_draft_publish_and_rollback_preserve_history_and_audit(
    client: TestClient,
    db_session_factory: sessionmaker,
    seeded_data: dict[str, object],
) -> None:
    login(client, seeded_data["owner"].email, "OwnerPass123!")
    first = create_draft(client, "Persona pertama")
    publish_first = client.post(
        f"/ai-persona-config/versions/{first['id']}/publish",
        headers=csrf_headers(client),
    )
    assert publish_first.status_code == 200, publish_first.text
    assert publish_first.json()["status"] == "published"

    second = create_draft(client, "Persona kedua")
    publish_second = client.post(
        f"/ai-persona-config/versions/{second['id']}/publish",
        headers=csrf_headers(client),
    )
    assert publish_second.status_code == 200, publish_second.text

    rollback = client.post(
        f"/ai-persona-config/versions/{first['id']}/rollback",
        headers=csrf_headers(client),
    )
    assert rollback.status_code == 201, rollback.text
    rolled_back = rollback.json()
    assert rolled_back["status"] == "published"
    assert rolled_back["content"] == "Persona pertama"
    assert rolled_back["source_version_id"] == first["id"]

    history = client.get(
        "/ai-persona-config",
        params={"variant": "mini", "section_key": "personality_mode"},
    )
    assert history.status_code == 200, history.text
    versions = history.json()
    assert [item["version_number"] for item in versions] == [3, 2, 1]
    assert [item["status"] for item in versions] == [
        "published",
        "archived",
        "archived",
    ]

    db = db_session_factory()
    published = list(
        db.scalars(
            select(AIPersonaConfigVersion).where(
                AIPersonaConfigVersion.status == "published"
            )
        ).all()
    )
    actions = set(
        db.scalars(
            select(AuditLog.action).where(
                AuditLog.action.like("ai_persona_config.%")
            )
        ).all()
    )
    db.close()
    assert len(published) == 1
    assert {
        "ai_persona_config.draft.create",
        "ai_persona_config.publish",
        "ai_persona_config.rollback",
    }.issubset(actions)


def test_effective_persona_uses_published_override_and_markdown_fallback(
    client: TestClient,
    seeded_data: dict[str, object],
) -> None:
    login(client, seeded_data["owner"].email, "OwnerPass123!")

    before = client.get(
        "/ai-persona-config/effective",
        params={"variant": "mini"},
    )
    assert before.status_code == 200, before.text
    assert len(before.json()) == 5
    assert {item["source"] for item in before.json()} == {"markdown"}

    draft = create_draft(client, "Persona runtime dari database")
    publish = client.post(
        f"/ai-persona-config/versions/{draft['id']}/publish",
        headers=csrf_headers(client),
    )
    assert publish.status_code == 200, publish.text

    after = client.get(
        "/ai-persona-config/effective",
        params={"variant": "mini"},
    )
    assert after.status_code == 200, after.text
    sections = {item["section_key"]: item for item in after.json()}
    assert sections["personality_mode"]["content"] == "Persona runtime dari database"
    assert sections["personality_mode"]["source"] == "database"
    assert sections["instruction"]["source"] == "markdown"

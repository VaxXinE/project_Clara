from hashlib import sha256

import pytest
from sqlalchemy import func, select

from app.core.clara_runtime_contract import PromptSectionSource
from app.models.ai_persona_bundle import AIPersonaBundle, AIPersonaBundleSection
from app.models.ai_persona_config_version import AIPersonaConfigVersion
from app.models.audit_log import AuditLog
from app.services.ai_persona_bundle_service import (
    CLARA_PERSONA_BUNDLE_CONTRACT_VERSION,
    ROADMAP_REVIEW_ORDER,
    RUNTIME_SECTION_ORDER,
    AIPersonaBundleError,
    create_bundle_draft,
    diff_bundles,
    publish_bundle_section_immediately,
    publish_bundle,
    replace_bundle_section,
    rollback_bundle,
    validate_bundle,
)
from app.services.clara_playbook_service import load_effective_system_sections
from app.services.clara_playbook_service import compose_clara_playbooks
from app.services import clara_evaluation_service
from app.services.ai_persona_config_service import (
    AIPersonaConfigError,
    publish_persona_content_immediately,
    publish_persona_version,
)
from app.schemas.ai_persona_config_schema import AIPersonaDraftCreateRequest



def login(client, email: str, password: str) -> None:
    response = client.post("/auth/login", json={"email": email, "password": password})
    assert response.status_code == 200, response.text


def csrf_headers(client) -> dict[str, str]:
    return {"X-CSRF-Token": client.cookies.get("clara_csrf_token")}


@pytest.fixture(autouse=True)
def stage7_publication_compatibility(monkeypatch):
    """Stage 7 tests predate the mandatory Stage 8 certification gate."""
    monkeypatch.setattr(
        clara_evaluation_service,
        "assert_bundle_certified_for_publication",
        lambda _db, _bundle: object(),
    )


def _complete_bundle(db, user, suffix: str = "v1"):
    versions = {}
    for key in RUNTIME_SECTION_ORDER:
        content = f"Synthetic {key} {suffix}"
        version = AIPersonaConfigVersion(
            variant="mini",
            section_key=key,
            version_number=1,
            status="draft",
            content=content,
            content_sha256=sha256(content.encode()).hexdigest(),
            created_by_user_id=user.id,
        )
        db.add(version)
        db.flush()
        versions[key] = version.id
    return create_bundle_draft(
        db,
        current_user=user,
        section_version_ids=versions,
    )


def test_bundle_validation_hash_order_and_diff_are_deterministic(
    db_session_factory,
    seeded_data,
):
    db = db_session_factory()
    bundle = _complete_bundle(db, seeded_data["owner"])

    first = validate_bundle(db, bundle_id=bundle.id, current_user=seeded_data["owner"])
    second = validate_bundle(db, bundle_id=bundle.id, current_user=seeded_data["owner"])
    diff = diff_bundles(db, new_bundle_id=bundle.id)

    assert first.complete is True
    assert first.bundle_hash == second.bundle_hash
    assert first.validation_report_hash == second.validation_report_hash
    assert first.validation_contract_version == CLARA_PERSONA_BUNDLE_CONTRACT_VERSION
    assert [item["section_key"] for item in first.section_results] == list(
        RUNTIME_SECTION_ORDER
    )
    assert ROADMAP_REVIEW_ORDER[0] == "guardrail"
    assert diff["changed_section_keys"] == list(RUNTIME_SECTION_ORDER)
    db.close()


def test_replacing_bundle_section_updates_existing_row(
    db_session_factory,
    seeded_data,
):
    db = db_session_factory()
    bundle = _complete_bundle(db, seeded_data["owner"])
    bundle.validation_status = "valid"
    bundle.validation_report = {"complete": True}
    bundle.validation_report_hash = "1" * 64
    bundle.bundle_sha256 = "2" * 64
    db.commit()
    content = "Replacement instruction"
    replacement = AIPersonaConfigVersion(
        variant="mini",
        section_key="instruction",
        version_number=2,
        status="draft",
        content=content,
        content_sha256=sha256(content.encode()).hexdigest(),
        created_by_user_id=seeded_data["owner"].id,
    )
    db.add(replacement)
    db.flush()

    updated = replace_bundle_section(
        db,
        bundle_id=bundle.id,
        section_key="instruction",
        version_id=replacement.id,
    )

    assert db.scalar(
        select(func.count())
        .select_from(AIPersonaBundleSection)
        .where(
            AIPersonaBundleSection.bundle_id == bundle.id,
            AIPersonaBundleSection.section_key == "instruction",
        )
    ) == 1
    instruction = next(item for item in updated.sections if item.section_key == "instruction")
    assert instruction.persona_config_version_id == replacement.id
    assert updated.validation_status == "pending"
    assert updated.bundle_sha256 is None
    db.close()


def test_incomplete_and_unsafe_bundle_cannot_publish(db_session_factory, seeded_data):
    db = db_session_factory()
    bundle = create_bundle_draft(db, current_user=seeded_data["owner"])
    report = validate_bundle(db, bundle_id=bundle.id, current_user=seeded_data["owner"])

    assert report.complete is False
    assert {item["code"] for item in report.blocking_errors} >= {
        "MISSING_GUARDRAIL",
        "INCOMPLETE_BUNDLE",
    }
    with pytest.raises(AIPersonaBundleError, match="validated"):
        publish_bundle(
            db,
            bundle_id=bundle.id,
            current_user=seeded_data["owner"],
            expected_current_bundle_hash=None,
            acknowledged_warning_codes=[],
        )
    assert db.scalar(
        select(AIPersonaBundle).where(AIPersonaBundle.status == "published")
    ) is None
    db.close()


def test_atomic_publish_runtime_provenance_and_legacy_section_guard(
    db_session_factory,
    seeded_data,
):
    db = db_session_factory()
    bundle = _complete_bundle(db, seeded_data["owner"])
    report = validate_bundle(db, bundle_id=bundle.id, current_user=seeded_data["owner"])
    published = publish_bundle(
        db,
        bundle_id=bundle.id,
        current_user=seeded_data["owner"],
        expected_current_bundle_hash=None,
        acknowledged_warning_codes=[item["code"] for item in report.warnings],
    )

    sections = load_effective_system_sections(db, "mini")
    assert published.status == "published"
    assert len(sections) == 5
    assert {
        section.provenance.effective_source for section in sections
    } == {PromptSectionSource.DATABASE_PUBLISHED_BUNDLE}
    assert {section.provenance.bundle_id for section in sections} == {
        str(published.id)
    }
    metadata = compose_clara_playbooks(db, "mini").debug_metadata()
    assert metadata["persona_bundle_id"] == str(published.id)
    assert "Synthetic instruction" not in str(metadata)
    assert db.scalar(
        select(AuditLog).where(AuditLog.action == "ai_persona_bundle.publish")
    )
    with pytest.raises(AIPersonaConfigError, match="complete bundle"):
        publish_persona_version(
            db,
            version_id=published.sections[0].persona_config_version_id,
            current_user=seeded_data["owner"],
        )
    db.close()


def test_mini_section_change_is_published_immediately(
    db_session_factory,
    seeded_data,
):
    db = db_session_factory()
    original = _complete_bundle(db, seeded_data["owner"])
    report = validate_bundle(
        db, bundle_id=original.id, current_user=seeded_data["owner"]
    )
    original = publish_bundle(
        db,
        bundle_id=original.id,
        current_user=seeded_data["owner"],
        expected_current_bundle_hash=None,
        acknowledged_warning_codes=[item["code"] for item in report.warnings],
    )

    published = publish_bundle_section_immediately(
        db,
        current_user=seeded_data["owner"],
        section_key="instruction",
        content="Instruction langsung aktif",
    )

    assert original.status == "archived"
    assert published.status == "published"
    assert published.source_bundle_id == original.id
    assert next(
        item for item in published.sections if item.section_key == "instruction"
    ).persona_config_version.content == "Instruction langsung aktif"
    assert db.scalar(
        select(func.count()).select_from(AIPersonaBundle).where(
            AIPersonaBundle.status == "draft"
        )
    ) == 0
    assert "Instruction langsung aktif" in {
        item.content for item in load_effective_system_sections(db, "mini")
    }
    db.close()


def test_regular_content_is_published_without_draft(
    db_session_factory,
    seeded_data,
):
    db = db_session_factory()

    published = publish_persona_content_immediately(
        db,
        variant="reguler",
        section_key="instruction",
        payload=AIPersonaDraftCreateRequest(content="Instruction reguler aktif"),
        current_user=seeded_data["owner"],
    )

    assert published.status == "published"
    assert db.scalar(
        select(func.count()).select_from(AIPersonaConfigVersion).where(
            AIPersonaConfigVersion.variant == "reguler",
            AIPersonaConfigVersion.section_key == "instruction",
            AIPersonaConfigVersion.status == "draft",
        )
    ) == 0
    db.close()


def test_invalid_published_bundle_fails_closed_without_mixing(
    db_session_factory,
    seeded_data,
):
    db = db_session_factory()
    bundle = _complete_bundle(db, seeded_data["owner"])
    report = validate_bundle(db, bundle_id=bundle.id, current_user=seeded_data["owner"])
    bundle = publish_bundle(
        db,
        bundle_id=bundle.id,
        current_user=seeded_data["owner"],
        expected_current_bundle_hash=None,
        acknowledged_warning_codes=[item["code"] for item in report.warnings],
    )
    bundle.bundle_sha256 = "0" * 64
    db.commit()

    sections = load_effective_system_sections(db, "mini")
    assert len(sections) == 5
    assert {section.provenance.effective_source for section in sections} == {
        PromptSectionSource.MISSING
    }
    assert {section.provenance.fallback_reason for section in sections} == {
        "INVALID_PUBLISHED_BUNDLE_FAIL_CLOSED"
    }
    db.close()


def test_warning_acknowledgement_and_stale_hash_are_required(
    db_session_factory,
    seeded_data,
):
    db = db_session_factory()
    bundle = _complete_bundle(db, seeded_data["owner"])
    first = bundle.sections[0]
    content = "Minimum Rp5.000.000 dan closing"
    first.persona_config_version.content = content
    first.persona_config_version.content_sha256 = sha256(content.encode()).hexdigest()
    first.content_sha256 = first.persona_config_version.content_sha256
    first.character_count = len(content)
    db.commit()
    report = validate_bundle(db, bundle_id=bundle.id, current_user=seeded_data["owner"])

    with pytest.raises(AIPersonaBundleError, match="warnings"):
        publish_bundle(
            db,
            bundle_id=bundle.id,
            current_user=seeded_data["owner"],
            expected_current_bundle_hash=None,
            acknowledged_warning_codes=[],
        )
    with pytest.raises(AIPersonaBundleError, match="changed"):
        publish_bundle(
            db,
            bundle_id=bundle.id,
            current_user=seeded_data["owner"],
            expected_current_bundle_hash="0" * 64,
            acknowledged_warning_codes=[item["code"] for item in report.warnings],
        )
    db.close()


def test_optimistic_publish_allows_only_one_winner(db_session_factory, seeded_data):
    db = db_session_factory()
    first = _complete_bundle(db, seeded_data["owner"], "winner")
    first_report = validate_bundle(
        db, bundle_id=first.id, current_user=seeded_data["owner"]
    )
    second = create_bundle_draft(
        db,
        current_user=seeded_data["owner"],
        section_version_ids={
            item.section_key: item.persona_config_version_id for item in first.sections
        },
    )
    second_report = validate_bundle(
        db, bundle_id=second.id, current_user=seeded_data["owner"]
    )
    publish_bundle(
        db,
        bundle_id=first.id,
        current_user=seeded_data["owner"],
        expected_current_bundle_hash=None,
        acknowledged_warning_codes=[item["code"] for item in first_report.warnings],
    )
    with pytest.raises(AIPersonaBundleError, match="changed"):
        publish_bundle(
            db,
            bundle_id=second.id,
            current_user=seeded_data["owner"],
            expected_current_bundle_hash=None,
            acknowledged_warning_codes=[item["code"] for item in second_report.warnings],
        )
    assert db.scalar(
        select(func.count()).select_from(AIPersonaBundle).where(
            AIPersonaBundle.status == "published"
        )
    ) == 1
    db.close()


def test_whole_bundle_rollback_creates_new_versions(db_session_factory, seeded_data):
    db = db_session_factory()
    first = _complete_bundle(db, seeded_data["owner"], "first")
    first_report = validate_bundle(
        db, bundle_id=first.id, current_user=seeded_data["owner"]
    )
    first = publish_bundle(
        db,
        bundle_id=first.id,
        current_user=seeded_data["owner"],
        expected_current_bundle_hash=None,
        acknowledged_warning_codes=[item["code"] for item in first_report.warnings],
    )
    second_versions = {}
    for key in RUNTIME_SECTION_ORDER:
        content = f"Synthetic {key} second"
        version = AIPersonaConfigVersion(
            variant="mini",
            section_key=key,
            version_number=2,
            status="draft",
            content=content,
            content_sha256=sha256(content.encode()).hexdigest(),
            created_by_user_id=seeded_data["owner"].id,
        )
        db.add(version)
        db.flush()
        second_versions[key] = version.id
    second = create_bundle_draft(
        db,
        current_user=seeded_data["owner"],
        section_version_ids=second_versions,
    )
    second_report = validate_bundle(
        db, bundle_id=second.id, current_user=seeded_data["owner"]
    )
    second = publish_bundle(
        db,
        bundle_id=second.id,
        current_user=seeded_data["owner"],
        expected_current_bundle_hash=first.bundle_sha256,
        acknowledged_warning_codes=[item["code"] for item in second_report.warnings],
    )

    restored = rollback_bundle(
        db,
        source_bundle_id=first.id,
        current_user=seeded_data["owner"],
        expected_current_bundle_hash=second.bundle_sha256,
        acknowledged_warning_codes=[item["code"] for item in first_report.warnings],
    )
    assert restored.status == "published"
    assert restored.source_bundle_id == first.id
    assert second.status == "archived"
    assert {
        item.persona_config_version_id for item in restored.sections
    } == {item.persona_config_version_id for item in first.sections}
    db.close()


def test_bundle_api_requires_superadmin_and_csrf(client, seeded_data):
    login(client, seeded_data["marketing_a"].email, "MarketingPass123!")
    assert client.get("/ai-persona-config/bundles").status_code == 403
    assert client.put(
        "/ai-persona-config/mini/instruction/publish",
        json={"content": "Tidak boleh dipublish marketing"},
        headers=csrf_headers(client),
    ).status_code == 403

    login(client, seeded_data["owner"].email, "OwnerPass123!")
    assert client.post("/ai-persona-config/bundles/import-current").status_code == 403
    response = client.post(
        "/ai-persona-config/bundles/import-current",
        headers=csrf_headers(client),
    )
    assert response.status_code == 201, response.text
    assert len(response.json()["sections"]) == 5
    assert client.put(
        "/ai-persona-config/mini/instruction/publish",
        json={"content": "Instruction langsung dari UI"},
    ).status_code == 403
    response = client.put(
        "/ai-persona-config/mini/instruction/publish",
        json={"content": "Instruction langsung dari UI"},
        headers=csrf_headers(client),
    )
    assert response.status_code == 200, response.text
    assert response.json()["content"] == "Instruction langsung dari UI"


def test_migration_does_not_publish_bundle(db_session_factory):
    db = db_session_factory()
    assert db.scalar(select(AIPersonaBundle).where(AIPersonaBundle.status == "published")) is None
    db.close()

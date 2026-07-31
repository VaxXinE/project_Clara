import json
from datetime import datetime, timezone
from hashlib import sha256
from pathlib import Path
from unittest.mock import Mock

import pytest
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import sessionmaker

from app.core.clara_runtime_contract import PromptSectionSource
from app.models.ai_persona_config_version import AIPersonaConfigVersion
from app.services import clara_playbook_service
from app.services.clara_playbook_service import (
    SYSTEM_PLAYBOOK_FILES,
    compose_clara_playbooks,
    load_clara_system_instruction_playbook,
    load_effective_clara_system_instruction_playbook,
    load_effective_system_sections,
)


@pytest.fixture
def isolated_knowledge_root(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
):
    root = tmp_path / "clara_knowledge"
    (root / "clara_knowledge_mini").mkdir(parents=True)
    (root / "clara_knowledge_regular").mkdir()
    monkeypatch.setattr(
        clara_playbook_service,
        "get_clara_knowledge_root_dir",
        lambda: root,
    )
    clara_playbook_service.read_markdown_file.cache_clear()
    clara_playbook_service.load_clara_response_playbook.cache_clear()
    yield root
    clara_playbook_service.read_markdown_file.cache_clear()
    clara_playbook_service.load_clara_response_playbook.cache_clear()


def test_persona_runtime_falls_back_to_markdown_when_database_is_unavailable() -> None:
    db = Mock()
    db.scalars.side_effect = SQLAlchemyError("database unavailable")

    effective = load_effective_clara_system_instruction_playbook(db, "mini")
    sections = load_effective_system_sections(db, "mini")

    assert effective == load_clara_system_instruction_playbook("mini")
    assert {section.provenance.fallback_reason for section in sections} == {
        "DATABASE_UNAVAILABLE"
    }
    assert db.rollback.call_count == 2


def test_system_sections_use_per_section_precedence_and_provenance(
    db_session_factory: sessionmaker,
    isolated_knowledge_root: Path,
) -> None:
    mini_dir = isolated_knowledge_root / "clara_knowledge_mini"
    for filename in reversed(SYSTEM_PLAYBOOK_FILES[:-1]):
        (mini_dir / filename).write_text(
            f"MARKDOWN {filename}",
            encoding="utf-8",
        )
    (mini_dir / "POSITIONING.md").write_text(
        "SUPPORTING POSITIONING",
        encoding="utf-8",
    )

    published_content = "DATABASE PERSONALITY SECRET"
    db = db_session_factory()
    db.add(
        AIPersonaConfigVersion(
            variant="mini",
            section_key="personality_mode",
            version_number=1,
            status="published",
            content=published_content,
            content_sha256=sha256(published_content.encode()).hexdigest(),
            published_at=datetime.now(timezone.utc),
        )
    )
    db.flush()

    sections = load_effective_system_sections(db, "mini")
    assert [section.section_key for section in sections] == [
        "instruction",
        "guardrail",
        "flow",
        "personality_mode",
        "auto_adapt",
    ]
    assert sections[0].provenance.effective_source == (
        PromptSectionSource.MARKDOWN_FALLBACK
    )
    assert sections[3].content == published_content
    assert sections[3].provenance.effective_source == (
        PromptSectionSource.DATABASE_PUBLISHED
    )
    assert sections[3].provenance.version == 1
    assert (
        sections[3].provenance.content_hash
        == sha256(published_content.encode()).hexdigest()
    )
    reloaded_sections = load_effective_system_sections(db, "mini")
    assert reloaded_sections[3].provenance.content_hash == (
        sections[3].provenance.content_hash
    )
    assert sections[4].provenance.effective_source == PromptSectionSource.MISSING

    composition = compose_clara_playbooks(
        db,
        "mini",
        desired_count=1,
        latency_profile="fast",
    )
    combined = composition.combined_playbook()
    assert combined.index("MARKDOWN INSTRUCTION.md") < combined.index(
        "SUPPORTING POSITIONING"
    )
    assert combined.count("MARKDOWN INSTRUCTION.md") == 1
    assert composition.supporting_knowledge_count == 1

    debug_json = json.dumps(composition.debug_metadata())
    assert published_content not in debug_json
    assert "mini:auto_adapt" in debug_json
    assert composition.debug_metadata()["runtime_contract_version"] == "1.0"
    assert composition.debug_metadata()["legacy_overlay_present"] is True
    db.rollback()
    db.close()

from hashlib import sha256

import pytest
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import sessionmaker

from app.models.ai_persona_config_version import AIPersonaConfigVersion


def persona_version(
    *,
    version_number: int,
    status: str,
    variant: str = "mini",
    section_key: str = "personality_mode",
) -> AIPersonaConfigVersion:
    content = f"Persona version {version_number}"
    return AIPersonaConfigVersion(
        variant=variant,
        section_key=section_key,
        version_number=version_number,
        status=status,
        content=content,
        content_sha256=sha256(content.encode("utf-8")).hexdigest(),
    )


def test_persona_versions_allow_history_but_only_one_published(
    db_session_factory: sessionmaker,
) -> None:
    db = db_session_factory()
    db.add_all(
        [
            persona_version(version_number=1, status="archived"),
            persona_version(version_number=2, status="published"),
            persona_version(version_number=3, status="draft"),
        ]
    )
    db.commit()

    db.add(persona_version(version_number=4, status="published"))
    with pytest.raises(IntegrityError):
        db.commit()
    db.rollback()
    db.close()


@pytest.mark.parametrize(
    ("field", "value"),
    [
        ("variant", "unknown"),
        ("section_key", "python_source"),
        ("status", "active"),
        ("version_number", 0),
    ],
)
def test_persona_version_rejects_invalid_contract_values(
    db_session_factory: sessionmaker,
    field: str,
    value: str | int,
) -> None:
    db = db_session_factory()
    entry = persona_version(version_number=1, status="draft")
    setattr(entry, field, value)
    db.add(entry)

    with pytest.raises(IntegrityError):
        db.commit()
    db.rollback()
    db.close()

from unittest.mock import Mock

from sqlalchemy.exc import SQLAlchemyError

from app.services.clara_playbook_service import (
    load_clara_system_instruction_playbook,
    load_effective_clara_system_instruction_playbook,
)


def test_persona_runtime_falls_back_to_markdown_when_database_is_unavailable() -> None:
    db = Mock()
    db.scalars.side_effect = SQLAlchemyError("database unavailable")

    effective = load_effective_clara_system_instruction_playbook(db, "mini")

    assert effective == load_clara_system_instruction_playbook("mini")
    db.rollback.assert_called_once()

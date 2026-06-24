from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import pytest

from app.core.config import Settings, is_placeholder_env_value


REPO_ROOT = Path(__file__).resolve().parents[2]


def test_backend_env_example_uses_safe_placeholders() -> None:
    env_example = (REPO_ROOT / "clara-backend" / ".env.example").read_text(
        encoding="utf-8"
    )

    assert "sk-proj-" not in env_example
    assert "4801fff3" not in env_example
    assert "test-sgcc-key-local" not in env_example
    assert "OwnerPass123!" not in env_example
    assert "OPENAI_API_KEY=OPENAI_API_KEY_PLACEHOLDER" in env_example
    assert "JWT_SECRET_KEY=CHANGE_ME_TO_A_LONG_RANDOM_SECRET" in env_example


def test_known_placeholder_values_are_treated_as_non_secret() -> None:
    assert is_placeholder_env_value("OPENAI_API_KEY_PLACEHOLDER")
    assert is_placeholder_env_value("SGCC_INTEGRATION_API_KEY_PLACEHOLDER")
    assert is_placeholder_env_value("sk-REPLACE_ME")
    assert is_placeholder_env_value("replace_with_your_openai_api_key")


def test_production_settings_reject_placeholder_openai_api_key() -> None:
    with pytest.raises(ValueError):
        Settings(
            app_env="production",
            database_url="sqlite://",
            jwt_secret_key="SOME_REAL_SECRET_0000000000000000000000000000000000",
            openai_api_key="sk-REPLACE_ME",
        )


def test_production_settings_reject_placeholder_jwt_secret() -> None:
    with pytest.raises(ValueError):
        Settings(
            app_env="production",
            database_url="sqlite://",
            jwt_secret_key="CHANGE_ME_TO_A_LONG_RANDOM_SECRET",
        )


def test_production_settings_reject_missing_openai_api_key() -> None:
    with pytest.raises(ValueError):
        Settings(
            app_env="production",
            database_url="sqlite://",
            jwt_secret_key="CHANGE_ME_TO_A_LONG_RANDOM_SECRET_000000000000000000000000000000000000000000",
        )

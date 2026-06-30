from pathlib import Path
import sys
import json

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import pytest

from app.core.config import (
    Settings,
    is_placeholder_env_value,
    read_env_file_value,
)


REPO_ROOT = Path(__file__).resolve().parents[2]


def has_real_openai_key_in_local_environment() -> bool:
    env_value = read_env_file_value(REPO_ROOT / "clara-backend" / ".env", "OPENAI_API_KEY")
    if env_value and not is_placeholder_env_value(env_value):
        return True

    current_env = __import__("os").environ.get("OPENAI_API_KEY")
    return bool(current_env and not is_placeholder_env_value(current_env))


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


def test_production_settings_reject_placeholder_openai_api_key(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    if has_real_openai_key_in_local_environment():
        pytest.skip("Local environment menyediakan OPENAI_API_KEY non-placeholder.")

    monkeypatch.setenv("APP_ENV", "production")
    monkeypatch.setenv(
        "JWT_SECRET_KEY",
        "SOME_REAL_SECRET_0000000000000000000000000000000000",
    )
    monkeypatch.setenv("OPENAI_API_KEY", "sk-REPLACE_ME")
    with pytest.raises(ValueError):
        settings = Settings(database_url="sqlite://", _env_file=None)
        settings.model_post_init(None)


def test_production_settings_reject_placeholder_jwt_secret(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("APP_ENV", "production")
    monkeypatch.setenv("JWT_SECRET_KEY", "CHANGE_ME_TO_A_LONG_RANDOM_SECRET")
    monkeypatch.setenv("OPENAI_API_KEY", "sk-test-realistic-non-placeholder")
    with pytest.raises(ValueError):
        settings = Settings(database_url="sqlite://", _env_file=None)
        settings.model_post_init(None)


def test_production_settings_reject_missing_openai_api_key(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    if has_real_openai_key_in_local_environment():
        pytest.skip("Local environment menyediakan OPENAI_API_KEY non-placeholder.")

    monkeypatch.setenv("APP_ENV", "production")
    monkeypatch.setenv(
        "JWT_SECRET_KEY",
        "CHANGE_ME_TO_A_LONG_RANDOM_SECRET_000000000000000000000000000000000000000000",
    )
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)
    with pytest.raises(ValueError):
        settings = Settings(database_url="sqlite://", _env_file=None)
        settings.model_post_init(None)


def test_extension_manifest_uses_minimal_social_dm_host_permissions() -> None:
    package_json = json.loads(
        (REPO_ROOT / "clara-extension" / "package.json").read_text(encoding="utf-8")
    )

    manifest = package_json["manifest"]
    host_permissions = set(manifest["host_permissions"])

    assert "<all_urls>" not in host_permissions
    assert "https://web.whatsapp.com/*" in host_permissions
    assert "https://www.instagram.com/*" in host_permissions
    assert "https://www.tiktok.com/*" in host_permissions
    assert "https://clara.newsmaker.id/*" in host_permissions


@pytest.mark.parametrize(
    "relative_path",
    [
        "clara-extension/utils/channel-adapters/instagram-adapter.ts",
        "clara-extension/utils/channel-adapters/tiktok-adapter.ts",
    ],
)
def test_social_dm_adapters_do_not_access_platform_storage_or_raw_html(
    relative_path: str,
) -> None:
    source = (REPO_ROOT / relative_path).read_text(encoding="utf-8")

    forbidden_snippets = [
        "localStorage",
        "sessionStorage",
        "document.cookie",
        "chrome.cookies",
        "outerHTML",
        "innerHTML",
        "<all_urls>",
    ]

    for snippet in forbidden_snippets:
        assert snippet not in source

from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


PLACEHOLDER_ENV_VALUES = {
    "",
    "API_KEY_KAMU",
    "OPENAI_API_KEY_KAMU",
    "YOUR_OPENAI_API_KEY",
    "test-key",
    "OPENAI_API_KEY_PLACEHOLDER",
    "SGCC_INTEGRATION_API_KEY_PLACEHOLDER",
    "CHANGE_ME_TO_A_LONG_RANDOM_SECRET",
    "CHANGE_ME_TEMP_OWNER_PASSWORD",
}


def is_placeholder_env_value(value: str | None) -> bool:
    return (value or "").strip() in PLACEHOLDER_ENV_VALUES


def read_env_file_value(env_file_path: Path, key: str) -> str | None:
    if not env_file_path.exists():
        return None

    for line in env_file_path.read_text(encoding="utf-8").splitlines():
        trimmed_line = line.strip()

        if not trimmed_line or trimmed_line.startswith("#") or "=" not in trimmed_line:
            continue

        current_key, raw_value = trimmed_line.split("=", 1)

        if current_key.strip() != key:
            continue

        normalized_value = raw_value.strip().strip("\"'")
        return normalized_value or None

    return None


class Settings(BaseSettings):
    app_env: str = "development"
    database_url: str
    redis_url: str = "redis://localhost:6379/0"
    sgcc_integration_api_key: str | None = None
    sgcc_integration_rate_limit_per_minute: int = 30

    openai_api_key: str | None = None
    openai_model: str = "gpt-4.1-mini"
    openai_fast_reply_model: str = "gpt-4.1-mini"
    openai_ultra_fast_reply_model: str = "gpt-4.1-mini"
    openai_ultra_fast_reply_max_output_tokens: int = 120
    openai_fast_reply_max_output_tokens: int = 180
    openai_single_reply_max_output_tokens: int = 260

    jwt_secret_key: str
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 1440
    auth_cookie_name: str = "clara_access_token"
    csrf_cookie_name: str = "clara_csrf_token"
    auth_cookie_domain: str | None = None
    auth_cookie_samesite: str | None = None

    allowed_origins: str = "http://localhost:3000,http://127.0.0.1:3000"
    login_rate_limit_per_minute: int = 5

    bootstrap_owner_name: str | None = None
    bootstrap_owner_email: str | None = None
    bootstrap_owner_password: str | None = None
    bootstrap_organization_name: str | None = None
    bootstrap_organization_slug: str | None = None
    clara_knowledge_owner_email: str | None = None
    clara_knowledge_dir: str | None = None
    whatsapp_meta_verify_token: str | None = None
    whatsapp_meta_app_secret: str | None = None
    whatsapp_meta_default_organization_slug: str | None = None
    whatsapp_meta_default_sales_user_email: str | None = None
    conversation_auto_archive_days: int = 7

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
    )

    def model_post_init(self, __context: object) -> None:
        env_file_path = Path(self.model_config.get("env_file", ".env"))
        env_file_openai_key = read_env_file_value(env_file_path, "OPENAI_API_KEY")

        if is_placeholder_env_value(self.openai_api_key) and env_file_openai_key:
            if not is_placeholder_env_value(env_file_openai_key):
                object.__setattr__(self, "openai_api_key", env_file_openai_key)
                return

        if is_placeholder_env_value(self.openai_api_key):
            object.__setattr__(self, "openai_api_key", None)

        if self.app_env.lower() == "production" and is_placeholder_env_value(
            self.jwt_secret_key
        ):
            raise ValueError(
                "JWT_SECRET_KEY tidak boleh memakai placeholder saat APP_ENV=production."
            )

    @property
    def allowed_origins_list(self) -> list[str]:
        return [
            origin.strip()
            for origin in self.allowed_origins.split(",")
            if origin.strip()
        ]

    @property
    def auth_cookie_secure(self) -> bool:
        return self.app_env.lower() == "production"

    @property
    def auth_cookie_samesite_value(self) -> str:
        if self.auth_cookie_samesite:
            normalized = self.auth_cookie_samesite.strip().lower()
            if normalized in {"lax", "strict", "none"}:
                return normalized

        return "none" if self.auth_cookie_secure else "lax"


settings = Settings()

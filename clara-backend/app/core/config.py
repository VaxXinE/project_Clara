from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_env: str = "development"
    database_url: str
    redis_url: str = "redis://localhost:6379/0"

    openai_api_key: str | None = None
    openai_model: str = "gpt-4.1-mini"

    jwt_secret_key: str
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 1440

    allowed_origins: str = "http://localhost:3000,http://127.0.0.1:3000"
    login_rate_limit_per_minute: int = 5

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
    )

    @property
    def allowed_origins_list(self) -> list[str]:
        return [
            origin.strip()
            for origin in self.allowed_origins.split(",")
            if origin.strip()
        ]


settings = Settings()
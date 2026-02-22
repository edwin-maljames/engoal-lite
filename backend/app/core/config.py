"""Application configuration loaded from environment variables via pydantic-settings."""

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    # Database
    DATABASE_URL: str

    # JWT / Auth
    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 15
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # App
    DEBUG: bool = False
    ALLOWED_ORIGINS: list[str] = ["http://localhost:3000"]

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    @field_validator("ALLOWED_ORIGINS", mode="before")
    @classmethod
    def parse_origins(cls, v: object) -> object:
        """Accept comma-separated string, JSON array string, or list."""
        if isinstance(v, str):
            v = v.strip()
            if v.startswith("["):
                import json  # noqa: PLC0415

                return json.loads(v)
            return [origin.strip() for origin in v.split(",") if origin.strip()]
        return v


# Singleton — import `settings` everywhere instead of re-instantiating
settings = Settings()

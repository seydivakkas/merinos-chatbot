"""Typed runtime settings with explicit local, test and production modes."""
from __future__ import annotations

from functools import lru_cache
from typing import Literal
from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="MERINOS_", env_file=".env", extra="ignore")

    environment: Literal["local", "test", "staging", "production"] = "local"
    session_backend: Literal["memory", "redis"] = "memory"
    redis_url: str = "redis://127.0.0.1:6379/0"
    redis_key_secret: str = "local-demo-redis-key-change-me"
    session_ttl_seconds: int = Field(default=1800, gt=0)
    session_absolute_ttl_seconds: int = Field(default=86400, gt=0)
    session_lock_ttl_ms: int = Field(default=15000, gt=0)
    session_lock_wait_ms: int = Field(default=2000, gt=0)
    idempotency_ttl_seconds: int = Field(default=3600, gt=0)
    max_session_bytes: int = Field(default=65536, gt=1024)

    context_window_tokens: int = Field(default=8192, gt=0)
    max_output_tokens: int = Field(default=800, gt=0)
    safety_margin_tokens: int = Field(default=512, ge=0)
    compression_trigger_ratio: float = Field(default=0.75, gt=0, le=1)
    recent_messages_to_keep: int = Field(default=8, gt=0)
    token_counter_mode: Literal["estimated", "provider"] = "estimated"

    database_url: str = "sqlite:///./.runtime/merinos.db"
    jwt_secret: str = "local-demo-jwt-secret-change-me"
    jwt_algorithm: str = "HS256"
    access_token_minutes: int = Field(default=60, gt=0)
    admin_email: str = "admin@merinos.local"
    admin_password: str = "ChangeMe123!"

    allowed_origins: str = "http://127.0.0.1:5173,http://localhost:5173,http://127.0.0.1:3000,http://localhost:3000"
    max_request_bytes: int = Field(default=65536, gt=1024)
    chat_rate_limit_per_minute: int = Field(default=30, gt=0)
    demo_mode: bool = True

    @field_validator("redis_key_secret", "jwt_secret")
    @classmethod
    def production_secret_guard(cls, value: str, info):
        return value

    @property
    def origins(self) -> list[str]:
        return [item.strip() for item in self.allowed_origins.split(",") if item.strip()]

    def validate_runtime(self) -> None:
        if self.environment == "production":
            if self.session_backend != "redis":
                raise ValueError("Production ortamında session_backend=redis zorunludur.")
            for name, value in (("redis_key_secret", self.redis_key_secret), ("jwt_secret", self.jwt_secret)):
                if "change-me" in value or len(value) < 32:
                    raise ValueError(f"Production ortamında güvenli {name} zorunludur.")
            if self.token_counter_mode != "provider":
                raise ValueError("Production ortamında gerçek provider tokenizer zorunludur.")
            if self.demo_mode:
                raise ValueError("Production ortamında demo_mode kapalı olmalıdır.")


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    settings = Settings()
    settings.validate_runtime()
    return settings

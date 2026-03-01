from pathlib import Path

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    # Load defaults from .env.example first, then let .env override.
    model_config = SettingsConfigDict(env_file=(".env.example", ".env"), env_file_encoding="utf-8")

    app_name: str = "autoLV API"
    cors_origins: str = Field(
        default="http://127.0.0.1:3000,http://localhost:3000",
        alias="CORS_ORIGINS",
    )
    database_url: str = Field(default="sqlite:///./autolv.db", alias="DATABASE_URL")

    jwt_secret_key: str = Field(default="change-me-access-key", alias="JWT_SECRET_KEY")
    jwt_refresh_secret_key: str = Field(
        default="change-me-refresh-key",
        alias="JWT_REFRESH_SECRET_KEY",
    )
    access_token_exp_minutes: int = Field(default=60, alias="ACCESS_TOKEN_EXP_MINUTES")
    refresh_token_exp_days: int = Field(default=14, alias="REFRESH_TOKEN_EXP_DAYS")

    cookie_secure: bool = Field(default=False, alias="COOKIE_SECURE")
    cookie_samesite: str = Field(default="lax", alias="COOKIE_SAMESITE")
    vworld_api_base_url: str = Field(default="https://api.vworld.kr", alias="VWORLD_API_BASE_URL")
    vworld_api_key: str = Field(default="", alias="VWORLD_API_KEY")
    vworld_api_domain: str = Field(default="localhost", alias="VWORLD_API_DOMAIN")
    vworld_timeout_seconds: int = Field(default=15, alias="VWORLD_TIMEOUT_SECONDS")
    road_name_file_path: str = Field(default="", alias="ROAD_NAME_FILE_PATH")


def _resolve_road_name_file_path(configured: str) -> str:
    candidates: list[Path] = []

    configured_path = Path(configured).expanduser() if configured else None
    if configured_path:
        candidates.append(configured_path)

    repo_root = Path(__file__).resolve().parents[4]
    candidates.extend(
        [
            repo_root / "docs" / "TN_SPRD_RDNM.txt",
            repo_root / "TN_SPRD_RDNM.txt",
            Path.cwd() / "docs" / "TN_SPRD_RDNM.txt",
            Path.cwd() / "TN_SPRD_RDNM.txt",
        ]
    )

    for candidate in candidates:
        if candidate.exists():
            return str(candidate.resolve())

    # Keep deterministic fallback even when file is missing.
    return str((repo_root / "docs" / "TN_SPRD_RDNM.txt").resolve())


settings = Settings()
settings.road_name_file_path = _resolve_road_name_file_path(settings.road_name_file_path)

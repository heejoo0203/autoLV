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
    ld_code_file_path: str = Field(default="", alias="LD_CODE_FILE_PATH")

    bulk_storage_dir: str = Field(default="./storage/bulk", alias="BULK_STORAGE_DIR")
    bulk_max_rows: int = Field(default=10000, alias="BULK_MAX_ROWS")
    profile_image_dir: str = Field(default="./storage/profile_images", alias="PROFILE_IMAGE_DIR")


def _normalize_database_url(database_url: str) -> str:
    value = (database_url or "").strip()
    if value.startswith("postgres://"):
        value = "postgresql://" + value[len("postgres://") :]
    if value.startswith("postgresql://"):
        value = "postgresql+psycopg://" + value[len("postgresql://") :]
    return value


def _resolve_project_root() -> Path:
    current = Path(__file__).resolve()
    ancestors = [current.parent, *current.parents]
    for candidate in ancestors:
        if (candidate / "apps").exists() or (candidate / "docs").exists():
            return candidate

    cwd = Path.cwd()
    if (cwd / "apps").exists() or (cwd / "docs").exists():
        return cwd

    return current.parent


def _resolve_road_name_file_path(configured: str) -> str:
    candidates: list[Path] = []

    configured_path = Path(configured).expanduser() if configured else None
    if configured_path:
        candidates.append(configured_path)

    repo_root = _resolve_project_root()
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


def _resolve_ld_code_file_path(configured: str) -> str:
    candidates: list[Path] = []

    configured_path = Path(configured).expanduser() if configured else None
    if configured_path:
        candidates.append(configured_path)

    repo_root = _resolve_project_root()
    candidates.extend(
        [
            repo_root / "apps" / "web" / "public" / "ld_codes.json",
            repo_root / "ld_codes.json",
            Path.cwd() / "apps" / "web" / "public" / "ld_codes.json",
            Path.cwd() / "ld_codes.json",
        ]
    )

    for candidate in candidates:
        if candidate.exists():
            return str(candidate.resolve())

    return str((repo_root / "apps" / "web" / "public" / "ld_codes.json").resolve())


settings = Settings()
settings.database_url = _normalize_database_url(settings.database_url)
settings.road_name_file_path = _resolve_road_name_file_path(settings.road_name_file_path)
settings.ld_code_file_path = _resolve_ld_code_file_path(settings.ld_code_file_path)

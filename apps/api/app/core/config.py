from pathlib import Path

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    # Load defaults from .env.example first, then let .env override.
    model_config = SettingsConfigDict(
        env_file=(".env.example", ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    app_name: str = "필지랩 API"
    cors_origins: str = Field(
        default="http://127.0.0.1:3000,http://localhost:3000",
        alias="CORS_ORIGINS",
    )
    cors_origin_regex: str = Field(default="", alias="CORS_ORIGIN_REGEX")
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
    vworld_retry_count: int = Field(default=2, alias="VWORLD_RETRY_COUNT")
    vworld_retry_backoff_seconds: float = Field(default=0.35, alias="VWORLD_RETRY_BACKOFF_SECONDS")
    vworld_user_agent: str = Field(
        default="PiljiLab/1.0 (+https://auto-lv.vercel.app)",
        alias="VWORLD_USER_AGENT",
    )
    vworld_referer: str = Field(default="https://auto-lv.vercel.app", alias="VWORLD_REFERER")
    vworld_proxy_url: str = Field(default="", alias="VWORLD_PROXY_URL")
    vworld_proxy_token: str = Field(default="", alias="VWORLD_PROXY_TOKEN")
    bld_hub_api_base_url: str = Field(
        default="https://apis.data.go.kr/1613000/BldRgstHubService",
        alias="BLD_HUB_API_BASE_URL",
    )
    bld_hub_service_key: str = Field(default="", alias="BLD_HUB_SERVICE_KEY")
    bld_hub_timeout_seconds: int = Field(default=20, alias="BLD_HUB_TIMEOUT_SECONDS")
    bld_hub_retry_count: int = Field(default=2, alias="BLD_HUB_RETRY_COUNT")
    bld_hub_retry_backoff_seconds: float = Field(default=0.3, alias="BLD_HUB_RETRY_BACKOFF_SECONDS")
    road_name_file_path: str = Field(default="", alias="ROAD_NAME_FILE_PATH")
    ld_code_file_path: str = Field(default="", alias="LD_CODE_FILE_PATH")

    bulk_storage_dir: str = Field(default="./storage/bulk", alias="BULK_STORAGE_DIR")
    bulk_max_rows: int = Field(default=10000, alias="BULK_MAX_ROWS")
    bulk_execution_mode: str = Field(default="queue", alias="BULK_EXECUTION_MODE")
    bulk_queue_name: str = Field(default="piljilab:bulk:jobs", alias="BULK_QUEUE_NAME")
    bulk_queue_processing_name: str = Field(
        default="piljilab:bulk:jobs:processing",
        alias="BULK_QUEUE_PROCESSING_NAME",
    )
    bulk_worker_poll_seconds: int = Field(default=5, alias="BULK_WORKER_POLL_SECONDS")
    bulk_lookup_workers: int = Field(default=6, alias="BULK_LOOKUP_WORKERS")
    bulk_progress_update_min_seconds: float = Field(default=1.0, alias="BULK_PROGRESS_UPDATE_MIN_SECONDS")
    profile_image_dir: str = Field(default="./storage/profile_images", alias="PROFILE_IMAGE_DIR")
    admin_seed_email: str = Field(default="", alias="ADMIN_SEED_EMAIL")
    admin_seed_password: str = Field(default="", alias="ADMIN_SEED_PASSWORD")
    admin_seed_name: str = Field(default="admin", alias="ADMIN_SEED_NAME")
    redis_url: str = Field(default="", alias="REDIS_URL")
    redis_pnu_ttl_seconds: int = Field(default=86400, alias="REDIS_PNU_TTL_SECONDS")
    map_price_cache_ttl_seconds: int = Field(default=86400, alias="MAP_PRICE_CACHE_TTL_SECONDS")
    map_nearby_radius_m: int = Field(default=200, alias="MAP_NEARBY_RADIUS_M")
    map_zone_overlap_threshold: float = Field(default=0.9, alias="MAP_ZONE_OVERLAP_THRESHOLD")
    map_zone_max_vertices: int = Field(default=100, alias="MAP_ZONE_MAX_VERTICES")
    map_zone_max_area_sqm: float = Field(default=5_000_000, alias="MAP_ZONE_MAX_AREA_SQM")
    map_zone_query_timeout_ms: int = Field(default=30_000, alias="MAP_ZONE_QUERY_TIMEOUT_MS")
    map_zone_vworld_page_size: int = Field(default=1000, alias="MAP_ZONE_VWORLD_PAGE_SIZE")
    map_zone_vworld_max_pages: int = Field(default=50, alias="MAP_ZONE_VWORLD_MAX_PAGES")
    map_zone_max_included_parcels: int = Field(default=3000, alias="MAP_ZONE_MAX_INCLUDED_PARCELS")
    map_zone_bbox_split_max_depth: int = Field(default=4, alias="MAP_ZONE_BBOX_SPLIT_MAX_DEPTH")
    map_zone_land_metadata_sync_limit: int = Field(default=80, alias="MAP_ZONE_LAND_METADATA_SYNC_LIMIT")
    map_zone_land_metadata_workers: int = Field(default=6, alias="MAP_ZONE_LAND_METADATA_WORKERS")
    map_zone_aged_building_years: int = Field(default=30, alias="MAP_ZONE_AGED_BUILDING_YEARS")
    map_zone_undersized_parcel_threshold_sqm: float = Field(
        default=90.0,
        alias="MAP_ZONE_UNDERSIZED_PARCEL_THRESHOLD_SQM",
    )
    map_zone_building_cache_ttl_hours: int = Field(default=720, alias="MAP_ZONE_BUILDING_CACHE_TTL_HOURS")
    map_zone_building_workers: int = Field(default=10, alias="MAP_ZONE_BUILDING_WORKERS")
    map_zone_ai_enabled: bool = Field(default=True, alias="MAP_ZONE_AI_ENABLED")
    map_zone_ai_include_threshold: float = Field(default=0.82, alias="MAP_ZONE_AI_INCLUDE_THRESHOLD")
    map_zone_ai_uncertain_threshold: float = Field(default=0.55, alias="MAP_ZONE_AI_UNCERTAIN_THRESHOLD")

    email_verification_exp_minutes: int = Field(default=10, alias="EMAIL_VERIFICATION_EXP_MINUTES")
    email_verification_max_attempts: int = Field(default=5, alias="EMAIL_VERIFICATION_MAX_ATTEMPTS")
    email_debug_return_code: bool = Field(default=True, alias="EMAIL_DEBUG_RETURN_CODE")

    mail_delivery_mode: str = Field(default="console", alias="MAIL_DELIVERY_MODE")
    mail_from: str = Field(default="no-reply@autolv.local", alias="MAIL_FROM")
    smtp_host: str = Field(default="", alias="SMTP_HOST")
    smtp_port: int = Field(default=587, alias="SMTP_PORT")
    smtp_user: str = Field(default="", alias="SMTP_USER")
    smtp_password: str = Field(default="", alias="SMTP_PASSWORD")
    smtp_use_tls: bool = Field(default=True, alias="SMTP_USE_TLS")
    smtp_use_ssl: bool = Field(default=False, alias="SMTP_USE_SSL")


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

    # 1) Monorepo root 우선 탐색
    for candidate in ancestors:
        if (candidate / "apps").exists() or (candidate / "docs").exists():
            return candidate

    # 2) API 단독 배포 루트 탐색
    for candidate in ancestors:
        if (candidate / "alembic.ini").exists() or ((candidate / "app").is_dir() and (candidate / "scripts").is_dir()):
            return candidate

    cwd = Path.cwd()
    if (cwd / "apps").exists() or (cwd / "docs").exists():
        return cwd
    if (cwd / "alembic.ini").exists() or ((cwd / "app").is_dir() and (cwd / "scripts").is_dir()):
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
            repo_root / "apps" / "api" / "TN_SPRD_RDNM.txt",
            repo_root / "TN_SPRD_RDNM.txt",
            repo_root / "app" / "data" / "TN_SPRD_RDNM.txt",
            Path.cwd() / "docs" / "TN_SPRD_RDNM.txt",
            Path.cwd() / "apps" / "api" / "TN_SPRD_RDNM.txt",
            Path.cwd() / "TN_SPRD_RDNM.txt",
            Path.cwd() / "app" / "data" / "TN_SPRD_RDNM.txt",
        ]
    )

    for candidate in candidates:
        if candidate.exists():
            return str(candidate.resolve())

    # Keep deterministic fallback even when file is missing.
    return str((repo_root / "apps" / "api" / "TN_SPRD_RDNM.txt").resolve())


def _resolve_ld_code_file_path(configured: str) -> str:
    candidates: list[Path] = []

    configured_path = Path(configured).expanduser() if configured else None
    if configured_path:
        candidates.append(configured_path)

    repo_root = _resolve_project_root()
    candidates.extend(
        [
            repo_root / "apps" / "web" / "public" / "ld_codes.json",
            repo_root / "apps" / "api" / "ld_codes.json",
            repo_root / "apps" / "api" / "app" / "data" / "ld_codes.json",
            repo_root / "ld_codes.json",
            repo_root / "app" / "data" / "ld_codes.json",
            Path.cwd() / "apps" / "web" / "public" / "ld_codes.json",
            Path.cwd() / "apps" / "api" / "ld_codes.json",
            Path.cwd() / "apps" / "api" / "app" / "data" / "ld_codes.json",
            Path.cwd() / "ld_codes.json",
            Path.cwd() / "app" / "data" / "ld_codes.json",
        ]
    )

    for candidate in candidates:
        if candidate.exists():
            return str(candidate.resolve())

    return str((repo_root / "apps" / "api" / "ld_codes.json").resolve())


settings = Settings()
settings.database_url = _normalize_database_url(settings.database_url)
settings.road_name_file_path = _resolve_road_name_file_path(settings.road_name_file_path)
settings.ld_code_file_path = _resolve_ld_code_file_path(settings.ld_code_file_path)

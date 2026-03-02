import json
import re
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy import inspect, text

from app.api.auth import router as auth_router
from app.api.bulk import router as bulk_router
from app.api.health import router as health_router
from app.api.history import router as history_router
from app.api.land import router as land_router
from app.core.config import settings
from app.db.session import engine


def _is_sqlite() -> bool:
    return settings.database_url.startswith("sqlite")


def _create_tables_for_sqlite() -> None:
    # Import models before metadata creation.
    from app import models  # noqa: F401
    from app.db.base import Base

    Base.metadata.create_all(bind=engine)


def _migrate_sqlite_schema() -> None:
    with engine.begin() as conn:
        inspector = inspect(conn)
        if "users" in inspector.get_table_names():
            columns = {col["name"] for col in inspector.get_columns("users")}
            if "profile_image_path" not in columns:
                conn.execute(text("ALTER TABLE users ADD COLUMN profile_image_path VARCHAR(500)"))


def _verify_database_connection() -> None:
    with engine.connect() as conn:
        conn.execute(text("SELECT 1"))


def _ensure_runtime_dirs() -> None:
    Path(settings.profile_image_dir).resolve().mkdir(parents=True, exist_ok=True)


def _parse_cors_origins(raw: str) -> list[str]:
    value = (raw or "").strip()
    if not value:
        return []

    parsed_values: list[str] = []
    if value.startswith("["):
        try:
            payload = json.loads(value)
            if isinstance(payload, list):
                parsed_values = [str(item) for item in payload if str(item).strip()]
        except json.JSONDecodeError:
            parsed_values = []

    if not parsed_values:
        parsed_values = [item for item in re.split(r"[,\n;]+", value) if item.strip()]

    normalized: list[str] = []
    for item in parsed_values:
        origin = item.strip().strip("'").strip('"').rstrip("/")
        if origin:
            normalized.append(origin)
    return normalized


_ensure_runtime_dirs()
app = FastAPI(title=settings.app_name, version="0.3.0")
allow_origins = _parse_cors_origins(settings.cors_origins)
allow_origin_regex = settings.cors_origin_regex.strip() or None

app.add_middleware(
    CORSMiddleware,
    allow_origins=allow_origins,
    allow_origin_regex=allow_origin_regex,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health_router)
app.include_router(auth_router)
app.include_router(land_router)
app.include_router(bulk_router)
app.include_router(history_router)
app.mount(
    "/media/profile",
    StaticFiles(directory=str(Path(settings.profile_image_dir).resolve())),
    name="profile-media",
)


@app.on_event("startup")
def on_startup() -> None:
    _ensure_runtime_dirs()
    if _is_sqlite():
        _create_tables_for_sqlite()
        _migrate_sqlite_schema()
    else:
        # PostgreSQL/MySQL 등 운영 DB는 Alembic 마이그레이션을 선행한다.
        _verify_database_connection()


@app.get("/")
def read_root() -> dict:
    return {"service": "autoLV-api", "status": "ok"}

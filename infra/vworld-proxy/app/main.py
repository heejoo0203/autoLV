from __future__ import annotations

from typing import Any
from urllib.parse import urlencode

import requests
from fastapi import FastAPI, Header, HTTPException, status
from pydantic import BaseModel
from pydantic_settings import BaseSettings, SettingsConfigDict
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

    app_name: str = "autoLV VWorld Proxy"
    host: str = "0.0.0.0"
    port: int = 8080

    vworld_api_base_url: str = "https://api.vworld.kr"
    vworld_api_key: str = ""
    vworld_api_domain: str = "https://auto-lv.vercel.app"
    vworld_user_agent: str = "Mozilla/5.0"
    vworld_referer: str = "https://auto-lv.vercel.app"

    proxy_token: str = ""
    timeout_seconds: int = 20
    retry_count: int = 4
    retry_backoff_seconds: float = 0.5
    allowed_path_prefixes: str = "/ned,/req/address,/req/data"


settings = Settings()
app = FastAPI(title=settings.app_name, version="1.0.0")
_session: requests.Session | None = None


class ProxyRequest(BaseModel):
    path: str
    params: dict[str, Any] = {}


@app.get("/health")
def health() -> dict[str, str]:
    return {"service": "vworld-proxy", "status": "ok"}


@app.get("/egress-ip")
def egress_ip(x_vworld_proxy_token: str | None = Header(default=None)) -> dict[str, Any]:
    _assert_token(x_vworld_proxy_token)
    try:
        response = _get_session().get("https://api64.ipify.org", params={"format": "json"}, timeout=10)
        response.raise_for_status()
        return {"public_ip": response.json().get("ip", "")}
    except requests.RequestException as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail={"code": "EGRESS_IP_FAILED", "message": f"공인 IP 조회 실패: {exc}"},
        ) from exc


@app.post("/vworld-proxy")
def vworld_proxy(payload: ProxyRequest, x_vworld_proxy_token: str | None = Header(default=None)) -> Any:
    _assert_token(x_vworld_proxy_token)

    if not settings.vworld_api_key.strip():
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={"code": "KEY_MISSING", "message": "VWORLD_API_KEY 설정이 필요합니다."},
        )

    path = payload.path.strip()
    _validate_path(path)

    query_params: dict[str, str] = {}
    for key, value in payload.params.items():
        if value is None:
            continue
        query_params[key] = str(value)
    query_params["key"] = settings.vworld_api_key
    if settings.vworld_api_domain.strip():
        query_params["domain"] = settings.vworld_api_domain.strip()

    query = urlencode(query_params, doseq=True)
    target_url = f"{settings.vworld_api_base_url.rstrip('/')}{path}?{query}"

    headers = {
        "Accept": "application/json",
        "User-Agent": settings.vworld_user_agent,
        "Referer": settings.vworld_referer,
        "Connection": "close",
    }

    try:
        response = _get_session().get(target_url, headers=headers, timeout=settings.timeout_seconds)
    except requests.RequestException as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail={"code": "VWORLD_UNREACHABLE", "message": f"VWorld 연결 실패: {exc}"},
        ) from exc

    content_type = (response.headers.get("content-type") or "").lower()
    if "application/json" in content_type:
        try:
            return response.json()
        except ValueError:
            return {"raw": response.text, "status_code": response.status_code}

    # VWorld가 HTML/Plain 응답을 보내는 경우도 그대로 전달한다.
    return {"raw": response.text, "status_code": response.status_code}


def _assert_token(received_token: str | None) -> None:
    expected = settings.proxy_token.strip()
    if not expected:
        return
    if (received_token or "").strip() != expected:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"code": "UNAUTHORIZED", "message": "유효하지 않은 프록시 토큰입니다."},
        )


def _validate_path(path: str) -> None:
    if not path.startswith("/") or "://" in path:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "INVALID_PATH", "message": "유효하지 않은 VWorld 경로입니다."},
        )

    prefixes = [item.strip() for item in settings.allowed_path_prefixes.split(",") if item.strip()]
    if prefixes and not any(path.startswith(prefix) for prefix in prefixes):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "DISALLOWED_PATH", "message": "허용되지 않은 VWorld 경로입니다."},
        )


def _get_session() -> requests.Session:
    global _session
    if _session is not None:
        return _session

    retries = Retry(
        total=max(0, settings.retry_count),
        connect=max(0, settings.retry_count),
        read=max(0, settings.retry_count),
        status=max(0, settings.retry_count),
        other=max(0, settings.retry_count),
        backoff_factor=max(0.0, settings.retry_backoff_seconds),
        status_forcelist=(429, 500, 502, 503, 504),
        allowed_methods=frozenset(["GET"]),
        raise_on_status=False,
    )
    adapter = HTTPAdapter(max_retries=retries, pool_connections=10, pool_maxsize=20)

    session = requests.Session()
    session.mount("http://", adapter)
    session.mount("https://", adapter)
    _session = session
    return session

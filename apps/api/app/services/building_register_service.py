from __future__ import annotations

from collections import Counter
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Any
from urllib.parse import unquote

import requests
from requests.adapters import HTTPAdapter
from sqlalchemy.exc import OperationalError, ProgrammingError
from sqlalchemy.orm import Session
from urllib3.util.retry import Retry

from app.core.config import settings
from app.models.building_register_cache import BuildingRegisterCache

_BUILDING_SESSION: requests.Session | None = None

_RESIDENTIAL_KEYWORDS = ("주택", "아파트", "다세대", "연립", "다가구", "공동주택", "오피스텔", "기숙사")


@dataclass
class BuildingRegisterMetrics:
    pnu: str
    source_pnu: str | None = None
    has_building_register: bool = False
    building_count: int = 0
    aged_building_count: int = 0
    residential_building_count: int = 0
    approval_year_sum: int = 0
    approval_year_count: int = 0
    average_approval_year: int | None = None
    total_floor_area_sqm: float | None = None
    site_area_sqm: float | None = None
    floor_area_ratio: float | None = None
    building_coverage_ratio: float | None = None
    household_count: int | None = None
    primary_purpose_name: str | None = None


@dataclass
class BuildingRegisterBatchResult:
    metrics_by_pnu: dict[str, BuildingRegisterMetrics]
    ready: bool
    message: str | None


def fetch_building_register_metrics_batch(
    db: Session,
    *,
    parcel_area_by_pnu: dict[str, float],
) -> BuildingRegisterBatchResult:
    unique_pnu_list = [pnu for pnu in dict.fromkeys(parcel_area_by_pnu.keys()) if pnu]
    if not unique_pnu_list:
        return BuildingRegisterBatchResult(metrics_by_pnu={}, ready=True, message=None)

    if not _is_building_api_configured():
        return BuildingRegisterBatchResult(
            metrics_by_pnu={pnu: BuildingRegisterMetrics(pnu=pnu) for pnu in unique_pnu_list},
            ready=False,
            message="건축물대장 API 키가 설정되지 않아 노후도/용적률 분석을 생략했습니다.",
        )

    now = datetime.now(timezone.utc)
    freshness_cutoff = now - timedelta(hours=max(1, settings.map_zone_building_cache_ttl_hours))
    try:
        cache_rows = (
            db.query(BuildingRegisterCache)
            .filter(
                BuildingRegisterCache.pnu.in_(unique_pnu_list),
                BuildingRegisterCache.synced_at >= freshness_cutoff,
            )
            .all()
        )
    except (ProgrammingError, OperationalError):
        db.rollback()
        cache_rows = []
    metrics_by_pnu = {
        row.pnu: _cache_row_to_metrics(row)
        for row in cache_rows
        if bool(row.has_building_register)
    }

    missing_pnu_list = [pnu for pnu in unique_pnu_list if pnu not in metrics_by_pnu]
    if not missing_pnu_list:
        return BuildingRegisterBatchResult(metrics_by_pnu=metrics_by_pnu, ready=True, message=None)

    errors: list[str] = []
    fetched_rows: list[BuildingRegisterCache] = []
    max_workers = max(1, min(settings.map_zone_building_workers, len(missing_pnu_list), 4))
    with ThreadPoolExecutor(max_workers=max_workers) as executor:
        future_map = {
            executor.submit(
                _fetch_building_register_metrics_for_pnu,
                pnu,
                parcel_area_by_pnu.get(pnu),
            ): pnu
            for pnu in missing_pnu_list
        }
        for future in as_completed(future_map):
            pnu = future_map[future]
            try:
                metrics = future.result()
                metrics_by_pnu[pnu] = metrics
                if metrics.has_building_register and (metrics.source_pnu is None or metrics.source_pnu == metrics.pnu):
                    fetched_rows.append(_metrics_to_cache_row(metrics, now=now))
            except Exception:
                errors.append(pnu)

    if errors:
        retry_errors = list(errors)
        errors = []
        for pnu in retry_errors:
            try:
                metrics = _fetch_building_register_metrics_for_pnu(pnu, parcel_area_by_pnu.get(pnu))
                metrics_by_pnu[pnu] = metrics
                if metrics.has_building_register and (metrics.source_pnu is None or metrics.source_pnu == metrics.pnu):
                    fetched_rows.append(_metrics_to_cache_row(metrics, now=now))
            except Exception:
                metrics_by_pnu[pnu] = BuildingRegisterMetrics(pnu=pnu)
                errors.append(pnu)

    try:
        for row in fetched_rows:
            existing = db.query(BuildingRegisterCache).filter(BuildingRegisterCache.pnu == row.pnu).first()
            if existing is None:
                db.add(row)
                continue
            existing.has_building_register = row.has_building_register
            existing.building_count = row.building_count
            existing.aged_building_count = row.aged_building_count
            existing.residential_building_count = row.residential_building_count
            existing.approval_year_sum = row.approval_year_sum
            existing.approval_year_count = row.approval_year_count
            existing.average_approval_year = row.average_approval_year
            existing.total_floor_area_sqm = row.total_floor_area_sqm
            existing.site_area_sqm = row.site_area_sqm
            existing.floor_area_ratio = row.floor_area_ratio
            existing.building_coverage_ratio = row.building_coverage_ratio
            existing.household_count = row.household_count
            existing.primary_purpose_name = row.primary_purpose_name
            existing.synced_at = row.synced_at
            existing.updated_at = row.updated_at
            db.add(existing)
        db.flush()
    except (ProgrammingError, OperationalError):
        db.rollback()

    inherited_count = sum(
        1
        for metrics in metrics_by_pnu.values()
        if metrics.has_building_register and metrics.source_pnu and metrics.source_pnu != metrics.pnu
    )
    missing_count = sum(1 for metrics in metrics_by_pnu.values() if not metrics.has_building_register)

    if errors:
        note = _compose_building_batch_note(inherited_count=inherited_count, missing_count=missing_count)
        base = f"건축물대장 일부 조회에 실패했습니다. ({len(errors)}필지)"
        return BuildingRegisterBatchResult(
            metrics_by_pnu=metrics_by_pnu,
            ready=False,
            message=f"{base} {note}".strip(),
        )
    return BuildingRegisterBatchResult(
        metrics_by_pnu=metrics_by_pnu,
        ready=True,
        message=_compose_building_batch_note(inherited_count=inherited_count, missing_count=missing_count),
    )


def _is_building_api_configured() -> bool:
    value = _normalized_service_key()
    return bool(value and value != "your-building-hub-service-key")


def _cache_row_to_metrics(row: BuildingRegisterCache) -> BuildingRegisterMetrics:
    return BuildingRegisterMetrics(
        pnu=row.pnu,
        source_pnu=row.pnu,
        has_building_register=bool(row.has_building_register),
        building_count=int(row.building_count or 0),
        aged_building_count=int(row.aged_building_count or 0),
        residential_building_count=int(row.residential_building_count or 0),
        approval_year_sum=int(row.approval_year_sum or 0),
        approval_year_count=int(row.approval_year_count or 0),
        average_approval_year=row.average_approval_year,
        total_floor_area_sqm=row.total_floor_area_sqm,
        site_area_sqm=row.site_area_sqm,
        floor_area_ratio=row.floor_area_ratio,
        building_coverage_ratio=row.building_coverage_ratio,
        household_count=row.household_count,
        primary_purpose_name=row.primary_purpose_name,
    )


def _metrics_to_cache_row(metrics: BuildingRegisterMetrics, *, now: datetime) -> BuildingRegisterCache:
    return BuildingRegisterCache(
        pnu=metrics.pnu,
        has_building_register=metrics.has_building_register,
        building_count=metrics.building_count,
        aged_building_count=metrics.aged_building_count,
        residential_building_count=metrics.residential_building_count,
        approval_year_sum=metrics.approval_year_sum,
        approval_year_count=metrics.approval_year_count,
        average_approval_year=metrics.average_approval_year,
        total_floor_area_sqm=metrics.total_floor_area_sqm,
        site_area_sqm=metrics.site_area_sqm,
        floor_area_ratio=metrics.floor_area_ratio,
        building_coverage_ratio=metrics.building_coverage_ratio,
        household_count=metrics.household_count,
        primary_purpose_name=metrics.primary_purpose_name,
        synced_at=now,
        updated_at=now,
    )


def _fetch_building_register_metrics_for_pnu(pnu: str, parcel_area_sqm: float | None) -> BuildingRegisterMetrics:
    source_pnu = pnu
    items = _fetch_building_items("getBrTitleInfo", pnu)
    if not items:
        items = _fetch_building_items("getBrRecapTitleInfo", pnu)

    if not items:
        fallback_pnu = _to_main_lot_pnu(pnu)
        if fallback_pnu != pnu:
            source_pnu = fallback_pnu
            items = _fetch_building_items("getBrTitleInfo", fallback_pnu)
            if not items:
                items = _fetch_building_items("getBrRecapTitleInfo", fallback_pnu)

    if not items:
        return BuildingRegisterMetrics(pnu=pnu)

    current_year = datetime.now(timezone.utc).year
    aged_threshold_year = current_year - max(1, settings.map_zone_aged_building_years)
    building_count = len(items)
    approval_years: list[int] = []
    purpose_names: list[str] = []
    total_floor_area_sqm = 0.0
    site_area_candidates: list[float] = []
    building_coverage_ratio_candidates: list[float] = []
    residential_building_count = 0
    aged_building_count = 0
    household_count_total = 0
    household_count_found = False

    for item in items:
        approval_year = _extract_approval_year(item)
        if approval_year is not None:
            approval_years.append(approval_year)
            if approval_year <= aged_threshold_year:
                aged_building_count += 1

        purpose_name = _extract_purpose_name(item)
        if purpose_name:
            purpose_names.append(purpose_name)
            if _is_residential_purpose(purpose_name):
                residential_building_count += 1

        total_area = _extract_total_floor_area(item)
        if total_area is not None and total_area > 0:
            total_floor_area_sqm += total_area

        site_area = _extract_site_area(item)
        if site_area is not None and site_area > 0:
            site_area_candidates.append(site_area)
        building_coverage_ratio = _extract_building_coverage_ratio(item)
        if building_coverage_ratio is not None:
            building_coverage_ratio_candidates.append(building_coverage_ratio)
        household_count = _extract_household_count(item)
        if household_count is not None:
            household_count_total += household_count
            household_count_found = True

    site_area_sqm = max(site_area_candidates) if site_area_candidates else (float(parcel_area_sqm) if parcel_area_sqm else None)
    average_approval_year = round(sum(approval_years) / len(approval_years)) if approval_years else None
    floor_area_ratio = None
    if site_area_sqm and site_area_sqm > 0 and total_floor_area_sqm > 0:
        floor_area_ratio = round((total_floor_area_sqm / site_area_sqm) * 100, 2)
    building_coverage_ratio = max(building_coverage_ratio_candidates) if building_coverage_ratio_candidates else None

    purpose_counter = Counter(name for name in purpose_names if name and name.strip())
    primary_purpose_name = purpose_counter.most_common(1)[0][0] if purpose_counter else None
    if not household_count_found and primary_purpose_name and _is_residential_purpose(primary_purpose_name):
        expos_items = _fetch_building_items("getBrExposInfo", source_pnu, num_of_rows=1000)
        inferred_household_count = _count_exclusive_units(expos_items)
        if inferred_household_count > 0:
            household_count_total = inferred_household_count
            household_count_found = True

    return BuildingRegisterMetrics(
        pnu=pnu,
        source_pnu=source_pnu,
        has_building_register=True,
        building_count=building_count,
        aged_building_count=aged_building_count,
        residential_building_count=residential_building_count,
        approval_year_sum=sum(approval_years),
        approval_year_count=len(approval_years),
        average_approval_year=average_approval_year,
        total_floor_area_sqm=round(total_floor_area_sqm, 2) if total_floor_area_sqm > 0 else None,
        site_area_sqm=round(site_area_sqm, 2) if site_area_sqm is not None else None,
        floor_area_ratio=floor_area_ratio,
        building_coverage_ratio=building_coverage_ratio,
        household_count=household_count_total if household_count_found else None,
        primary_purpose_name=primary_purpose_name,
    )


def _fetch_building_items(endpoint: str, pnu: str, *, num_of_rows: int = 100) -> list[dict[str, Any]]:
    plat_gb_cd = _to_building_plat_gb_cd(pnu[10])
    response = _call_building_hub_json(
        endpoint,
        {
            "sigunguCd": pnu[:5],
            "bjdongCd": pnu[5:10],
            "platGbCd": plat_gb_cd,
            "bun": pnu[11:15],
            "ji": pnu[15:19],
            "numOfRows": str(max(1, min(num_of_rows, 1000))),
            "pageNo": "1",
        },
    )
    body = response.get("body", {})
    items = body.get("items", {}).get("item", [])
    if isinstance(items, dict):
        return [items]
    if isinstance(items, list):
        return [item for item in items if isinstance(item, dict)]
    return []


def _to_building_plat_gb_cd(raw: str) -> str:
    normalized = (raw or "").strip()
    if normalized == "1":
        return "0"
    if normalized == "2":
        return "1"
    return normalized or "0"


def _to_main_lot_pnu(pnu: str) -> str:
    if len(pnu) != 19:
        return pnu
    ji = pnu[15:19]
    if ji == "0000":
        return pnu
    return f"{pnu[:15]}0000"


def _call_building_hub_json(endpoint: str, params: dict[str, str]) -> dict[str, Any]:
    session = _get_building_session()
    response = session.get(
        f"{settings.bld_hub_api_base_url.rstrip('/')}/{endpoint.lstrip('/')}",
        params={
            "serviceKey": _normalized_service_key(),
            "_type": "json",
            **params,
        },
        timeout=settings.bld_hub_timeout_seconds,
    )
    response.raise_for_status()
    payload = response.json()
    header = payload.get("response", {}).get("header", {})
    if str(header.get("resultCode", "")).strip() not in {"", "00"}:
        raise RuntimeError(str(header.get("resultMsg", "건축물대장 API 오류")).strip() or "건축물대장 API 오류")
    return payload.get("response", {})


def _normalized_service_key() -> str:
    value = settings.bld_hub_service_key.strip()
    if "%" in value:
        return unquote(value)
    return value


def _get_building_session() -> requests.Session:
    global _BUILDING_SESSION
    if _BUILDING_SESSION is not None:
        return _BUILDING_SESSION

    retry = Retry(
        total=max(0, settings.bld_hub_retry_count),
        backoff_factor=max(0.0, settings.bld_hub_retry_backoff_seconds),
        status_forcelist=(429, 500, 502, 503, 504),
        allowed_methods=frozenset({"GET"}),
    )
    adapter = HTTPAdapter(max_retries=retry, pool_connections=20, pool_maxsize=20)
    session = requests.Session()
    session.mount("https://", adapter)
    session.mount("http://", adapter)
    _BUILDING_SESSION = session
    return session


def _extract_approval_year(item: dict[str, Any]) -> int | None:
    text = str(item.get("useAprDay") or "").strip()
    if len(text) < 4 or not text[:4].isdigit():
        return None
    return int(text[:4])


def _extract_purpose_name(item: dict[str, Any]) -> str | None:
    for key in ("mainPurpsCdNm", "etcPurps"):
        value = str(item.get(key) or "").strip()
        if value:
            return value
    return None


def _extract_total_floor_area(item: dict[str, Any]) -> float | None:
    for key in ("totArea", "totDongTotArea", "vlRatEstmTotArea"):
        value = _to_positive_float(item.get(key))
        if value is not None:
            return value
    return None


def _extract_building_coverage_ratio(item: dict[str, Any]) -> float | None:
    for key in ("bcRat", "buildingCoverageRatio", "archAreaRatio"):
        value = _to_positive_float(item.get(key))
        if value is not None:
            return round(value, 2)
    return None


def _extract_household_count(item: dict[str, Any]) -> int | None:
    for key in ("hhldCnt", "householdCount", "fmlyCnt", "familyCount"):
        value = _to_non_negative_int(item.get(key))
        if value is not None:
            return value
    return None


def _extract_site_area(item: dict[str, Any]) -> float | None:
    return _to_positive_float(item.get("platArea"))


def _to_positive_float(value: Any) -> float | None:
    if value is None or value == "":
        return None
    try:
        parsed = float(value)
    except (TypeError, ValueError):
        return None
    if parsed <= 0:
        return None
    return parsed


def _to_non_negative_int(value: Any) -> int | None:
    if value is None or value == "":
        return None
    try:
        parsed = int(float(value))
    except (TypeError, ValueError):
        return None
    if parsed < 0:
        return None
    return parsed


def _count_exclusive_units(items: list[dict[str, Any]]) -> int:
    if not items:
        return 0
    unique_units: set[tuple[str, str]] = set()
    fallback_count = 0
    for item in items:
        dong = str(item.get("dongNm") or item.get("dongnm") or item.get("dong_name") or "").strip()
        ho = str(item.get("hoNm") or item.get("honm") or item.get("ho_name") or "").strip()
        if dong or ho:
            unique_units.add((dong, ho))
        else:
            fallback_count += 1
    return len(unique_units) if unique_units else fallback_count


def _is_residential_purpose(value: str) -> bool:
    return any(keyword in value for keyword in _RESIDENTIAL_KEYWORDS)


def _compose_building_batch_note(*, inherited_count: int, missing_count: int) -> str | None:
    notes: list[str] = []
    if inherited_count > 0:
        notes.append(f"직접 건축물대장이 없는 필지 {inherited_count}건은 대표 지번 기준으로 보정했습니다.")
    if missing_count > 0:
        notes.append(f"건축물대장이 연결되지 않은 필지 {missing_count}건은 건축 지표에서 제외했습니다.")
    if not notes:
        return None
    return " ".join(notes)

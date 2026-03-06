from __future__ import annotations

import csv
import io
import json
import re
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any

from fastapi import HTTPException, status
from fastapi.responses import Response
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.config import settings
from app.schemas.land import LandResultRow
from app.schemas.map import (
    MapAddressSearchRequest,
    MapClickRequest,
    MapLandDetailsResponse,
    MapLookupResponse,
    MapPriceRowsResponse,
)
from app.services.vworld_service import (
    call_vworld_json,
    compose_pnu,
    fetch_individual_land_price_rows,
    parse_level5_jibun,
)

try:
    from redis import Redis
    from redis.exceptions import RedisError

    _REDIS_AVAILABLE = True
except ModuleNotFoundError:  # pragma: no cover - optional dependency in local/dev
    Redis = Any  # type: ignore[assignment]

    class RedisError(Exception):
        pass

    _REDIS_AVAILABLE = False

_PRICE_DIGITS = re.compile(r"[^0-9]")
_PNU_PATTERN = re.compile(r"^\d{19}$")
_REDIS_CLIENT: Redis | None = None
_REDIS_DISABLED = False


def lookup_map_by_click(db: Session, payload: MapClickRequest) -> MapLookupResponse:
    _validate_lat_lng(payload.lat, payload.lng)

    pnu_data = _resolve_pnu_with_cache(payload.lat, payload.lng)
    pnu = pnu_data["pnu"]
    jibun_address = pnu_data.get("jibun_address", "").strip()
    road_address = pnu_data.get("road_address", "").strip()
    address_summary = (jibun_address or road_address or pnu_data.get("address_summary", "")).strip()

    cached = _find_cached_parcel(db, pnu)
    rows: list[LandResultRow] = []
    cache_hit = False

    if cached and _is_fresh(cached.get("updated_at")):
        area = _to_float(cached.get("area"))
        price_current = _to_int(cached.get("price_current"))
        price_previous = _to_int(cached.get("price_previous"))
        if area is None:
            details = _fetch_land_characteristics_latest(pnu)
            area = _extract_area_from_candidate(details)
            if area is not None:
                _upsert_parcel_snapshot(
                    db=db,
                    pnu=pnu,
                    lat=payload.lat,
                    lng=payload.lng,
                    area=area,
                    price_current=price_current,
                    price_previous=price_previous,
                )
        cache_hit = True
    else:
        rows = fetch_individual_land_price_rows(pnu)
        price_current = _parse_price(rows[0].개별공시지가) if rows else None
        price_previous = _parse_price(rows[1].개별공시지가) if len(rows) > 1 else None
        area = _fetch_parcel_area(pnu)
        _upsert_parcel_snapshot(
            db=db,
            pnu=pnu,
            lat=payload.lat,
            lng=payload.lng,
            area=area,
            price_current=price_current,
            price_previous=price_previous,
        )

    nearby_avg = _fetch_nearby_avg_price(db, pnu, payload.lat, payload.lng, settings.map_nearby_radius_m)
    growth_rate = _calculate_growth_rate(price_current, price_previous)
    estimated_total_price = _calculate_total_price(area, price_current)

    return MapLookupResponse(
        lat=payload.lat,
        lng=payload.lng,
        pnu=pnu,
        address_summary=address_summary,
        jibun_address=jibun_address,
        road_address=road_address,
        area=area,
        price_current=price_current,
        price_previous=price_previous,
        growth_rate=growth_rate,
        estimated_total_price=estimated_total_price,
        nearby_avg_price=nearby_avg,
        nearby_radius_m=settings.map_nearby_radius_m,
        cache_hit=cache_hit,
        rows=rows,
    )


def lookup_map_by_address(db: Session, payload: MapAddressSearchRequest) -> MapLookupResponse:
    address = payload.address.strip()
    if len(address) < 2:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "INVALID_ADDRESS_QUERY", "message": "주소를 2자 이상 입력해 주세요."},
        )
    point = _geocode_address(address)
    return lookup_map_by_click(db, MapClickRequest(lat=point["lat"], lng=point["lng"]))


def lookup_map_by_pnu(db: Session, pnu: str) -> MapLookupResponse:
    pnu = pnu.strip()
    if not _PNU_PATTERN.fullmatch(pnu):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "INVALID_PNU", "message": "PNU 형식이 올바르지 않습니다."},
        )

    if _is_postgres(db):
        row = db.execute(
            text(
                """
                SELECT
                  lat,
                  lng,
                  CASE WHEN geom IS NOT NULL THEN ST_Y(ST_Centroid(geom)) END AS geom_lat,
                  CASE WHEN geom IS NOT NULL THEN ST_X(ST_Centroid(geom)) END AS geom_lng
                FROM parcels
                WHERE pnu = :pnu
                """
            ),
            {"pnu": pnu},
        ).mappings().first()
    else:
        row = db.execute(
            text(
                """
                SELECT lat, lng
                FROM parcels
                WHERE pnu = :pnu
                """
            ),
            {"pnu": pnu},
        ).mappings().first()

    if not row:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "PARCEL_NOT_FOUND", "message": "해당 PNU의 좌표 데이터가 없습니다."},
        )

    lat = _to_float(row.get("lat")) or _to_float(row.get("geom_lat"))
    lng = _to_float(row.get("lng")) or _to_float(row.get("geom_lng"))
    if lat is None or lng is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "PARCEL_COORDINATE_MISSING", "message": "해당 PNU의 좌표가 비어 있습니다."},
        )

    return lookup_map_by_click(db, MapClickRequest(lat=lat, lng=lng))


def fetch_map_price_rows(pnu: str) -> MapPriceRowsResponse:
    pnu = pnu.strip()
    if not _PNU_PATTERN.fullmatch(pnu):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "INVALID_PNU", "message": "PNU 형식이 올바르지 않습니다."},
        )
    rows = fetch_individual_land_price_rows(pnu)
    return MapPriceRowsResponse(pnu=pnu, rows=rows)


def fetch_map_land_details(pnu: str) -> MapLandDetailsResponse:
    pnu = pnu.strip()
    if not _PNU_PATTERN.fullmatch(pnu):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "INVALID_PNU", "message": "PNU 형식이 올바르지 않습니다."},
        )

    details = _fetch_land_characteristics_latest(pnu) or {}
    area = _extract_area_from_candidate(details)
    if area is None:
        area = _fetch_parcel_area(pnu)
    return MapLandDetailsResponse(
        pnu=pnu,
        stdr_year=_to_text_or_none(details.get("stdrYear")),
        area=area,
        land_category_name=_to_text_or_none(details.get("lndcgrCodeNm")),
        purpose_area_name=_to_text_or_none(details.get("prposAreaNm") or details.get("prposArea1Nm")),
        purpose_district_name=_to_text_or_none(details.get("prposDstrcNm") or details.get("prposArea2Nm")),
    )


def export_map_csv(db: Session, pnu: str) -> Response:
    row = db.execute(
        text(
            """
            SELECT pnu, area, price_current, price_previous
            FROM parcels
            WHERE pnu = :pnu
            """
        ),
        {"pnu": pnu.strip()},
    ).mappings().first()

    if not row:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "PARCEL_NOT_FOUND", "message": "요청한 PNU 데이터가 없습니다."},
        )

    area = _to_float(row.get("area"))
    current_price = _to_int(row.get("price_current"))
    previous_price = _to_int(row.get("price_previous"))
    growth_rate = _calculate_growth_rate(current_price, previous_price)

    buffer = io.StringIO()
    writer = csv.writer(buffer)
    writer.writerow(["pnu", "area", "current_price", "previous_price", "growth_rate"])
    writer.writerow(
        [
            row.get("pnu") or "",
            _format_csv_float(area),
            current_price or "",
            previous_price or "",
            _format_csv_float(growth_rate),
        ]
    )

    filename = f"parcel_{pnu}.csv"
    return Response(
        content=buffer.getvalue(),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


def _resolve_pnu_with_cache(lat: float, lng: float) -> dict[str, str]:
    cache_key = _pnu_cache_key(lat, lng)
    redis_client = _get_redis_client()

    if redis_client is not None:
        try:
            cached = redis_client.get(cache_key)
            if cached:
                payload = json.loads(cached)
                if isinstance(payload, dict):
                    pnu = str(payload.get("pnu", "")).strip()
                    if pnu:
                        return {
                            "pnu": pnu,
                            "address_summary": str(payload.get("address_summary", "")).strip(),
                            "jibun_address": str(payload.get("jibun_address", payload.get("address_summary", ""))).strip(),
                            "road_address": str(payload.get("road_address", "")).strip(),
                        }
        except (RedisError, json.JSONDecodeError, TypeError, ValueError):
            pass

    resolved = _resolve_pnu_and_addresses_from_vworld(lat, lng)
    if redis_client is not None:
        try:
            redis_client.setex(cache_key, settings.redis_pnu_ttl_seconds, json.dumps(resolved, ensure_ascii=False))
        except RedisError:
            pass
    return resolved


def _resolve_pnu_and_addresses_from_vworld(lat: float, lng: float) -> dict[str, str]:
    parcel_result = _reverse_geocode_by_type(lat=lat, lng=lng, address_type="parcel")
    road_result = _reverse_geocode_by_type(lat=lat, lng=lng, address_type="road")

    structure = parcel_result.get("structure", {}) if isinstance(parcel_result, dict) else {}
    ld_code = str(structure.get("level4LC", "")).strip()
    level5 = str(structure.get("level5", "")).strip()
    if not ld_code or not level5:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "MAP_PNU_DATA_INVALID", "message": "PNU 생성에 필요한 정보가 누락되었습니다."},
        )

    parsed = parse_level5_jibun(level5)
    pnu = compose_pnu(
        ld_code=ld_code,
        is_san=parsed["is_san"],
        main_no=str(parsed["main_no"]),
        sub_no=str(parsed["sub_no"]),
    )

    jibun_address = _extract_result_address(parcel_result, fallback_level5=level5)
    road_address = _extract_result_address(road_result)
    if not road_address:
        road_address = _resolve_road_address_via_both(lat=lat, lng=lng)
    address_summary = jibun_address or road_address

    return {
        "pnu": pnu,
        "address_summary": address_summary,
        "jibun_address": jibun_address,
        "road_address": road_address,
    }


def _resolve_road_address_via_both(lat: float, lng: float) -> str:
    payload = call_vworld_json(
        "/req/address",
        {
            "service": "address",
            "request": "getaddress",
            "version": "2.0",
            "crs": "epsg:4326",
            "point": f"{lng},{lat}",
            "format": "json",
            "type": "both",
            "simple": "false",
        },
    )
    response = payload.get("response", {})
    if response.get("status") != "OK":
        return ""

    result = response.get("result") or []
    if not isinstance(result, list):
        return ""

    road_candidates: list[str] = []
    for item in result:
        if not isinstance(item, dict):
            continue
        raw_type = str(item.get("type", "")).strip().lower()
        text = _extract_result_address(item)
        if not text:
            continue
        if "road" in raw_type:
            return text
        road_keys = ("road", "rdnm", "roadname", "road_name")
        structure = item.get("structure", {})
        if isinstance(structure, dict):
            joined_keys = " ".join(str(k).lower() for k in structure.keys())
            if any(key in joined_keys for key in road_keys):
                return text
        road_candidates.append(text)

    # 특정 필지는 도로명주소가 부여되지 않아 빈 값이 정상일 수 있다.
    return road_candidates[0] if road_candidates else ""


def _reverse_geocode_by_type(lat: float, lng: float, address_type: str) -> dict[str, Any]:
    payload = call_vworld_json(
        "/req/address",
        {
            "service": "address",
            "request": "getaddress",
            "version": "2.0",
            "crs": "epsg:4326",
            "point": f"{lng},{lat}",
            "format": "json",
            "type": address_type,
            "simple": "false",
        },
    )
    response = payload.get("response", {})
    if response.get("status") != "OK":
        return {}
    result = response.get("result") or []
    if isinstance(result, list) and result:
        first = result[0]
        if isinstance(first, dict):
            return first
    return {}


def _extract_result_address(result: dict[str, Any], fallback_level5: str = "") -> str:
    if not isinstance(result, dict):
        return ""
    text = str(result.get("text", "")).strip()
    if text:
        return text
    structure = result.get("structure", {})
    if not isinstance(structure, dict):
        return ""
    parts = [
        str(structure.get("level1", "")).strip(),
        str(structure.get("level2", "")).strip(),
        str(structure.get("level3", "")).strip(),
        str(structure.get("level4", "")).strip(),
        str(structure.get("level5", fallback_level5)).strip(),
    ]
    return " ".join(part for part in parts if part)


def _geocode_address(address: str) -> dict[str, float]:
    for address_type in ("road", "parcel"):
        payload = call_vworld_json(
            "/req/address",
            {
                "service": "address",
                "request": "getcoord",
                "version": "2.0",
                "crs": "epsg:4326",
                "address": address,
                "refine": "true",
                "simple": "false",
                "format": "json",
                "type": address_type,
            },
        )
        response = payload.get("response", {})
        if response.get("status") != "OK":
            continue
        point = response.get("result", {}).get("point", {})
        lng = _to_float(point.get("x"))
        lat = _to_float(point.get("y"))
        if lat is not None and lng is not None:
            return {"lat": lat, "lng": lng}

    raise HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail={"code": "MAP_ADDRESS_NOT_FOUND", "message": "입력한 주소를 좌표로 변환하지 못했습니다."},
    )


def _find_cached_parcel(db: Session, pnu: str) -> dict[str, Any] | None:
    row = db.execute(
        text(
            """
            SELECT pnu, area, price_current, price_previous, updated_at
            FROM parcels
            WHERE pnu = :pnu
            """
        ),
        {"pnu": pnu},
    ).mappings().first()
    return dict(row) if row else None


def _upsert_parcel_snapshot(
    db: Session,
    pnu: str,
    lat: float,
    lng: float,
    area: float | None,
    price_current: int | None,
    price_previous: int | None,
) -> None:
    now = datetime.now(timezone.utc)
    update_result = db.execute(
        text(
            """
            UPDATE parcels
            SET lat = :lat,
                lng = :lng,
                area = :area,
                price_current = :price_current,
                price_previous = :price_previous,
                updated_at = :updated_at
            WHERE pnu = :pnu
            """
        ),
        {
            "pnu": pnu,
            "lat": lat,
            "lng": lng,
            "area": area,
            "price_current": price_current,
            "price_previous": price_previous,
            "updated_at": now,
        },
    )

    if update_result.rowcount == 0:
        db.execute(
            text(
                """
                INSERT INTO parcels (id, pnu, lat, lng, area, price_current, price_previous, updated_at)
                VALUES (:id, :pnu, :lat, :lng, :area, :price_current, :price_previous, :updated_at)
                """
            ),
            {
                "id": str(uuid.uuid4()),
                "pnu": pnu,
                "lat": lat,
                "lng": lng,
                "area": area,
                "price_current": price_current,
                "price_previous": price_previous,
                "updated_at": now,
            },
        )

    if _is_postgres(db):
        db.execute(
            text(
                """
                UPDATE parcels
                SET geog = ST_SetSRID(ST_MakePoint(:lng, :lat), 4326)::geography
                WHERE pnu = :pnu
                """
            ),
            {"pnu": pnu, "lat": lat, "lng": lng},
        )

    db.commit()


def _fetch_nearby_avg_price(db: Session, pnu: str, lat: float, lng: float, radius_m: int) -> int | None:
    if not _is_postgres(db):
        return None

    row = db.execute(
        text(
            """
            SELECT ROUND(AVG(price_current))::BIGINT AS nearby_avg
            FROM parcels
            WHERE pnu <> :pnu
              AND price_current IS NOT NULL
              AND geog IS NOT NULL
              AND ST_DWithin(
                    geog,
                    ST_SetSRID(ST_MakePoint(:lng, :lat), 4326)::geography,
                    :radius_m
              )
            """
        ),
        {"pnu": pnu, "lat": lat, "lng": lng, "radius_m": radius_m},
    ).mappings().first()

    if not row:
        return None
    return _to_int(row.get("nearby_avg"))


def _fetch_parcel_area(pnu: str) -> float | None:
    try:
        payload = call_vworld_json(
            "/ned/data/getParcelLandAttr",
            {
                "pnu": pnu,
                "format": "json",
                "numOfRows": "10",
                "pageNo": "1",
            },
        )
    except HTTPException:
        return None

    root_candidates: list[Any] = [
        payload.get("parcelLandAttrs"),
        payload.get("parcelLandAttr"),
        payload.get("parcelLands"),
        payload.get("parcelLand"),
        payload,
    ]
    field_candidates: list[Any] = []
    for root in root_candidates:
        if isinstance(root, dict):
            field_candidates.append(root.get("field"))
            field_candidates.append(root.get("result"))
            field_candidates.append(root.get("items"))

    for candidate in field_candidates:
        area = _extract_area_from_candidate(candidate)
        if area is not None:
            return area

    area = _extract_area_from_candidate(payload)
    if area is not None:
        return area

    details = _fetch_land_characteristics_latest(pnu)
    return _extract_area_from_candidate(details)


def _fetch_land_characteristics_latest(pnu: str) -> dict[str, Any] | None:
    for api_path in ("/ned/data/getLandCharacteristics", "/ned/data/getLandCharacteristicsAttr"):
        try:
            payload = call_vworld_json(
                api_path,
                {
                    "pnu": pnu,
                    "format": "json",
                    "numOfRows": "100",
                    "pageNo": "1",
                },
            )
        except HTTPException:
            continue

        fields = _extract_land_characteristics_fields(payload)
        if not fields:
            continue

        def _sort_key(item: dict[str, Any]) -> tuple[int, str]:
            year_raw = str(item.get("stdrYear", "")).strip()
            year = int(year_raw) if year_raw.isdigit() else -1
            updated = str(item.get("frstRegistDt", "")).strip()
            return (year, updated)

        return max(fields, key=_sort_key)

    return None


def _extract_land_characteristics_fields(payload: dict[str, Any]) -> list[dict[str, Any]]:
    if not isinstance(payload, dict):
        return []

    response = payload.get("response")
    if isinstance(response, dict):
        response_code = str(response.get("resultCode", "") or "").strip()
        if response_code:
            return []

    root_candidates: list[Any] = [
        payload.get("landCharacteristics"),
        payload.get("landCharacteristic"),
        payload.get("landCharacteristicss"),
        payload.get("landCharacteristicsAttrs"),
        payload.get("landCharacteristicsAttr"),
        payload,
    ]
    fields: list[dict[str, Any]] = []
    for root in root_candidates:
        if not isinstance(root, dict):
            continue
        result_code = str(root.get("resultCode", "") or "").strip()
        if result_code:
            continue

        candidates = [root.get("field"), root.get("result"), root.get("items")]
        for candidate in candidates:
            if isinstance(candidate, dict):
                fields.append(candidate)
            elif isinstance(candidate, list):
                fields.extend(item for item in candidate if isinstance(item, dict))
    return fields


def _extract_area_from_candidate(value: Any) -> float | None:
    if isinstance(value, list):
        for item in value:
            area = _extract_area_from_candidate(item)
            if area is not None:
                return area
        return None

    if not isinstance(value, dict):
        return None

    preferred_keys = (
        "lndpclAr",
        "lndAr",
        "landAr",
        "parcelAr",
        "parcelArea",
        "area",
        "ladAr",
        "lndcgrAr",
    )
    for key in preferred_keys:
        if key in value:
            parsed = _to_float(value.get(key))
            if parsed is not None and parsed > 0:
                return parsed

    # 스키마가 다른 응답을 대비해, 키 이름이 면적 계열일 때만 보조 추출한다.
    fallback_key_hints = ("ar", "area", "면적")
    exclude_key_hints = (
        "year",
        "stdr",
        "code",
        "price",
        "pblntf",
        "date",
        "mnnm",
        "slno",
        "lat",
        "lng",
        "x",
        "y",
    )
    for key, raw in value.items():
        key_text = str(key).strip().lower()
        if not key_text:
            continue
        if not any(hint in key_text for hint in fallback_key_hints):
            continue
        if any(hint in key_text for hint in exclude_key_hints):
            continue

        parsed = _to_float(raw)
        if parsed is not None and 1 <= parsed <= 10_000_000:
            return parsed
    return None


def _validate_lat_lng(lat: float, lng: float) -> None:
    if not (-90 <= lat <= 90) or not (-180 <= lng <= 180):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "INVALID_COORDINATE", "message": "위도/경도 범위를 확인해 주세요."},
        )


def _parse_price(value: str | None) -> int | None:
    if not value:
        return None
    digits = _PRICE_DIGITS.sub("", value)
    if not digits:
        return None
    try:
        return int(digits)
    except ValueError:
        return None


def _calculate_growth_rate(current: int | None, previous: int | None) -> float | None:
    if current is None or previous is None or previous <= 0:
        return None
    return round(((current - previous) / previous) * 100, 2)


def _calculate_total_price(area: float | None, current: int | None) -> int | None:
    if area is None or current is None:
        return None
    return int(round(area * current))


def _is_fresh(updated_at: Any) -> bool:
    parsed = _to_datetime(updated_at)
    if parsed is None:
        return False
    return datetime.now(timezone.utc) - parsed <= timedelta(seconds=settings.map_price_cache_ttl_seconds)


def _to_datetime(value: Any) -> datetime | None:
    if isinstance(value, datetime):
        return value if value.tzinfo else value.replace(tzinfo=timezone.utc)
    if isinstance(value, str):
        text_value = value.strip().replace("Z", "+00:00")
        if not text_value:
            return None
        try:
            parsed = datetime.fromisoformat(text_value)
            return parsed if parsed.tzinfo else parsed.replace(tzinfo=timezone.utc)
        except ValueError:
            return None
    return None


def _to_int(value: Any) -> int | None:
    if value is None or value == "":
        return None
    try:
        return int(value)
    except (TypeError, ValueError):
        return None


def _to_float(value: Any) -> float | None:
    if value is None or value == "":
        return None
    if isinstance(value, str):
        value = value.replace(",", "")
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _to_text_or_none(value: Any) -> str | None:
    if value is None:
        return None
    text = str(value).strip()
    return text or None


def _format_csv_float(value: float | None) -> str:
    if value is None:
        return ""
    if value.is_integer():
        return str(int(value))
    return f"{value:.2f}"


def _pnu_cache_key(lat: float, lng: float) -> str:
    return f"map:pnu:{lat:.6f}:{lng:.6f}"


def _is_postgres(db: Session) -> bool:
    return db.bind is not None and db.bind.dialect.name == "postgresql"


def _get_redis_client() -> Redis | None:
    global _REDIS_CLIENT, _REDIS_DISABLED
    if not _REDIS_AVAILABLE:
        return None
    if _REDIS_DISABLED:
        return None
    if _REDIS_CLIENT is not None:
        return _REDIS_CLIENT
    if not settings.redis_url.strip():
        return None

    try:
        client = Redis.from_url(settings.redis_url, decode_responses=True, socket_timeout=2.0)
        client.ping()
        _REDIS_CLIENT = client
        return _REDIS_CLIENT
    except RedisError:
        _REDIS_DISABLED = True
        return None

from __future__ import annotations

import csv
import io
import json
import re
import uuid
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any

from fastapi import HTTPException, status
from fastapi.responses import Response
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.zone_analysis import ZoneAnalysis
from app.models.zone_analysis_parcel import ZoneAnalysisParcel
from app.schemas.map import (
    MapCoordinate,
    MapZoneAnalyzeRequest,
    MapZoneListItem,
    MapZoneListResponse,
    MapZoneParcelExcludeRequest,
    MapZoneParcelItem,
    MapZoneResponse,
    MapZoneSummary,
)
from app.services.vworld_service import call_vworld_json

_PNU_PATTERN = re.compile(r"^\d{19}$")
_SAFE_ZONE_NAME_PATTERN = re.compile(r"^[0-9A-Za-z가-힣\s\-_().]+$")


@dataclass
class _VWorldParcelFeature:
    pnu: str
    geometry_json: str
    address: str
    price_current: int | None
    price_year: str | None


@dataclass
class _ZoneParcelComputed:
    pnu: str
    lat: float | None
    lng: float | None
    area_sqm: float
    overlap_ratio: float
    price_current: int | None
    price_year: str | None
    jibun_address: str
    road_address: str


def analyze_zone(
    db: Session,
    *,
    user_id: str,
    payload: MapZoneAnalyzeRequest,
) -> MapZoneResponse:
    _require_postgres(db)
    zone_name = _normalize_zone_name(payload.zone_name)
    threshold = _resolve_overlap_threshold(payload.overlap_threshold)
    coordinates = _normalize_polygon_coordinates(payload.coordinates)
    zone_wkt = _coordinates_to_wkt(coordinates)

    zone_area_sqm = _calculate_zone_area(db, zone_wkt)
    if zone_area_sqm > settings.map_zone_max_area_sqm:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "code": "ZONE_AREA_TOO_LARGE",
                "message": f"구역 면적은 최대 {int(settings.map_zone_max_area_sqm):,}㎡ 까지만 허용됩니다.",
            },
        )

    _validate_zone_geometry(db, zone_wkt)
    bbox = _calculate_bbox(coordinates)
    feature_map = _fetch_vworld_parcel_features(bbox)
    _upsert_parcel_geometries(db, list(feature_map.values()))
    overlapped = _query_overlapped_parcels(db, zone_wkt=zone_wkt, threshold=threshold, pnu_list=list(feature_map.keys()))
    parcels = _compose_zone_parcels(overlapped, feature_map)

    summary = _calculate_summary(parcels)
    analysis = ZoneAnalysis(
        user_id=user_id,
        zone_name=zone_name,
        zone_wkt=zone_wkt,
        overlap_threshold=threshold,
        zone_area_sqm=zone_area_sqm,
        base_year=summary["base_year"],
        parcel_count=summary["parcel_count"],
        counted_parcel_count=summary["counted_parcel_count"],
        excluded_parcel_count=summary["excluded_parcel_count"],
        unit_price_sum=summary["unit_price_sum"],
        assessed_total_price=summary["assessed_total_price"],
    )
    db.add(analysis)
    db.flush()

    for item in parcels:
        db.add(
            ZoneAnalysisParcel(
                zone_analysis_id=analysis.id,
                pnu=item.pnu,
                jibun_address=item.jibun_address,
                road_address=item.road_address,
                area_sqm=item.area_sqm,
                price_current=item.price_current,
                price_year=item.price_year,
                overlap_ratio=item.overlap_ratio,
                included=True,
                lat=item.lat,
                lng=item.lng,
            )
        )

    db.commit()
    return get_zone_detail(db, user_id=user_id, zone_id=analysis.id)


def get_zone_detail(db: Session, *, user_id: str, zone_id: str) -> MapZoneResponse:
    analysis = (
        db.query(ZoneAnalysis)
        .filter(ZoneAnalysis.id == zone_id, ZoneAnalysis.user_id == user_id)
        .first()
    )
    if not analysis:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "ZONE_ANALYSIS_NOT_FOUND", "message": "구역 분석 결과를 찾을 수 없습니다."},
        )

    rows = (
        db.query(ZoneAnalysisParcel)
        .filter(ZoneAnalysisParcel.zone_analysis_id == zone_id)
        .order_by(ZoneAnalysisParcel.included.desc(), ZoneAnalysisParcel.overlap_ratio.desc(), ZoneAnalysisParcel.pnu.asc())
        .all()
    )
    base_year = analysis.base_year
    parcels = [
        MapZoneParcelItem(
            pnu=row.pnu,
            jibun_address=row.jibun_address,
            road_address=row.road_address,
            area_sqm=float(row.area_sqm or 0.0),
            price_current=row.price_current,
            price_year=row.price_year,
            overlap_ratio=round(float(row.overlap_ratio or 0.0), 4),
            included=bool(row.included),
            counted_in_summary=bool(
                row.included and row.price_current is not None and row.price_year is not None and row.price_year == base_year
            ),
            lat=row.lat,
            lng=row.lng,
        )
        for row in rows
    ]
    summary = MapZoneSummary(
        zone_id=analysis.id,
        zone_name=analysis.zone_name,
        base_year=analysis.base_year,
        overlap_threshold=round(float(analysis.overlap_threshold), 4),
        zone_area_sqm=round(float(analysis.zone_area_sqm), 2),
        parcel_count=int(analysis.parcel_count),
        counted_parcel_count=int(analysis.counted_parcel_count),
        excluded_parcel_count=int(analysis.excluded_parcel_count),
        unit_price_sum=int(analysis.unit_price_sum),
        assessed_total_price=int(analysis.assessed_total_price),
        created_at=_to_iso(analysis.created_at),
        updated_at=_to_iso(analysis.updated_at),
    )
    return MapZoneResponse(summary=summary, parcels=parcels)


def list_zone_analyses(db: Session, *, user_id: str, page: int, page_size: int) -> MapZoneListResponse:
    total_count = (
        db.query(ZoneAnalysis)
        .filter(ZoneAnalysis.user_id == user_id)
        .count()
    )
    total_pages = max(1, (total_count + page_size - 1) // page_size)
    current_page = min(page, total_pages)
    offset = (current_page - 1) * page_size

    rows = (
        db.query(ZoneAnalysis)
        .filter(ZoneAnalysis.user_id == user_id)
        .order_by(ZoneAnalysis.created_at.desc())
        .offset(offset)
        .limit(page_size)
        .all()
    )
    items = [
        MapZoneListItem(
            zone_id=row.id,
            zone_name=row.zone_name,
            base_year=row.base_year,
            parcel_count=int(row.parcel_count),
            assessed_total_price=int(row.assessed_total_price),
            created_at=_to_iso(row.created_at),
        )
        for row in rows
    ]
    return MapZoneListResponse(
        page=current_page,
        page_size=page_size,
        total_count=total_count,
        total_pages=total_pages,
        items=items,
    )


def exclude_zone_parcels(
    db: Session,
    *,
    user_id: str,
    zone_id: str,
    payload: MapZoneParcelExcludeRequest,
) -> MapZoneResponse:
    analysis = (
        db.query(ZoneAnalysis)
        .filter(ZoneAnalysis.id == zone_id, ZoneAnalysis.user_id == user_id)
        .first()
    )
    if not analysis:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "ZONE_ANALYSIS_NOT_FOUND", "message": "구역 분석 결과를 찾을 수 없습니다."},
        )

    pnu_list = [pnu.strip() for pnu in payload.pnu_list if pnu.strip()]
    if not pnu_list:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "EMPTY_PNU_LIST", "message": "제외할 필지를 선택해 주세요."},
        )

    now = datetime.now(timezone.utc)
    rows = (
        db.query(ZoneAnalysisParcel)
        .filter(
            ZoneAnalysisParcel.zone_analysis_id == zone_id,
            ZoneAnalysisParcel.pnu.in_(pnu_list),
        )
        .all()
    )
    if not rows:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "ZONE_PARCELS_NOT_FOUND", "message": "선택한 필지를 찾을 수 없습니다."},
        )

    for row in rows:
        row.included = False
        row.excluded_at = now
        row.excluded_reason = (payload.reason or "사용자 수동 제외").strip()[:200] or "사용자 수동 제외"
        row.updated_at = now
        db.add(row)

    _recalculate_zone_summary(db, analysis)
    db.commit()
    return get_zone_detail(db, user_id=user_id, zone_id=zone_id)


def export_zone_csv(db: Session, *, user_id: str, zone_id: str) -> Response:
    response = get_zone_detail(db, user_id=user_id, zone_id=zone_id)
    buffer = io.StringIO()
    writer = csv.writer(buffer)
    writer.writerow(
        [
            "zone_id",
            "zone_name",
            "base_year",
            "pnu",
            "jibun_address",
            "road_address",
            "area_sqm",
            "price_current",
            "price_year",
            "overlap_ratio",
            "included",
            "counted_in_summary",
        ]
    )

    for row in response.parcels:
        writer.writerow(
            [
                response.summary.zone_id,
                response.summary.zone_name,
                response.summary.base_year or "",
                row.pnu,
                row.jibun_address,
                row.road_address,
                f"{row.area_sqm:.2f}",
                row.price_current or "",
                row.price_year or "",
                f"{row.overlap_ratio:.4f}",
                "Y" if row.included else "N",
                "Y" if row.counted_in_summary else "N",
            ]
        )

    filename = f"zone_{zone_id}.csv"
    return Response(
        content=buffer.getvalue(),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


def _normalize_zone_name(zone_name: str) -> str:
    normalized = zone_name.strip()
    if not normalized:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "INVALID_ZONE_NAME", "message": "구역 이름을 입력해 주세요."},
        )
    if not _SAFE_ZONE_NAME_PATTERN.fullmatch(normalized):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "INVALID_ZONE_NAME", "message": "구역 이름에 허용되지 않는 문자가 포함되어 있습니다."},
        )
    return normalized


def _resolve_overlap_threshold(requested: float | None) -> float:
    threshold = settings.map_zone_overlap_threshold if requested is None else requested
    if threshold <= 0 or threshold > 1:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "INVALID_OVERLAP_THRESHOLD", "message": "포함 임계치는 0 초과 1 이하 값이어야 합니다."},
        )
    return float(threshold)


def _normalize_polygon_coordinates(coords: list[MapCoordinate]) -> list[tuple[float, float]]:
    max_vertices = max(3, settings.map_zone_max_vertices)
    if len(coords) < 3:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "ZONE_TOO_FEW_POINTS", "message": "구역 좌표는 최소 3개 이상 필요합니다."},
        )
    if len(coords) > max_vertices:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "ZONE_TOO_MANY_POINTS", "message": f"구역 꼭짓점은 최대 {max_vertices}개까지 허용됩니다."},
        )

    points: list[tuple[float, float]] = []
    for item in coords:
        lat = float(item.lat)
        lng = float(item.lng)
        if not (-90 <= lat <= 90) or not (-180 <= lng <= 180):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={"code": "INVALID_COORDINATE", "message": "위도/경도 범위를 확인해 주세요."},
            )
        points.append((lng, lat))

    unique_points = {(round(lng, 10), round(lat, 10)) for lng, lat in points}
    if len(unique_points) < 3:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "ZONE_TOO_FEW_UNIQUE_POINTS", "message": "서로 다른 좌표 3개 이상이 필요합니다."},
        )

    first = points[0]
    last = points[-1]
    if abs(first[0] - last[0]) > 1e-9 or abs(first[1] - last[1]) > 1e-9:
        points.append(first)
    return points


def _coordinates_to_wkt(coords: list[tuple[float, float]]) -> str:
    serialized = ", ".join(f"{lng:.12f} {lat:.12f}" for lng, lat in coords)
    return f"POLYGON(({serialized}))"


def _calculate_bbox(coords: list[tuple[float, float]]) -> tuple[float, float, float, float]:
    lng_values = [lng for lng, _ in coords]
    lat_values = [lat for _, lat in coords]
    return (min(lng_values), min(lat_values), max(lng_values), max(lat_values))


def _calculate_zone_area(db: Session, zone_wkt: str) -> float:
    row = db.execute(
        text(
            """
            SELECT ST_Area(ST_GeogFromText(:zone_wkt)) AS area_sqm
            """
        ),
        {"zone_wkt": zone_wkt},
    ).mappings().first()
    area = float(row["area_sqm"]) if row and row.get("area_sqm") is not None else 0.0
    return max(0.0, area)


def _validate_zone_geometry(db: Session, zone_wkt: str) -> None:
    row = db.execute(
        text(
            """
            SELECT
              ST_IsValid(geom) AS is_valid,
              ST_IsValidReason(geom) AS reason
            FROM (SELECT ST_GeomFromText(:zone_wkt, 4326) AS geom) AS src
            """
        ),
        {"zone_wkt": zone_wkt},
    ).mappings().first()
    if not row or bool(row.get("is_valid")):
        return
    reason = str(row.get("reason") or "유효하지 않은 폴리곤입니다.")
    raise HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail={"code": "INVALID_ZONE_GEOMETRY", "message": f"유효하지 않은 폴리곤입니다: {reason}"},
    )


def _fetch_vworld_parcel_features(bbox: tuple[float, float, float, float]) -> dict[str, _VWorldParcelFeature]:
    min_lng, min_lat, max_lng, max_lat = bbox
    geom_filter = f"BOX({min_lng:.12f},{min_lat:.12f},{max_lng:.12f},{max_lat:.12f})"
    page_size = max(100, min(settings.map_zone_vworld_page_size, 1000))
    max_pages = max(1, settings.map_zone_vworld_max_pages)

    feature_map: dict[str, _VWorldParcelFeature] = {}
    current_page = 1
    total_pages = 1

    while current_page <= total_pages and current_page <= max_pages:
        payload = call_vworld_json(
            "/req/data",
            {
                "service": "data",
                "request": "GetFeature",
                "data": "LP_PA_CBND_BUBUN",
                "version": "2.0",
                "format": "json",
                "geomFilter": geom_filter,
                "size": str(page_size),
                "page": str(current_page),
            },
        )

        response = payload.get("response", {})
        status_text = str(response.get("status", "")).upper()
        if status_text != "OK":
            error_text = ""
            error = response.get("error")
            if isinstance(error, dict):
                error_text = str(error.get("text", "")).strip()
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail={"code": "VWORLD_ZONE_FEATURE_FAILED", "message": error_text or "지적도 데이터를 불러오지 못했습니다."},
            )

        page_info = response.get("page", {}) if isinstance(response.get("page"), dict) else {}
        total_pages = int(page_info.get("total", 1) or 1)
        if total_pages > max_pages:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={
                    "code": "ZONE_TOO_MANY_FEATURE_PAGES",
                    "message": f"구역 범위가 넓어 처리량이 큽니다. 구역을 더 작게 나눠 조회해 주세요. (pages={total_pages})",
                },
            )

        features = _extract_feature_list(response)
        for item in features:
            feature = _parse_vworld_feature(item)
            if feature is None:
                continue
            prev = feature_map.get(feature.pnu)
            if prev is None:
                feature_map[feature.pnu] = feature
                continue
            prev_year = prev.price_year or ""
            next_year = feature.price_year or ""
            if next_year >= prev_year:
                feature_map[feature.pnu] = feature

        current_page += 1

    return feature_map


def _extract_feature_list(response: dict[str, Any]) -> list[dict[str, Any]]:
    result = response.get("result", {})
    if not isinstance(result, dict):
        return []
    collection = result.get("featureCollection", {})
    if not isinstance(collection, dict):
        return []
    features = collection.get("features")
    if not isinstance(features, list):
        return []
    return [item for item in features if isinstance(item, dict)]


def _parse_vworld_feature(raw: dict[str, Any]) -> _VWorldParcelFeature | None:
    properties = raw.get("properties", {})
    geometry = raw.get("geometry")
    if not isinstance(properties, dict) or not isinstance(geometry, dict):
        return None

    pnu = str(properties.get("pnu") or "").strip()
    if not _PNU_PATTERN.fullmatch(pnu):
        return None

    try:
        geometry_json = json.dumps(geometry, ensure_ascii=False)
    except (TypeError, ValueError):
        return None

    address = str(properties.get("addr") or "").strip()
    price_current = _to_int(properties.get("jiga"))
    price_year = str(properties.get("gosi_year") or "").strip()
    if not re.fullmatch(r"\d{4}", price_year):
        price_year = None

    return _VWorldParcelFeature(
        pnu=pnu,
        geometry_json=geometry_json,
        address=address,
        price_current=price_current,
        price_year=price_year,
    )


def _upsert_parcel_geometries(db: Session, features: list[_VWorldParcelFeature]) -> None:
    now = datetime.now(timezone.utc)
    for item in features:
        db.execute(
            text(
                """
                WITH geom_data AS (
                  SELECT ST_SetSRID(ST_GeomFromGeoJSON(:geometry_json), 4326) AS geom
                ),
                centroid AS (
                  SELECT
                    ST_X(ST_Centroid(geom)) AS lng,
                    ST_Y(ST_Centroid(geom)) AS lat,
                    geom
                  FROM geom_data
                )
                INSERT INTO parcels (
                  id, pnu, lat, lng, area, price_current, price_previous, updated_at, geog, geom
                )
                SELECT
                  :id,
                  :pnu,
                  centroid.lat,
                  centroid.lng,
                  ST_Area(centroid.geom::geography),
                  :price_current,
                  NULL,
                  :updated_at,
                  ST_SetSRID(ST_MakePoint(centroid.lng, centroid.lat), 4326)::geography,
                  centroid.geom
                FROM centroid
                ON CONFLICT (pnu) DO UPDATE
                SET
                  lat = EXCLUDED.lat,
                  lng = EXCLUDED.lng,
                  area = COALESCE(EXCLUDED.area, parcels.area),
                  price_current = COALESCE(EXCLUDED.price_current, parcels.price_current),
                  updated_at = EXCLUDED.updated_at,
                  geog = EXCLUDED.geog,
                  geom = EXCLUDED.geom
                """
            ),
            {
                "id": str(uuid.uuid4()),
                "pnu": item.pnu,
                "geometry_json": item.geometry_json,
                "price_current": item.price_current,
                "updated_at": now,
            },
        )

    db.flush()


def _query_overlapped_parcels(
    db: Session,
    *,
    zone_wkt: str,
    threshold: float,
    pnu_list: list[str],
) -> list[dict[str, Any]]:
    if not pnu_list:
        return []

    bind_params: dict[str, Any] = {"zone_wkt": zone_wkt, "threshold": threshold}
    placeholders: list[str] = []
    for idx, pnu in enumerate(pnu_list):
        key = f"pnu_{idx}"
        bind_params[key] = pnu
        placeholders.append(f":{key}")

    where_pnu = ", ".join(placeholders)

    if _is_postgres(db):
        db.execute(text("SET LOCAL statement_timeout = :timeout_ms"), {"timeout_ms": str(settings.map_zone_query_timeout_ms)})

    query = f"""
        WITH zone AS (
          SELECT ST_GeomFromText(:zone_wkt, 4326) AS geom
        ),
        candidates AS (
          SELECT
            p.pnu,
            p.lat,
            p.lng,
            COALESCE(p.area, ST_Area(p.geom::geography)) AS area_sqm,
            ST_Area(ST_Intersection(p.geom, z.geom)::geography) / NULLIF(ST_Area(p.geom::geography), 0) AS overlap_ratio
          FROM parcels p
          CROSS JOIN zone z
          WHERE p.geom IS NOT NULL
            AND p.pnu IN ({where_pnu})
            AND ST_Intersects(p.geom, z.geom)
        )
        SELECT pnu, lat, lng, area_sqm, overlap_ratio
        FROM candidates
        WHERE overlap_ratio >= :threshold
        ORDER BY overlap_ratio DESC, pnu ASC
    """
    rows = db.execute(text(query), bind_params).mappings().all()
    return [dict(row) for row in rows]


def _compose_zone_parcels(
    rows: list[dict[str, Any]],
    feature_map: dict[str, _VWorldParcelFeature],
) -> list[_ZoneParcelComputed]:
    parcels: list[_ZoneParcelComputed] = []
    for row in rows:
        pnu = str(row.get("pnu") or "").strip()
        if not pnu:
            continue
        feature = feature_map.get(pnu)
        area_sqm = float(row.get("area_sqm") or 0.0)
        parcels.append(
            _ZoneParcelComputed(
                pnu=pnu,
                lat=_to_float(row.get("lat")),
                lng=_to_float(row.get("lng")),
                area_sqm=round(max(0.0, area_sqm), 2),
                overlap_ratio=float(row.get("overlap_ratio") or 0.0),
                price_current=feature.price_current if feature else None,
                price_year=feature.price_year if feature else None,
                jibun_address=(feature.address if feature else "") or pnu,
                road_address="",
            )
        )
    return parcels


def _calculate_summary(parcels: list[_ZoneParcelComputed]) -> dict[str, Any]:
    price_years = [item.price_year for item in parcels if item.price_year and item.price_current is not None]
    base_year = max(price_years) if price_years else None

    parcel_count = len(parcels)
    excluded_parcel_count = 0
    counted = [
        item
        for item in parcels
        if item.price_current is not None and item.price_year is not None and item.price_year == base_year
    ]
    counted_parcel_count = len(counted)
    unit_price_sum = sum(int(item.price_current or 0) for item in counted)
    assessed_total_price = sum(int(round(item.area_sqm * int(item.price_current or 0))) for item in counted)

    return {
        "base_year": base_year,
        "parcel_count": parcel_count,
        "counted_parcel_count": counted_parcel_count,
        "excluded_parcel_count": excluded_parcel_count,
        "unit_price_sum": unit_price_sum,
        "assessed_total_price": assessed_total_price,
    }


def _recalculate_zone_summary(db: Session, analysis: ZoneAnalysis) -> None:
    rows = (
        db.query(ZoneAnalysisParcel)
        .filter(ZoneAnalysisParcel.zone_analysis_id == analysis.id)
        .all()
    )
    included_rows = [row for row in rows if row.included]
    years = [row.price_year for row in included_rows if row.price_year and row.price_current is not None]
    base_year = max(years) if years else None

    counted_rows = [
        row for row in included_rows if row.price_current is not None and row.price_year is not None and row.price_year == base_year
    ]

    analysis.base_year = base_year
    analysis.parcel_count = len(included_rows)
    analysis.excluded_parcel_count = len(rows) - len(included_rows)
    analysis.counted_parcel_count = len(counted_rows)
    analysis.unit_price_sum = sum(int(row.price_current or 0) for row in counted_rows)
    analysis.assessed_total_price = sum(int(round(float(row.area_sqm or 0.0) * int(row.price_current or 0))) for row in counted_rows)
    analysis.updated_at = datetime.now(timezone.utc)
    db.add(analysis)


def _require_postgres(db: Session) -> None:
    if not _is_postgres(db):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "POSTGIS_REQUIRED", "message": "구역조회 기능은 PostGIS(PostgreSQL) 환경에서만 지원됩니다."},
        )


def _is_postgres(db: Session) -> bool:
    return db.bind is not None and db.bind.dialect.name == "postgresql"


def _to_int(value: Any) -> int | None:
    if value is None or value == "":
        return None
    text_value = str(value).replace(",", "").strip()
    if not text_value:
        return None
    try:
        return int(float(text_value))
    except (TypeError, ValueError):
        return None


def _to_float(value: Any) -> float | None:
    if value is None or value == "":
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _to_iso(value: datetime) -> str:
    if value.tzinfo is None:
        value = value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc).isoformat()

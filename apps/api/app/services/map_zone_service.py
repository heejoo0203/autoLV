from __future__ import annotations

import csv
import io
import json
import re
import uuid
from concurrent.futures import ThreadPoolExecutor, as_completed
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
    MapZoneDeleteResponse,
    MapZoneListItem,
    MapZoneListResponse,
    MapZoneParcelExcludeRequest,
    MapZoneParcelItem,
    MapZoneResponse,
    MapZoneSaveRequest,
    MapZoneSummary,
    MapZoneUpdateRequest,
)
from app.services.map_service import _fetch_land_characteristics_latest, _get_redis_client, _to_text_or_none
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
    land_category_name: str | None
    purpose_area_name: str | None
    geometry_geojson: str | None


@dataclass
class _PreparedZonePreview:
    zone_name: str
    threshold: float
    coordinates: list[tuple[float, float]]
    zone_wkt: str
    zone_area_sqm: float
    parcels: list[_ZoneParcelComputed]
    summary: dict[str, Any]
    generated_at: datetime


def analyze_zone(
    db: Session,
    *,
    payload: MapZoneAnalyzeRequest,
) -> MapZoneResponse:
    preview = _prepare_zone_preview(db, payload=payload)
    return _build_zone_response(preview=preview, zone_id=None, is_saved=False)


def save_zone_analysis(
    db: Session,
    *,
    user_id: str,
    payload: MapZoneSaveRequest,
) -> MapZoneResponse:
    preview = _prepare_zone_preview(
        db,
        payload=MapZoneAnalyzeRequest(
            zone_name=payload.zone_name,
            coordinates=payload.coordinates,
            overlap_threshold=payload.overlap_threshold,
        ),
    )
    excluded_pnu_set = {pnu.strip() for pnu in payload.excluded_pnu_list if pnu.strip()}
    analysis = ZoneAnalysis(
        user_id=user_id,
        zone_name=preview.zone_name,
        zone_wkt=preview.zone_wkt,
        overlap_threshold=preview.threshold,
        zone_area_sqm=preview.zone_area_sqm,
        base_year=preview.summary["base_year"],
        parcel_count=preview.summary["parcel_count"],
        counted_parcel_count=preview.summary["counted_parcel_count"],
        excluded_parcel_count=preview.summary["excluded_parcel_count"],
        unit_price_sum=preview.summary["unit_price_sum"],
        assessed_total_price=preview.summary["assessed_total_price"],
    )
    db.add(analysis)
    db.flush()

    for item in preview.parcels:
        included = item.pnu not in excluded_pnu_set
        db.add(
            ZoneAnalysisParcel(
                zone_analysis_id=analysis.id,
                pnu=item.pnu,
                jibun_address=item.jibun_address,
                road_address=item.road_address,
                land_category_name=item.land_category_name,
                purpose_area_name=item.purpose_area_name,
                area_sqm=item.area_sqm,
                price_current=item.price_current,
                price_year=item.price_year,
                overlap_ratio=item.overlap_ratio,
                included=included,
                excluded_reason=None if included else "저장 전 사용자 제외",
                excluded_at=None if included else preview.generated_at,
                lat=item.lat,
                lng=item.lng,
            )
        )

    _recalculate_zone_summary(db, analysis)
    db.commit()
    return get_zone_detail(db, user_id=user_id, zone_id=analysis.id)


def get_zone_detail(db: Session, *, user_id: str, zone_id: str) -> MapZoneResponse:
    analysis = _get_zone_analysis_or_404(db, user_id=user_id, zone_id=zone_id)

    rows = (
        db.query(ZoneAnalysisParcel)
        .filter(ZoneAnalysisParcel.zone_analysis_id == zone_id)
        .order_by(ZoneAnalysisParcel.included.desc(), ZoneAnalysisParcel.overlap_ratio.desc(), ZoneAnalysisParcel.pnu.asc())
        .all()
    )
    base_year = analysis.base_year
    response_zone_area_sqm = round(sum(float(row.area_sqm or 0.0) for row in rows if row.included), 2)
    parcel_metadata_map = _fetch_saved_zone_parcel_metadata(db, [row.pnu for row in rows])
    missing_land_metadata_pnu = [
        row.pnu for row in rows if not row.land_category_name and not row.purpose_area_name
    ]
    live_land_metadata_map = _fetch_zone_land_metadata(missing_land_metadata_pnu) if missing_land_metadata_pnu else {}
    parcels = [
        MapZoneParcelItem(
            pnu=row.pnu,
            jibun_address=row.jibun_address,
            road_address=row.road_address,
            land_category_name=row.land_category_name or live_land_metadata_map.get(row.pnu, {}).get("land_category_name"),
            purpose_area_name=row.purpose_area_name or live_land_metadata_map.get(row.pnu, {}).get("purpose_area_name"),
            geometry_geojson=parcel_metadata_map.get(row.pnu),
            area_sqm=float(row.area_sqm or 0.0),
            price_current=row.price_current,
            price_year=row.price_year,
            estimated_total_price=_calculate_estimated_total_price(row.area_sqm, row.price_current),
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
        is_saved=True,
        base_year=analysis.base_year,
        overlap_threshold=round(float(analysis.overlap_threshold), 4),
        zone_area_sqm=response_zone_area_sqm,
        parcel_count=int(analysis.parcel_count),
        counted_parcel_count=int(analysis.counted_parcel_count),
        excluded_parcel_count=int(analysis.excluded_parcel_count),
        average_unit_price=_calculate_average_unit_price(
            assessed_total_price=int(analysis.assessed_total_price),
            zone_area_sqm=response_zone_area_sqm,
        ),
        assessed_total_price=int(analysis.assessed_total_price),
        created_at=_to_iso(analysis.created_at),
        updated_at=_to_iso(analysis.updated_at),
    )
    return MapZoneResponse(summary=summary, coordinates=_zone_wkt_to_coordinates(analysis.zone_wkt), parcels=parcels)


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
        .order_by(ZoneAnalysis.updated_at.desc(), ZoneAnalysis.created_at.desc())
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
            updated_at=_to_iso(row.updated_at),
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
        _get_zone_analysis_or_404(db, user_id=user_id, zone_id=zone_id)
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


def update_zone_name(
    db: Session,
    *,
    user_id: str,
    zone_id: str,
    payload: MapZoneUpdateRequest,
) -> MapZoneResponse:
    analysis = _get_zone_analysis_or_404(db, user_id=user_id, zone_id=zone_id)
    analysis.zone_name = _normalize_zone_name(payload.zone_name)
    analysis.updated_at = datetime.now(timezone.utc)
    db.add(analysis)
    db.commit()
    return get_zone_detail(db, user_id=user_id, zone_id=zone_id)


def delete_zone_analysis(
    db: Session,
    *,
    user_id: str,
    zone_id: str,
) -> MapZoneDeleteResponse:
    analysis = _get_zone_analysis_or_404(db, user_id=user_id, zone_id=zone_id)
    db.delete(analysis)
    db.commit()
    return MapZoneDeleteResponse(zone_id=zone_id, deleted=True)


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
            "estimated_total_price",
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
                row.estimated_total_price or "",
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


def _prepare_zone_preview(db: Session, *, payload: MapZoneAnalyzeRequest) -> _PreparedZonePreview:
    _require_postgres(db)
    zone_name = _normalize_zone_name(payload.zone_name)
    threshold = _resolve_overlap_threshold(payload.overlap_threshold)
    coordinates = _normalize_polygon_coordinates(payload.coordinates)
    zone_wkt = _coordinates_to_wkt(coordinates)

    drawn_zone_area_sqm = _calculate_zone_area(db, zone_wkt)
    if drawn_zone_area_sqm > settings.map_zone_max_area_sqm:
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
    max_included_parcels = max(1, int(settings.map_zone_max_included_parcels))
    if len(overlapped) > max_included_parcels:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "code": "ZONE_TOO_MANY_INCLUDED_PARCELS",
                "message": (
                    f"구역 내 포함 필지가 {len(overlapped):,}건으로 너무 많습니다. "
                    f"현재는 최대 {max_included_parcels:,}필지까지 분석할 수 있습니다. "
                    "구역을 더 작게 나눠 조회해 주세요."
                ),
            },
        )
    land_metadata_map = _fetch_zone_land_metadata([row["pnu"] for row in overlapped])
    parcels = _compose_zone_parcels(overlapped, feature_map, land_metadata_map)
    summary = _calculate_summary(parcels)
    return _PreparedZonePreview(
        zone_name=zone_name,
        threshold=threshold,
        coordinates=coordinates,
        zone_wkt=zone_wkt,
        zone_area_sqm=summary["zone_area_sqm"],
        parcels=parcels,
        summary=summary,
        generated_at=datetime.now(timezone.utc),
    )


def _build_zone_response(
    *,
    preview: _PreparedZonePreview,
    zone_id: str | None,
    is_saved: bool,
    included_pnu_set: set[str] | None = None,
) -> MapZoneResponse:
    included_set = included_pnu_set or {item.pnu for item in preview.parcels}
    summary_values = _calculate_summary([item for item in preview.parcels if item.pnu in included_set])
    excluded_count = len(preview.parcels) - len(included_set)

    parcels = [
        MapZoneParcelItem(
            pnu=item.pnu,
            jibun_address=item.jibun_address,
            road_address=item.road_address,
            land_category_name=item.land_category_name,
            purpose_area_name=item.purpose_area_name,
            geometry_geojson=item.geometry_geojson,
            area_sqm=item.area_sqm,
            price_current=item.price_current,
            price_year=item.price_year,
            estimated_total_price=_calculate_estimated_total_price(item.area_sqm, item.price_current),
            overlap_ratio=round(item.overlap_ratio, 4),
            included=item.pnu in included_set,
            counted_in_summary=bool(
                item.pnu in included_set
                and item.price_current is not None
                and item.price_year is not None
                and item.price_year == summary_values["base_year"]
            ),
            lat=item.lat,
            lng=item.lng,
        )
        for item in preview.parcels
    ]
    summary = MapZoneSummary(
        zone_id=zone_id,
        zone_name=preview.zone_name,
        is_saved=is_saved,
        base_year=summary_values["base_year"],
        overlap_threshold=round(preview.threshold, 4),
        zone_area_sqm=round(summary_values["zone_area_sqm"], 2),
        parcel_count=summary_values["parcel_count"],
        counted_parcel_count=summary_values["counted_parcel_count"],
        excluded_parcel_count=excluded_count,
        average_unit_price=_calculate_average_unit_price(
            assessed_total_price=summary_values["assessed_total_price"],
            zone_area_sqm=float(summary_values["zone_area_sqm"]),
        ),
        assessed_total_price=summary_values["assessed_total_price"],
        created_at=_to_iso(preview.generated_at),
        updated_at=_to_iso(preview.generated_at),
    )
    return MapZoneResponse(
        summary=summary,
        coordinates=[MapCoordinate(lat=lat, lng=lng) for lng, lat in preview.coordinates[:-1]],
        parcels=parcels,
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
    return _fetch_vworld_parcel_features_recursive(bbox, depth=0)


def _fetch_vworld_parcel_features_recursive(
    bbox: tuple[float, float, float, float],
    *,
    depth: int,
) -> dict[str, _VWorldParcelFeature]:
    response, total_pages = _fetch_vworld_parcel_feature_page(bbox, page=1)
    max_pages = max(1, settings.map_zone_vworld_max_pages)
    if total_pages <= max_pages:
        return _collect_vworld_parcel_feature_pages(bbox, first_response=response, total_pages=total_pages)

    max_depth = max(0, int(settings.map_zone_bbox_split_max_depth))
    if depth >= max_depth or _is_bbox_too_small(bbox):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "code": "ZONE_TOO_MANY_FEATURE_PAGES",
                "message": (
                    f"구역 범위의 필지 수가 많아 단일 분석 한도를 초과했습니다. "
                    f"구역을 더 작게 나눠 조회해 주세요. (pages={total_pages})"
                ),
            },
        )

    feature_map: dict[str, _VWorldParcelFeature] = {}
    for child_bbox in _split_bbox_into_quadrants(bbox):
        if _bbox_has_no_area(child_bbox):
            continue
        child_features = _fetch_vworld_parcel_features_recursive(child_bbox, depth=depth + 1)
        _merge_vworld_feature_maps(feature_map, child_features)
    return feature_map


def _collect_vworld_parcel_feature_pages(
    bbox: tuple[float, float, float, float],
    *,
    first_response: dict[str, Any],
    total_pages: int,
) -> dict[str, _VWorldParcelFeature]:
    feature_map: dict[str, _VWorldParcelFeature] = {}
    _merge_vworld_feature_maps(feature_map, _parse_vworld_feature_response(first_response))

    for current_page in range(2, total_pages + 1):
        response, _ = _fetch_vworld_parcel_feature_page(bbox, page=current_page)
        _merge_vworld_feature_maps(feature_map, _parse_vworld_feature_response(response))
    return feature_map


def _fetch_vworld_parcel_feature_page(
    bbox: tuple[float, float, float, float],
    *,
    page: int,
) -> tuple[dict[str, Any], int]:
    min_lng, min_lat, max_lng, max_lat = bbox
    geom_filter = f"BOX({min_lng:.12f},{min_lat:.12f},{max_lng:.12f},{max_lat:.12f})"
    page_size = max(100, min(settings.map_zone_vworld_page_size, 1000))

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
            "page": str(page),
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
    return response, total_pages


def _parse_vworld_feature_response(response: dict[str, Any]) -> dict[str, _VWorldParcelFeature]:
    feature_map: dict[str, _VWorldParcelFeature] = {}
    for item in _extract_feature_list(response):
        feature = _parse_vworld_feature(item)
        if feature is None:
            continue
        prev = feature_map.get(feature.pnu)
        if prev is None or (feature.price_year or "") >= (prev.price_year or ""):
            feature_map[feature.pnu] = feature
    return feature_map


def _merge_vworld_feature_maps(
    target: dict[str, _VWorldParcelFeature],
    incoming: dict[str, _VWorldParcelFeature],
) -> None:
    for pnu, feature in incoming.items():
        prev = target.get(pnu)
        if prev is None or (feature.price_year or "") >= (prev.price_year or ""):
            target[pnu] = feature


def _split_bbox_into_quadrants(
    bbox: tuple[float, float, float, float],
) -> list[tuple[float, float, float, float]]:
    min_lng, min_lat, max_lng, max_lat = bbox
    mid_lng = (min_lng + max_lng) / 2
    mid_lat = (min_lat + max_lat) / 2
    return [
        (min_lng, min_lat, mid_lng, mid_lat),
        (mid_lng, min_lat, max_lng, mid_lat),
        (min_lng, mid_lat, mid_lng, max_lat),
        (mid_lng, mid_lat, max_lng, max_lat),
    ]


def _bbox_has_no_area(bbox: tuple[float, float, float, float]) -> bool:
    min_lng, min_lat, max_lng, max_lat = bbox
    return max_lng <= min_lng or max_lat <= min_lat


def _is_bbox_too_small(bbox: tuple[float, float, float, float]) -> bool:
    min_lng, min_lat, max_lng, max_lat = bbox
    return abs(max_lng - min_lng) < 1e-6 or abs(max_lat - min_lat) < 1e-6


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
    if not features:
        return

    now = datetime.now(timezone.utc)
    feature_payload = json.dumps(
        [
            {
                "id": str(uuid.uuid4()),
                "pnu": item.pnu,
                "geometry_json": item.geometry_json,
                "price_current": item.price_current,
            }
            for item in features
        ],
        ensure_ascii=False,
    )
    db.execute(
        text(
            """
            WITH src AS (
              SELECT
                item->>'id' AS id,
                item->>'pnu' AS pnu,
                item->>'geometry_json' AS geometry_json,
                NULLIF(item->>'price_current', '')::BIGINT AS price_current
              FROM jsonb_array_elements(CAST(:feature_payload AS JSONB)) AS item
            ),
            geom_data AS (
              SELECT
                id,
                pnu,
                price_current,
                ST_Multi(ST_SetSRID(ST_GeomFromGeoJSON(geometry_json), 4326)) AS geom
              FROM src
            ),
            prepared AS (
              SELECT
                id,
                pnu,
                price_current,
                ST_Y(ST_Centroid(geom)) AS lat,
                ST_X(ST_Centroid(geom)) AS lng,
                ST_Area(geom::geography) AS area,
                geom
              FROM geom_data
            )
            INSERT INTO parcels (
              id, pnu, lat, lng, area, price_current, price_previous, updated_at, geog, geom
            )
            SELECT
              id,
              pnu,
              lat,
              lng,
              area,
              price_current,
              NULL,
              :updated_at,
              ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography,
              geom
            FROM prepared
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
            "feature_payload": feature_payload,
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
        timeout_ms = max(1000, int(settings.map_zone_query_timeout_ms))
        db.execute(text(f"SET LOCAL statement_timeout = {timeout_ms}"))

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
            ST_AsGeoJSON(p.geom) AS geometry_geojson,
            ST_Area(ST_Intersection(p.geom, z.geom)::geography) / NULLIF(ST_Area(p.geom::geography), 0) AS overlap_ratio
          FROM parcels p
          CROSS JOIN zone z
          WHERE p.geom IS NOT NULL
            AND p.pnu IN ({where_pnu})
            AND ST_Intersects(p.geom, z.geom)
        )
        SELECT pnu, lat, lng, area_sqm, geometry_geojson, overlap_ratio
        FROM candidates
        WHERE overlap_ratio >= :threshold
        ORDER BY overlap_ratio DESC, pnu ASC
    """
    rows = db.execute(text(query), bind_params).mappings().all()
    return [dict(row) for row in rows]


def _compose_zone_parcels(
    rows: list[dict[str, Any]],
    feature_map: dict[str, _VWorldParcelFeature],
    land_metadata_map: dict[str, dict[str, str | None]],
) -> list[_ZoneParcelComputed]:
    parcels: list[_ZoneParcelComputed] = []
    for row in rows:
        pnu = str(row.get("pnu") or "").strip()
        if not pnu:
            continue
        feature = feature_map.get(pnu)
        land_metadata = land_metadata_map.get(pnu, {})
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
                land_category_name=land_metadata.get("land_category_name"),
                purpose_area_name=land_metadata.get("purpose_area_name"),
                geometry_geojson=_to_text_or_none(row.get("geometry_geojson")),
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
    zone_area_sqm = round(sum(float(item.area_sqm or 0.0) for item in parcels), 2)
    unit_price_sum = sum(int(item.price_current or 0) for item in counted)
    assessed_total_price = sum(int(round(item.area_sqm * int(item.price_current or 0))) for item in counted)

    return {
        "base_year": base_year,
        "zone_area_sqm": zone_area_sqm,
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
    analysis.zone_area_sqm = round(sum(float(row.area_sqm or 0.0) for row in included_rows), 2)
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


def _get_zone_analysis_or_404(db: Session, *, user_id: str, zone_id: str) -> ZoneAnalysis:
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
    return analysis


def _fetch_saved_zone_parcel_metadata(db: Session, pnu_list: list[str]) -> dict[str, str]:
    unique_pnu_list = [pnu for pnu in dict.fromkeys(pnu_list) if pnu]
    if not unique_pnu_list:
        return {}

    bind_params: dict[str, Any] = {}
    placeholders: list[str] = []
    for idx, pnu in enumerate(unique_pnu_list):
        key = f"meta_pnu_{idx}"
        bind_params[key] = pnu
        placeholders.append(f":{key}")

    rows = db.execute(
        text(
            f"""
            SELECT pnu, ST_AsGeoJSON(geom) AS geometry_geojson
            FROM parcels
            WHERE geom IS NOT NULL
              AND pnu IN ({", ".join(placeholders)})
            """
        ),
        bind_params,
    ).mappings().all()
    return {
        str(row.get("pnu") or "").strip(): str(row.get("geometry_geojson") or "").strip()
        for row in rows
        if row.get("pnu") and row.get("geometry_geojson")
    }


def _fetch_zone_land_metadata(pnu_list: list[str]) -> dict[str, dict[str, str | None]]:
    metadata_map: dict[str, dict[str, str | None]] = {}
    missing_pnu_list: list[str] = []
    redis_client = _get_redis_client()

    for pnu in dict.fromkeys(pnu_list):
        if not pnu:
            continue
        cached = _load_zone_land_metadata_from_cache(redis_client, pnu)
        if cached is not None:
            metadata_map[pnu] = cached
            continue
        missing_pnu_list.append(pnu)

    sync_limit = max(0, int(settings.map_zone_land_metadata_sync_limit))
    if sync_limit == 0 or not missing_pnu_list:
        return metadata_map

    fetch_targets = missing_pnu_list[:sync_limit]
    worker_count = max(1, min(int(settings.map_zone_land_metadata_workers), len(fetch_targets)))

    with ThreadPoolExecutor(max_workers=worker_count) as executor:
        future_map = {executor.submit(_fetch_single_zone_land_metadata, pnu): pnu for pnu in fetch_targets}
        for future in as_completed(future_map):
            pnu = future_map[future]
            try:
                metadata = future.result()
            except Exception:
                metadata = {"land_category_name": None, "purpose_area_name": None}
            metadata_map[pnu] = metadata
            _store_zone_land_metadata_in_cache(redis_client, pnu, metadata)

    return metadata_map


def _fetch_single_zone_land_metadata(pnu: str) -> dict[str, str | None]:
    details = _fetch_land_characteristics_latest(pnu) or {}
    return {
        "land_category_name": _to_text_or_none(details.get("lndcgrCodeNm")),
        "purpose_area_name": _to_text_or_none(details.get("prposAreaNm") or details.get("prposArea1Nm")),
    }


def _land_metadata_cache_key(pnu: str) -> str:
    return f"map:zone-land-meta:{pnu}"


def _load_zone_land_metadata_from_cache(
    redis_client: Any,
    pnu: str,
) -> dict[str, str | None] | None:
    if redis_client is None:
        return None
    try:
        cached = redis_client.get(_land_metadata_cache_key(pnu))
    except Exception:
        return None
    if not cached:
        return None
    try:
        payload = json.loads(cached)
    except (TypeError, ValueError):
        return None
    if not isinstance(payload, dict):
        return None
    return {
        "land_category_name": _to_text_or_none(payload.get("land_category_name")),
        "purpose_area_name": _to_text_or_none(payload.get("purpose_area_name")),
    }


def _store_zone_land_metadata_in_cache(
    redis_client: Any,
    pnu: str,
    metadata: dict[str, str | None],
) -> None:
    if redis_client is None:
        return
    try:
        redis_client.setex(
            _land_metadata_cache_key(pnu),
            settings.map_price_cache_ttl_seconds,
            json.dumps(metadata, ensure_ascii=False),
        )
    except Exception:
        return


def _is_postgres(db: Session) -> bool:
    return db.bind is not None and db.bind.dialect.name == "postgresql"


def _zone_wkt_to_coordinates(zone_wkt: str) -> list[MapCoordinate]:
    text_value = (zone_wkt or "").strip()
    if not text_value.upper().startswith("POLYGON((") or not text_value.endswith("))"):
        return []

    serialized = text_value[len("POLYGON((") : -2]
    coordinates: list[MapCoordinate] = []
    for chunk in serialized.split(","):
        parts = chunk.strip().split()
        if len(parts) != 2:
            continue
        try:
            lng = float(parts[0])
            lat = float(parts[1])
        except ValueError:
            continue
        coordinates.append(MapCoordinate(lat=lat, lng=lng))

    if len(coordinates) >= 2:
        first = coordinates[0]
        last = coordinates[-1]
        if abs(first.lat - last.lat) < 1e-9 and abs(first.lng - last.lng) < 1e-9:
            coordinates = coordinates[:-1]
    return coordinates


def _calculate_estimated_total_price(area_sqm: float | None, price_current: int | None) -> int | None:
    if area_sqm is None or price_current is None:
        return None
    return int(round(float(area_sqm) * int(price_current)))


def _calculate_average_unit_price(*, assessed_total_price: int, zone_area_sqm: float) -> int | None:
    if zone_area_sqm <= 0:
        return None
    return int(round(assessed_total_price / zone_area_sqm))


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

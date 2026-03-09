from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from typing import Any


@dataclass
class VWorldParcelFeature:
    pnu: str
    geometry_json: str
    address: str
    price_current: int | None
    price_year: str | None


@dataclass
class ZoneParcelComputed:
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
    building_count: int = 0
    aged_building_count: int = 0
    average_approval_year: int | None = None
    price_previous: int | None = None
    growth_rate: float | None = None
    aged_building_ratio: float | None = None
    site_area_sqm: float | None = None
    total_floor_area_sqm: float | None = None
    floor_area_ratio: float | None = None
    building_coverage_ratio: float | None = None
    household_count: int | None = None
    primary_purpose_name: str | None = None


@dataclass
class PreparedZonePreview:
    zone_name: str
    threshold: float
    coordinates: list[tuple[float, float]]
    zone_wkt: str
    zone_area_sqm: float
    parcels: list[ZoneParcelComputed]
    summary: dict[str, Any]
    building_metrics_by_pnu: dict[str, Any]
    building_data_ready: bool
    building_data_message: str | None
    generated_at: datetime

from pydantic import BaseModel, Field

from app.schemas.land import LandResultRow


class MapClickRequest(BaseModel):
    lat: float = Field(description="위도")
    lng: float = Field(description="경도")


class MapAddressSearchRequest(BaseModel):
    address: str = Field(min_length=2, description="검색할 주소 문자열")


class MapPriceRowsResponse(BaseModel):
    pnu: str
    rows: list[LandResultRow]


class MapLandDetailsResponse(BaseModel):
    pnu: str
    stdr_year: str | None
    area: float | None
    land_category_name: str | None
    purpose_area_name: str | None
    purpose_district_name: str | None


class MapLookupResponse(BaseModel):
    lat: float
    lng: float
    pnu: str
    address_summary: str
    jibun_address: str
    road_address: str
    area: float | None
    price_current: int | None
    price_previous: int | None
    growth_rate: float | None
    estimated_total_price: int | None
    nearby_avg_price: int | None
    nearby_radius_m: int
    cache_hit: bool
    rows: list[LandResultRow]


class MapCoordinate(BaseModel):
    lat: float = Field(description="위도")
    lng: float = Field(description="경도")


class MapZoneAnalyzeRequest(BaseModel):
    zone_name: str = Field(min_length=1, max_length=100, description="사용자 지정 구역 이름")
    coordinates: list[MapCoordinate] = Field(min_length=3, description="폴리곤 좌표 목록")
    overlap_threshold: float | None = Field(default=None, ge=0.5, le=1.0, description="필지 포함 비율 임계치")


class MapZoneSaveRequest(MapZoneAnalyzeRequest):
    excluded_pnu_list: list[str] = Field(default_factory=list, description="저장 시 제외할 PNU 목록")


class MapZoneParcelExcludeRequest(BaseModel):
    pnu_list: list[str] = Field(min_length=1, description="분석 결과에서 제외할 PNU 목록")
    reason: str | None = Field(default=None, max_length=200)


class MapZoneUpdateRequest(BaseModel):
    zone_name: str = Field(min_length=1, max_length=100, description="변경할 구역 이름")


class MapZoneParcelItem(BaseModel):
    pnu: str
    jibun_address: str
    road_address: str
    land_category_name: str | None
    purpose_area_name: str | None
    geometry_geojson: str | None
    area_sqm: float
    price_current: int | None
    price_year: str | None
    estimated_total_price: int | None
    overlap_ratio: float
    included: bool
    counted_in_summary: bool
    lat: float | None
    lng: float | None


class MapZoneSummary(BaseModel):
    zone_id: str | None
    zone_name: str
    is_saved: bool
    base_year: str | None
    overlap_threshold: float
    zone_area_sqm: float
    parcel_count: int
    counted_parcel_count: int
    excluded_parcel_count: int
    average_unit_price: int | None
    assessed_total_price: int
    created_at: str
    updated_at: str


class MapZoneResponse(BaseModel):
    summary: MapZoneSummary
    coordinates: list[MapCoordinate]
    parcels: list[MapZoneParcelItem]


class MapZoneListItem(BaseModel):
    zone_id: str
    zone_name: str
    base_year: str | None
    parcel_count: int
    assessed_total_price: int
    created_at: str
    updated_at: str


class MapZoneListResponse(BaseModel):
    page: int
    page_size: int
    total_count: int
    total_pages: int
    items: list[MapZoneListItem]


class MapZoneDeleteResponse(BaseModel):
    zone_id: str
    deleted: bool

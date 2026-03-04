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

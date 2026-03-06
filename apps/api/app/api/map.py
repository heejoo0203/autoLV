from fastapi import APIRouter, Cookie, Depends, Query
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.user import User
from app.schemas.map import (
    MapAddressSearchRequest,
    MapClickRequest,
    MapLandDetailsResponse,
    MapLookupResponse,
    MapZoneAnalyzeRequest,
    MapZoneDeleteResponse,
    MapZoneListResponse,
    MapZoneParcelExcludeRequest,
    MapZoneResponse,
    MapZoneSaveRequest,
    MapZoneUpdateRequest,
    MapPriceRowsResponse,
)
from app.services.auth_service import get_user_from_access_token
from app.services.map_service import (
    export_map_csv,
    fetch_map_land_details,
    fetch_map_price_rows,
    lookup_map_by_address,
    lookup_map_by_click,
    lookup_map_by_pnu,
)
from app.services.map_zone_service import (
    analyze_zone,
    delete_zone_analysis,
    exclude_zone_parcels,
    export_zone_csv,
    get_zone_detail,
    list_zone_analyses,
    save_zone_analysis,
    update_zone_name,
)

router = APIRouter(prefix="/api/v1/map", tags=["map"])


def _get_current_user(
    access_token: str | None = Cookie(default=None),
    db: Session = Depends(get_db),
) -> User:
    return get_user_from_access_token(db, access_token)


@router.post("/click", response_model=MapLookupResponse)
def map_click_lookup(
    payload: MapClickRequest,
    db: Session = Depends(get_db),
) -> MapLookupResponse:
    return lookup_map_by_click(db=db, payload=payload)


@router.post("/search", response_model=MapLookupResponse)
def map_address_lookup(
    payload: MapAddressSearchRequest,
    db: Session = Depends(get_db),
) -> MapLookupResponse:
    return lookup_map_by_address(db=db, payload=payload)


@router.get("/by-pnu", response_model=MapLookupResponse)
def map_lookup_by_pnu(
    pnu: str = Query(..., description="필지 고유번호(PNU)"),
    db: Session = Depends(get_db),
) -> MapLookupResponse:
    return lookup_map_by_pnu(db=db, pnu=pnu)


@router.get("/price-rows", response_model=MapPriceRowsResponse)
def map_price_rows(
    pnu: str = Query(..., description="필지 고유번호(PNU)"),
) -> MapPriceRowsResponse:
    return fetch_map_price_rows(pnu=pnu)


@router.get("/land-details", response_model=MapLandDetailsResponse)
def map_land_details(
    pnu: str = Query(..., description="필지 고유번호(PNU)"),
) -> MapLandDetailsResponse:
    return fetch_map_land_details(pnu=pnu)


@router.get("/export")
def export_map_lookup_csv(
    pnu: str = Query(..., description="필지 고유번호(PNU)"),
    db: Session = Depends(get_db),
):
    return export_map_csv(db=db, pnu=pnu)


@router.post("/zones/analyze", response_model=MapZoneResponse)
def analyze_zone_lookup(
    payload: MapZoneAnalyzeRequest,
    db: Session = Depends(get_db),
    _current_user: User = Depends(_get_current_user),
) -> MapZoneResponse:
    return analyze_zone(db=db, payload=payload)


@router.post("/zones", response_model=MapZoneResponse)
def save_zone_lookup(
    payload: MapZoneSaveRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(_get_current_user),
) -> MapZoneResponse:
    return save_zone_analysis(db=db, user_id=current_user.id, payload=payload)


@router.get("/zones", response_model=MapZoneListResponse)
def list_zone_lookup(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=10, ge=1, le=50),
    db: Session = Depends(get_db),
    current_user: User = Depends(_get_current_user),
) -> MapZoneListResponse:
    return list_zone_analyses(db=db, user_id=current_user.id, page=page, page_size=page_size)


@router.get("/zones/{zone_id}", response_model=MapZoneResponse)
def get_zone_lookup(
    zone_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(_get_current_user),
) -> MapZoneResponse:
    return get_zone_detail(db=db, user_id=current_user.id, zone_id=zone_id)


@router.patch("/zones/{zone_id}/parcels/exclude", response_model=MapZoneResponse)
def exclude_zone_lookup_parcels(
    zone_id: str,
    payload: MapZoneParcelExcludeRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(_get_current_user),
) -> MapZoneResponse:
    return exclude_zone_parcels(db=db, user_id=current_user.id, zone_id=zone_id, payload=payload)


@router.patch("/zones/{zone_id}", response_model=MapZoneResponse)
def update_zone_lookup(
    zone_id: str,
    payload: MapZoneUpdateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(_get_current_user),
) -> MapZoneResponse:
    return update_zone_name(db=db, user_id=current_user.id, zone_id=zone_id, payload=payload)


@router.delete("/zones/{zone_id}", response_model=MapZoneDeleteResponse)
def delete_zone_lookup(
    zone_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(_get_current_user),
) -> MapZoneDeleteResponse:
    return delete_zone_analysis(db=db, user_id=current_user.id, zone_id=zone_id)


@router.get("/zones/{zone_id}/export")
def export_zone_lookup_csv(
    zone_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(_get_current_user),
):
    return export_zone_csv(db=db, user_id=current_user.id, zone_id=zone_id)

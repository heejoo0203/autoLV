from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.schemas.map import (
    MapAddressSearchRequest,
    MapClickRequest,
    MapLandDetailsResponse,
    MapLookupResponse,
    MapPriceRowsResponse,
)
from app.services.map_service import (
    export_map_csv,
    fetch_map_land_details,
    fetch_map_price_rows,
    lookup_map_by_address,
    lookup_map_by_click,
    lookup_map_by_pnu,
)

router = APIRouter(prefix="/api/v1/map", tags=["map"])


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

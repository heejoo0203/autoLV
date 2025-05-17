# backend/app/main.py

from fastapi import FastAPI, Query
from crawler.fetch_land_price_api import get_land_price
from crawler.pnu_util import make_pnu

app = FastAPI()

@app.get("/landprice")
def fetch_land_price(
    ld_code: str = Query(..., description="법정동코드 (10자리)"),
    main_no: int = Query(..., description="본번"),
    sub_no: int = Query(0, description="부번 (기본값 0)"),
    is_san: bool = Query(False, description="산 여부 (True면 산)")
):
    pnu = make_pnu(ld_code, main_no, sub_no, is_san)
    result = get_land_price(pnu=pnu, year="2024", api_key="EA1BD82E-E7AF-33DA-B9B6-E97EDFCA13C7")
    return result

from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

from app.schemas.land import LandResultRow


class QueryLogCreateRequest(BaseModel):
    search_type: Literal["jibun", "road", "map"]
    pnu: str = Field(min_length=19, max_length=19)
    address_summary: str = Field(default="")
    rows: list[LandResultRow] = Field(default_factory=list)


class QueryLogItemResponse(BaseModel):
    id: str
    search_type: Literal["jibun", "road", "map"]
    pnu: str
    address_summary: str
    result_count: int
    created_at: datetime


class QueryLogDetailResponse(QueryLogItemResponse):
    rows: list[LandResultRow]


class QueryLogListResponse(BaseModel):
    page: int
    page_size: int
    total_count: int
    total_pages: int
    items: list[QueryLogItemResponse]


class QueryLogDeleteRequest(BaseModel):
    log_ids: list[str] = Field(min_length=1, max_length=100)


class QueryLogDeleteResponse(BaseModel):
    deleted_count: int
    skipped_count: int
    deleted_log_ids: list[str]
    skipped_log_ids: list[str]

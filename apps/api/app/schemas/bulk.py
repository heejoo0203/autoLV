from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


BulkAddressMode = Literal["auto", "jibun", "road"]
BulkJobStatus = Literal["queued", "processing", "completed", "failed"]


class BulkGuideResponse(BaseModel):
    max_rows: int
    required_common: list[str]
    recommended_jibun: list[str]
    recommended_road: list[str]
    alias_examples: dict[str, list[str]]


class BulkJobCreateResponse(BaseModel):
    job_id: str
    status: BulkJobStatus
    total_rows: int
    created_at: datetime


class BulkJobItemResponse(BaseModel):
    job_id: str
    file_name: str
    status: BulkJobStatus
    total_rows: int
    processed_rows: int
    success_rows: int
    failed_rows: int
    progress_percent: float = Field(ge=0, le=100)
    created_at: datetime
    updated_at: datetime
    error_message: str | None = None
    can_download: bool


class BulkJobListResponse(BaseModel):
    page: int
    page_size: int
    total_count: int
    total_pages: int
    items: list[BulkJobItemResponse]


class BulkJobDeleteRequest(BaseModel):
    job_ids: list[str] = Field(min_length=1, max_length=100)


class BulkJobDeleteResponse(BaseModel):
    deleted_count: int
    skipped_count: int
    deleted_job_ids: list[str]
    skipped_job_ids: list[str]

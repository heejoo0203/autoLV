from __future__ import annotations

import uuid
from pathlib import Path

from fastapi import BackgroundTasks, HTTPException, status
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.bulk_job import BulkJob
from app.repositories.bulk_job_repository import create_bulk_job
from app.schemas.bulk import BulkGuideResponse, BulkJobItemResponse
from app.services.bulk.constants import HEADER_ALIASES, REQUIRED_COMMON, RECOMMENDED_JIBUN, RECOMMENDED_ROAD
from app.services.bulk.job_storage import save_uploaded_file
from app.services.bulk.processor import process_bulk_job
from app.services.bulk.queue import enqueue_bulk_job_message, is_bulk_queue_enabled
from app.services.bulk.table_reader import load_tabular_data

_ALLOWED_EXTENSIONS = {".xlsx", ".xls", ".csv"}


def create_bulk_job_and_schedule(
    *,
    db: Session,
    user_id: str,
    file_name: str,
    file_bytes: bytes,
    address_mode: str,
    background_tasks: BackgroundTasks,
) -> BulkJob:
    ext = Path(file_name).suffix.lower()
    if ext not in _ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "BULK_FILE_INVALID", "message": "지원하지 않는 파일 형식입니다. (.xlsx, .xls, .csv)"},
        )
    if not file_bytes:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "BULK_FILE_INVALID", "message": "빈 파일은 업로드할 수 없습니다."},
        )

    job_id = str(uuid.uuid4())
    upload_path = save_uploaded_file(job_id=job_id, original_name=file_name, content=file_bytes)
    try:
        table = load_tabular_data(upload_path)
    except Exception as exc:  # noqa: BLE001
        upload_path.unlink(missing_ok=True)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "BULK_FILE_INVALID", "message": f"파일 파싱에 실패했습니다: {exc}"},
        ) from exc

    total_rows = len(table.rows)
    if total_rows == 0:
        upload_path.unlink(missing_ok=True)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "BULK_FILE_INVALID", "message": "데이터 행이 없습니다. 헤더와 데이터를 확인해 주세요."},
        )
    if total_rows > settings.bulk_max_rows:
        upload_path.unlink(missing_ok=True)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "code": "BULK_ROW_LIMIT_EXCEEDED",
                "message": f"최대 {settings.bulk_max_rows:,}행까지만 업로드할 수 있습니다.",
            },
        )

    job = create_bulk_job(
        db,
        job_id=job_id,
        user_id=user_id,
        file_name=file_name,
        upload_path=str(upload_path),
        total_rows=total_rows,
    )
    if is_bulk_queue_enabled():
        try:
            enqueue_bulk_job_message(job_id=job.id, address_mode=address_mode)
        except Exception as exc:  # noqa: BLE001
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail={"code": "BULK_QUEUE_UNAVAILABLE", "message": f"작업 큐 연결에 실패했습니다: {exc}"},
            ) from exc
    else:
        background_tasks.add_task(process_bulk_job, job_id=job.id, address_mode=address_mode)
    return job


def build_bulk_guide() -> BulkGuideResponse:
    return BulkGuideResponse(
        max_rows=settings.bulk_max_rows,
        required_common=REQUIRED_COMMON,
        recommended_jibun=RECOMMENDED_JIBUN,
        recommended_road=RECOMMENDED_ROAD,
        alias_examples={
            "시도": HEADER_ALIASES["sido"][:2],
            "본번": HEADER_ALIASES["main_no"][:2],
            "주소": HEADER_ALIASES["full_address"][:2],
        },
    )


def to_bulk_job_item(job: BulkJob) -> BulkJobItemResponse:
    progress = 0.0
    if job.total_rows > 0:
        progress = round((job.processed_rows / job.total_rows) * 100, 2)

    return BulkJobItemResponse(
        job_id=job.id,
        file_name=job.file_name,
        status=job.status,
        total_rows=job.total_rows,
        processed_rows=job.processed_rows,
        success_rows=job.success_rows,
        failed_rows=job.failed_rows,
        progress_percent=progress,
        created_at=job.created_at,
        updated_at=job.updated_at,
        error_message=job.error_message,
        can_download=bool(job.result_path) and job.status == "completed",
    )

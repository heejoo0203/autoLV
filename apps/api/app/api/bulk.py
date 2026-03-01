from __future__ import annotations

from pathlib import Path
from typing import Literal

from fastapi import APIRouter, BackgroundTasks, Cookie, Depends, File, Form, Query, UploadFile, status
from fastapi.responses import FileResponse, Response
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.user import User
from app.repositories.bulk_job_repository import (
    count_bulk_jobs_by_user,
    delete_bulk_jobs_by_ids,
    get_bulk_job_by_id,
    get_bulk_jobs_by_ids,
    list_bulk_jobs_by_user,
)
from app.schemas.bulk import (
    BulkJobDeleteRequest,
    BulkJobDeleteResponse,
    BulkGuideResponse,
    BulkJobCreateResponse,
    BulkJobItemResponse,
    BulkJobListResponse,
)
from app.services.auth_service import get_user_from_access_token
from app.services.bulk.job_service import build_bulk_guide, create_bulk_job_and_schedule, to_bulk_job_item
from app.services.bulk.template_service import build_template_workbook_bytes

router = APIRouter(prefix="/api/v1/bulk", tags=["bulk"])


def _get_current_user(
    access_token: str | None = Cookie(default=None),
    db: Session = Depends(get_db),
) -> User:
    return get_user_from_access_token(db, access_token)


@router.get("/guide", response_model=BulkGuideResponse)
def get_bulk_guide() -> BulkGuideResponse:
    return build_bulk_guide()


@router.get("/template")
def download_bulk_template() -> Response:
    content = build_template_workbook_bytes()
    return Response(
        content=content,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": 'attachment; filename="autolv_bulk_template.xlsx"'},
    )


@router.post("/jobs", response_model=BulkJobCreateResponse, status_code=status.HTTP_202_ACCEPTED)
async def create_bulk_job(
    background_tasks: BackgroundTasks,
    address_mode: Literal["auto", "jibun", "road"] = Form(default="auto"),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(_get_current_user),
) -> BulkJobCreateResponse:
    file_name = file.filename or "upload.xlsx"
    contents = await file.read()
    job = create_bulk_job_and_schedule(
        db=db,
        user_id=current_user.id,
        file_name=file_name,
        file_bytes=contents,
        address_mode=address_mode,
        background_tasks=background_tasks,
    )
    return BulkJobCreateResponse(
        job_id=job.id,
        status=job.status,
        total_rows=job.total_rows,
        created_at=job.created_at,
    )


@router.get("/jobs", response_model=BulkJobListResponse)
def get_bulk_jobs(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=10, ge=1, le=10),
    db: Session = Depends(get_db),
    current_user: User = Depends(_get_current_user),
) -> BulkJobListResponse:
    total_count = count_bulk_jobs_by_user(db, current_user.id)
    total_pages = max(1, (total_count + page_size - 1) // page_size)
    current_page = min(page, total_pages)
    offset = (current_page - 1) * page_size

    jobs = list_bulk_jobs_by_user(db, current_user.id, limit=page_size, offset=offset)
    return BulkJobListResponse(
        page=current_page,
        page_size=page_size,
        total_count=total_count,
        total_pages=total_pages,
        items=[to_bulk_job_item(job) for job in jobs],
    )


@router.get("/jobs/{job_id}", response_model=BulkJobItemResponse)
def get_bulk_job(
    job_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(_get_current_user),
) -> BulkJobItemResponse:
    job = get_bulk_job_by_id(db, job_id)
    if not job or job.user_id != current_user.id:
        return _raise_not_found()
    return to_bulk_job_item(job)


@router.get("/jobs/{job_id}/download")
def download_bulk_job_result(
    job_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(_get_current_user),
) -> FileResponse:
    job = get_bulk_job_by_id(db, job_id)
    if not job or job.user_id != current_user.id:
        return _raise_not_found()
    if job.status != "completed" or not job.result_path:
        return _raise_job_not_ready()

    result_path = Path(job.result_path)
    if not result_path.exists():
        return _raise_job_not_ready()

    download_name = f"{Path(job.file_name).stem}_result.xlsx"
    return FileResponse(
        path=result_path,
        filename=download_name,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    )


@router.post("/jobs/delete", response_model=BulkJobDeleteResponse)
def delete_bulk_jobs(
    payload: BulkJobDeleteRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(_get_current_user),
) -> BulkJobDeleteResponse:
    candidates = get_bulk_jobs_by_ids(db, user_id=current_user.id, job_ids=payload.job_ids)
    deletable_ids: list[str] = []
    skipped_ids: list[str] = []
    path_map: dict[str, tuple[str | None, str | None]] = {}

    for job in candidates:
        if job.status == "processing":
            skipped_ids.append(job.id)
            continue
        deletable_ids.append(job.id)
        path_map[job.id] = (job.upload_path, job.result_path)

    if deletable_ids:
        delete_bulk_jobs_by_ids(db, user_id=current_user.id, job_ids=deletable_ids)

    for job_id in deletable_ids:
        upload_path, result_path = path_map.get(job_id, (None, None))
        _safe_unlink(upload_path)
        _safe_unlink(result_path)

    not_found_ids = [job_id for job_id in payload.job_ids if job_id not in {job.id for job in candidates}]
    skipped_ids.extend(not_found_ids)

    return BulkJobDeleteResponse(
        deleted_count=len(deletable_ids),
        skipped_count=len(skipped_ids),
        deleted_job_ids=deletable_ids,
        skipped_job_ids=skipped_ids,
    )


def _raise_not_found() -> None:
    from fastapi import HTTPException

    raise HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail={"code": "BULK_JOB_NOT_FOUND", "message": "작업 정보를 찾을 수 없습니다."},
    )


def _raise_job_not_ready() -> None:
    from fastapi import HTTPException

    raise HTTPException(
        status_code=status.HTTP_409_CONFLICT,
        detail={"code": "BULK_JOB_NOT_READY", "message": "작업이 완료되지 않았습니다."},
    )


def _safe_unlink(path_value: str | None) -> None:
    if not path_value:
        return
    try:
        Path(path_value).unlink(missing_ok=True)
    except OSError:
        return

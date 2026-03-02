from __future__ import annotations

import json

from fastapi import APIRouter, Cookie, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.query_log import QueryLog
from app.models.user import User
from app.repositories.query_log_repository import (
    count_query_logs_by_user,
    create_query_log,
    get_query_log_by_id,
    list_query_logs_by_user,
)
from app.schemas.history import (
    QueryLogCreateRequest,
    QueryLogDetailResponse,
    QueryLogItemResponse,
    QueryLogListResponse,
)
from app.schemas.land import LandResultRow
from app.services.auth_service import get_user_from_access_token

router = APIRouter(prefix="/api/v1/history", tags=["history"])


def _get_current_user(
    access_token: str | None = Cookie(default=None),
    db: Session = Depends(get_db),
) -> User:
    return get_user_from_access_token(db, access_token)


@router.post("/query-logs", response_model=QueryLogItemResponse, status_code=status.HTTP_201_CREATED)
def create_history_log(
    payload: QueryLogCreateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(_get_current_user),
) -> QueryLogItemResponse:
    rows_json = json.dumps([row.model_dump() for row in payload.rows], ensure_ascii=False)
    result = create_query_log(
        db,
        user_id=current_user.id,
        search_type=payload.search_type,
        pnu=payload.pnu,
        address_summary=payload.address_summary.strip(),
        rows_json=rows_json,
        result_count=len(payload.rows),
    )
    return _to_item_response(result)


@router.get("/query-logs", response_model=QueryLogListResponse)
def list_history_logs(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(_get_current_user),
) -> QueryLogListResponse:
    total_count = count_query_logs_by_user(db, user_id=current_user.id)
    total_pages = max(1, (total_count + page_size - 1) // page_size)
    current_page = min(page, total_pages)
    offset = (current_page - 1) * page_size
    items = list_query_logs_by_user(db, user_id=current_user.id, limit=page_size, offset=offset)
    return QueryLogListResponse(
        page=current_page,
        page_size=page_size,
        total_count=total_count,
        total_pages=total_pages,
        items=[_to_item_response(item) for item in items],
    )


@router.get("/query-logs/{log_id}", response_model=QueryLogDetailResponse)
def get_history_log(
    log_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(_get_current_user),
) -> QueryLogDetailResponse:
    item = get_query_log_by_id(db, user_id=current_user.id, log_id=log_id)
    if not item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "QUERY_LOG_NOT_FOUND", "message": "조회기록을 찾을 수 없습니다."},
        )
    return _to_detail_response(item)


def _to_item_response(item: QueryLog) -> QueryLogItemResponse:
    return QueryLogItemResponse(
        id=item.id,
        search_type=item.search_type,  # type: ignore[arg-type]
        pnu=item.pnu,
        address_summary=item.address_summary,
        result_count=item.result_count,
        created_at=item.created_at,
    )


def _to_detail_response(item: QueryLog) -> QueryLogDetailResponse:
    rows_payload: list[dict] = []
    try:
        parsed = json.loads(item.rows_json)
        if isinstance(parsed, list):
            rows_payload = [row for row in parsed if isinstance(row, dict)]
    except json.JSONDecodeError:
        rows_payload = []
    rows = [LandResultRow.model_validate(row) for row in rows_payload]

    return QueryLogDetailResponse(
        id=item.id,
        search_type=item.search_type,  # type: ignore[arg-type]
        pnu=item.pnu,
        address_summary=item.address_summary,
        result_count=item.result_count,
        created_at=item.created_at,
        rows=rows,
    )

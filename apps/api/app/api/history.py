from __future__ import annotations

import json
from datetime import datetime, timedelta, timezone
from typing import Literal

from fastapi import APIRouter, Cookie, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.query_log import QueryLog
from app.models.user import User
from app.repositories.query_log_repository import (
    count_query_logs_by_user,
    create_query_log,
    delete_query_logs_by_ids,
    get_latest_query_log_by_user,
    get_query_log_by_id,
    get_query_logs_by_ids,
    list_query_logs_by_user,
    update_query_log_content,
)
from app.schemas.history import (
    QueryLogCreateRequest,
    QueryLogDeleteRequest,
    QueryLogDeleteResponse,
    QueryLogDetailResponse,
    QueryLogItemResponse,
    QueryLogListResponse,
)
from app.schemas.land import LandResultRow
from app.services.auth_service import get_user_from_access_token

router = APIRouter(prefix="/api/v1/history", tags=["history"])
RECENT_QUERY_MERGE_WINDOW_SECONDS = 180


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
    incoming_summary = payload.address_summary.strip()
    incoming_count = len(payload.rows)

    latest = get_latest_query_log_by_user(db, user_id=current_user.id)
    result = None
    if latest and _is_merge_target(latest=latest, payload=payload):
        should_refresh = incoming_count > latest.result_count or (
            incoming_summary and incoming_summary != latest.address_summary
        )
        if should_refresh:
            result = update_query_log_content(
                db,
                log=latest,
                address_summary=incoming_summary or latest.address_summary,
                rows_json=rows_json,
                result_count=incoming_count,
            )
        else:
            result = latest
    else:
        result = create_query_log(
            db,
            user_id=current_user.id,
            search_type=payload.search_type,
            pnu=payload.pnu,
            address_summary=incoming_summary,
            rows_json=rows_json,
            result_count=incoming_count,
        )
    return _to_item_response(result)


def _is_merge_target(*, latest: QueryLog, payload: QueryLogCreateRequest) -> bool:
    if latest.search_type != payload.search_type:
        return False
    if latest.pnu != payload.pnu:
        return False
    created_at = latest.created_at
    if created_at.tzinfo is None:
        created_at = created_at.replace(tzinfo=timezone.utc)
    now = datetime.now(timezone.utc)
    return (now - created_at) <= timedelta(seconds=RECENT_QUERY_MERGE_WINDOW_SECONDS)


@router.get("/query-logs", response_model=QueryLogListResponse)
def list_history_logs(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    search_type: Literal["jibun", "road", "map"] | None = Query(default=None),
    sido: str | None = Query(default=None, description="시/도 키워드"),
    sigungu: str | None = Query(default=None, description="시/군/구 키워드"),
    sort_by: Literal["created_at", "address_summary", "search_type", "result_count"] = Query(
        default="created_at"
    ),
    sort_order: Literal["asc", "desc"] = Query(default="desc"),
    db: Session = Depends(get_db),
    current_user: User = Depends(_get_current_user),
) -> QueryLogListResponse:
    total_count = count_query_logs_by_user(
        db,
        user_id=current_user.id,
        search_type=search_type,
        sido=(sido or "").strip() or None,
        sigungu=(sigungu or "").strip() or None,
    )
    total_pages = max(1, (total_count + page_size - 1) // page_size)
    current_page = min(page, total_pages)
    offset = (current_page - 1) * page_size
    items = list_query_logs_by_user(
        db,
        user_id=current_user.id,
        limit=page_size,
        offset=offset,
        search_type=search_type,
        sido=(sido or "").strip() or None,
        sigungu=(sigungu or "").strip() or None,
        sort_by=sort_by,
        sort_order=sort_order,
    )
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


@router.post("/query-logs/delete", response_model=QueryLogDeleteResponse)
def delete_history_logs(
    payload: QueryLogDeleteRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(_get_current_user),
) -> QueryLogDeleteResponse:
    candidates = get_query_logs_by_ids(db, user_id=current_user.id, log_ids=payload.log_ids)
    deletable_ids = [item.id for item in candidates]
    if deletable_ids:
        delete_query_logs_by_ids(db, user_id=current_user.id, log_ids=deletable_ids)

    found_set = {item.id for item in candidates}
    skipped_ids = [log_id for log_id in payload.log_ids if log_id not in found_set]
    return QueryLogDeleteResponse(
        deleted_count=len(deletable_ids),
        skipped_count=len(skipped_ids),
        deleted_log_ids=deletable_ids,
        skipped_log_ids=skipped_ids,
    )


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

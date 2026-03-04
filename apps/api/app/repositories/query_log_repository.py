from __future__ import annotations

from sqlalchemy import delete, func, select
from sqlalchemy.orm import Session

from app.models.query_log import QueryLog


def create_query_log(
    db: Session,
    *,
    user_id: str,
    search_type: str,
    pnu: str,
    address_summary: str,
    rows_json: str,
    result_count: int,
) -> QueryLog:
    log = QueryLog(
        user_id=user_id,
        search_type=search_type,
        pnu=pnu,
        address_summary=address_summary,
        rows_json=rows_json,
        result_count=result_count,
    )
    db.add(log)
    db.commit()
    db.refresh(log)
    return log


def get_latest_query_log_by_user(
    db: Session,
    *,
    user_id: str,
) -> QueryLog | None:
    stmt = (
        select(QueryLog)
        .where(QueryLog.user_id == user_id)
        .order_by(QueryLog.created_at.desc())
        .limit(1)
    )
    return db.scalar(stmt)


def update_query_log_content(
    db: Session,
    *,
    log: QueryLog,
    address_summary: str,
    rows_json: str,
    result_count: int,
) -> QueryLog:
    log.address_summary = address_summary
    log.rows_json = rows_json
    log.result_count = result_count
    db.add(log)
    db.commit()
    db.refresh(log)
    return log


def get_query_log_by_id(db: Session, *, user_id: str, log_id: str) -> QueryLog | None:
    stmt = select(QueryLog).where(QueryLog.id == log_id, QueryLog.user_id == user_id)
    return db.scalar(stmt)


def count_query_logs_by_user(
    db: Session,
    *,
    user_id: str,
    search_type: str | None = None,
    sido: str | None = None,
    sigungu: str | None = None,
) -> int:
    conditions = _build_conditions(user_id=user_id, search_type=search_type, sido=sido, sigungu=sigungu)
    stmt = select(func.count(QueryLog.id)).where(*conditions)
    return int(db.scalar(stmt) or 0)


def list_query_logs_by_user(
    db: Session,
    *,
    user_id: str,
    limit: int = 20,
    offset: int = 0,
    search_type: str | None = None,
    sido: str | None = None,
    sigungu: str | None = None,
    sort_by: str = "created_at",
    sort_order: str = "desc",
) -> list[QueryLog]:
    conditions = _build_conditions(user_id=user_id, search_type=search_type, sido=sido, sigungu=sigungu)
    order_column_map = {
        "created_at": QueryLog.created_at,
        "address_summary": QueryLog.address_summary,
        "search_type": QueryLog.search_type,
        "result_count": QueryLog.result_count,
    }
    order_column = order_column_map.get(sort_by, QueryLog.created_at)
    order_by = order_column.asc() if sort_order == "asc" else order_column.desc()

    stmt = (
        select(QueryLog)
        .where(*conditions)
        .order_by(order_by, QueryLog.created_at.desc())
        .offset(offset)
        .limit(limit)
    )
    return list(db.scalars(stmt))


def delete_query_logs_by_user(db: Session, *, user_id: str) -> int:
    stmt = delete(QueryLog).where(QueryLog.user_id == user_id)
    result = db.execute(stmt)
    db.commit()
    return int(result.rowcount or 0)


def _build_conditions(
    *,
    user_id: str,
    search_type: str | None,
    sido: str | None,
    sigungu: str | None,
) -> list:
    conditions = [QueryLog.user_id == user_id]
    if search_type:
        conditions.append(QueryLog.search_type == search_type)
    if sido:
        conditions.append(QueryLog.address_summary.ilike(f"%{sido}%"))
    if sigungu:
        conditions.append(QueryLog.address_summary.ilike(f"%{sigungu}%"))
    return conditions

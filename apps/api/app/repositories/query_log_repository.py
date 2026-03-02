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


def get_query_log_by_id(db: Session, *, user_id: str, log_id: str) -> QueryLog | None:
    stmt = select(QueryLog).where(QueryLog.id == log_id, QueryLog.user_id == user_id)
    return db.scalar(stmt)


def count_query_logs_by_user(db: Session, *, user_id: str) -> int:
    stmt = select(func.count(QueryLog.id)).where(QueryLog.user_id == user_id)
    return int(db.scalar(stmt) or 0)


def list_query_logs_by_user(db: Session, *, user_id: str, limit: int = 20, offset: int = 0) -> list[QueryLog]:
    stmt = (
        select(QueryLog)
        .where(QueryLog.user_id == user_id)
        .order_by(QueryLog.created_at.desc())
        .offset(offset)
        .limit(limit)
    )
    return list(db.scalars(stmt))


def delete_query_logs_by_user(db: Session, *, user_id: str) -> int:
    stmt = delete(QueryLog).where(QueryLog.user_id == user_id)
    result = db.execute(stmt)
    db.commit()
    return int(result.rowcount or 0)

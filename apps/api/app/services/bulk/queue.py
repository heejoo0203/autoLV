from __future__ import annotations

import json
import logging
import time
from typing import Any

from redis import Redis
from redis.exceptions import RedisError

from app.core.config import settings

logger = logging.getLogger(__name__)


def is_bulk_queue_enabled() -> bool:
    return settings.bulk_execution_mode == "queue" and bool(settings.redis_url.strip())


def enqueue_bulk_job_message(*, job_id: str, address_mode: str) -> None:
    client = _get_redis_client()
    if client is None:
        raise RuntimeError("Redis 연결이 없어 bulk queue를 사용할 수 없습니다.")

    payload = json.dumps(
        {
            "job_id": job_id,
            "address_mode": address_mode,
            "enqueued_at": int(time.time()),
        },
        ensure_ascii=False,
    )
    client.rpush(settings.bulk_queue_name, payload)


def reserve_bulk_job_message(timeout_seconds: int | None = None) -> str | None:
    client = _get_redis_client()
    if client is None:
        return None

    timeout = timeout_seconds if timeout_seconds is not None else settings.bulk_worker_poll_seconds
    try:
        return client.brpoplpush(
            settings.bulk_queue_name,
            settings.bulk_queue_processing_name,
            timeout=max(1, int(timeout)),
        )
    except RedisError:
        logger.exception("bulk queue reserve failed")
        return None


def ack_bulk_job_message(raw_message: str) -> None:
    client = _get_redis_client()
    if client is None:
        return

    try:
        client.lrem(settings.bulk_queue_processing_name, 1, raw_message)
    except RedisError:
        logger.exception("bulk queue ack failed")


def requeue_processing_jobs() -> int:
    client = _get_redis_client()
    if client is None:
        return 0

    moved = 0
    try:
        while True:
            raw_message = client.rpoplpush(settings.bulk_queue_processing_name, settings.bulk_queue_name)
            if raw_message is None:
                break
            moved += 1
    except RedisError:
        logger.exception("bulk queue requeue failed")
    return moved


def parse_bulk_job_message(raw_message: str) -> dict[str, Any]:
    payload = json.loads(raw_message)
    if not isinstance(payload, dict):
        raise ValueError("bulk queue payload must be an object")
    job_id = str(payload.get("job_id", "")).strip()
    address_mode = str(payload.get("address_mode", "")).strip()
    if not job_id or not address_mode:
        raise ValueError("bulk queue payload missing job_id/address_mode")
    return {
        "job_id": job_id,
        "address_mode": address_mode,
        "enqueued_at": payload.get("enqueued_at"),
    }


def _get_redis_client() -> Redis | None:
    if not settings.redis_url.strip():
        return None
    return Redis.from_url(settings.redis_url, decode_responses=True, socket_timeout=3.0)

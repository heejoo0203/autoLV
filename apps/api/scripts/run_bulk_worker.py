from __future__ import annotations

import logging
import signal
import sys
from pathlib import Path


BASE_DIR = Path(__file__).resolve().parents[1]
if str(BASE_DIR) not in sys.path:
    sys.path.insert(0, str(BASE_DIR))

from app.core.config import settings  # noqa: E402
from app.services.bulk.processor import process_bulk_job  # noqa: E402
from app.services.bulk.queue import (  # noqa: E402
    ack_bulk_job_message,
    is_bulk_queue_enabled,
    parse_bulk_job_message,
    requeue_processing_jobs,
    reserve_bulk_job_message,
)


logging.basicConfig(level=logging.INFO, format="[bulk-worker] %(levelname)s %(message)s")
logger = logging.getLogger("bulk-worker")

_RUNNING = True


def _stop(*_: object) -> None:
    global _RUNNING
    _RUNNING = False


def main() -> int:
    if not is_bulk_queue_enabled():
        logger.error("bulk queue가 비활성화되어 있습니다. REDIS_URL 또는 BULK_EXECUTION_MODE 설정을 확인해 주세요.")
        return 1

    signal.signal(signal.SIGINT, _stop)
    signal.signal(signal.SIGTERM, _stop)

    recovered = requeue_processing_jobs()
    if recovered:
        logger.info("처리 중 큐에 남아 있던 작업 %s건을 재큐잉했습니다.", recovered)

    logger.info("bulk worker started queue=%s", settings.bulk_queue_name)
    while _RUNNING:
        raw_message = reserve_bulk_job_message()
        if not raw_message:
            continue

        try:
            payload = parse_bulk_job_message(raw_message)
            logger.info("processing job_id=%s address_mode=%s", payload["job_id"], payload["address_mode"])
            process_bulk_job(job_id=payload["job_id"], address_mode=payload["address_mode"])
        except Exception:
            logger.exception("bulk worker job failed before ack")
        finally:
            ack_bulk_job_message(raw_message)

    logger.info("bulk worker stopped")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

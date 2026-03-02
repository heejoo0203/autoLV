import uuid
from datetime import datetime, timezone

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class QueryLog(Base):
    __tablename__ = "query_logs"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"), nullable=False, index=True)
    search_type: Mapped[str] = mapped_column(String(10), nullable=False)
    pnu: Mapped[str] = mapped_column(String(19), nullable=False, index=True)
    address_summary: Mapped[str] = mapped_column(String(300), nullable=False, default="")
    rows_json: Mapped[str] = mapped_column(Text, nullable=False, default="[]")
    result_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc), index=True
    )

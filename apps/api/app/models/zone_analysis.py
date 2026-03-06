import uuid
from datetime import datetime, timezone

from sqlalchemy import BigInteger, DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class ZoneAnalysis(Base):
    __tablename__ = "zone_analyses"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"), nullable=False, index=True)
    zone_name: Mapped[str] = mapped_column(String(100), nullable=False)
    zone_wkt: Mapped[str] = mapped_column(Text, nullable=False)
    overlap_threshold: Mapped[float] = mapped_column(Float, nullable=False, default=0.9)
    zone_area_sqm: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    base_year: Mapped[str | None] = mapped_column(String(4), nullable=True)
    parcel_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    counted_parcel_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    excluded_parcel_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    unit_price_sum: Mapped[int] = mapped_column(BigInteger, nullable=False, default=0)
    assessed_total_price: Mapped[int] = mapped_column(BigInteger, nullable=False, default=0)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc), index=True
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

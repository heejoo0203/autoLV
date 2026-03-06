import uuid
from datetime import datetime, timezone

from sqlalchemy import BigInteger, DateTime, Float, ForeignKey, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class ZoneAnalysisParcel(Base):
    __tablename__ = "zone_analysis_parcels"
    __table_args__ = (UniqueConstraint("zone_analysis_id", "pnu", name="uq_zone_analysis_parcel"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    zone_analysis_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("zone_analyses.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    pnu: Mapped[str] = mapped_column(String(19), nullable=False, index=True)
    jibun_address: Mapped[str] = mapped_column(String(300), nullable=False, default="")
    road_address: Mapped[str] = mapped_column(String(300), nullable=False, default="")
    area_sqm: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    price_current: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    price_year: Mapped[str | None] = mapped_column(String(4), nullable=True)
    overlap_ratio: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    included: Mapped[bool] = mapped_column(nullable=False, default=True)
    excluded_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    excluded_reason: Mapped[str | None] = mapped_column(String(200), nullable=True)
    lat: Mapped[float | None] = mapped_column(Float, nullable=True)
    lng: Mapped[float | None] = mapped_column(Float, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

import uuid
from datetime import datetime, timezone

from sqlalchemy import Boolean, DateTime, Float, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class BuildingRegisterCache(Base):
    __tablename__ = "building_register_caches"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    pnu: Mapped[str] = mapped_column(String(19), nullable=False, unique=True, index=True)
    has_building_register: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    building_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    aged_building_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    residential_building_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    approval_year_sum: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    approval_year_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    average_approval_year: Mapped[int | None] = mapped_column(Integer, nullable=True)
    total_floor_area_sqm: Mapped[float | None] = mapped_column(Float, nullable=True)
    site_area_sqm: Mapped[float | None] = mapped_column(Float, nullable=True)
    floor_area_ratio: Mapped[float | None] = mapped_column(Float, nullable=True)
    building_coverage_ratio: Mapped[float | None] = mapped_column(Float, nullable=True)
    household_count: Mapped[int | None] = mapped_column(Integer, nullable=True)
    primary_purpose_name: Mapped[str | None] = mapped_column(String(120), nullable=True)
    synced_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc), index=True
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

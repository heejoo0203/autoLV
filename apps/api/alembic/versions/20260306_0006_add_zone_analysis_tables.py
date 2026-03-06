"""add zone analysis tables

Revision ID: 20260306_0006
Revises: 20260305_0005
Create Date: 2026-03-06 09:50:00.000000
"""

from __future__ import annotations

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "20260306_0006"
down_revision: Union[str, None] = "20260305_0005"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    tables = set(inspector.get_table_names())

    if "zone_analyses" not in tables:
        op.create_table(
            "zone_analyses",
            sa.Column("id", sa.String(length=36), nullable=False),
            sa.Column("user_id", sa.String(length=36), nullable=False),
            sa.Column("zone_name", sa.String(length=100), nullable=False),
            sa.Column("zone_wkt", sa.Text(), nullable=False),
            sa.Column("overlap_threshold", sa.Float(), nullable=False, server_default="0.9"),
            sa.Column("zone_area_sqm", sa.Float(), nullable=False, server_default="0"),
            sa.Column("base_year", sa.String(length=4), nullable=True),
            sa.Column("parcel_count", sa.Integer(), nullable=False, server_default="0"),
            sa.Column("counted_parcel_count", sa.Integer(), nullable=False, server_default="0"),
            sa.Column("excluded_parcel_count", sa.Integer(), nullable=False, server_default="0"),
            sa.Column("unit_price_sum", sa.BigInteger(), nullable=False, server_default="0"),
            sa.Column("assessed_total_price", sa.BigInteger(), nullable=False, server_default="0"),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
            sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
            sa.PrimaryKeyConstraint("id"),
        )

    refreshed = sa.inspect(bind)
    zone_indexes = (
        {idx["name"] for idx in refreshed.get_indexes("zone_analyses")}
        if "zone_analyses" in refreshed.get_table_names()
        else set()
    )
    if "ix_zone_analyses_user_id" not in zone_indexes:
        op.create_index("ix_zone_analyses_user_id", "zone_analyses", ["user_id"], unique=False)
    if "ix_zone_analyses_created_at" not in zone_indexes:
        op.create_index("ix_zone_analyses_created_at", "zone_analyses", ["created_at"], unique=False)

    if "zone_analysis_parcels" not in tables:
        op.create_table(
            "zone_analysis_parcels",
            sa.Column("id", sa.String(length=36), nullable=False),
            sa.Column("zone_analysis_id", sa.String(length=36), nullable=False),
            sa.Column("pnu", sa.String(length=19), nullable=False),
            sa.Column("jibun_address", sa.String(length=300), nullable=False, server_default=""),
            sa.Column("road_address", sa.String(length=300), nullable=False, server_default=""),
            sa.Column("area_sqm", sa.Float(), nullable=False, server_default="0"),
            sa.Column("price_current", sa.BigInteger(), nullable=True),
            sa.Column("price_year", sa.String(length=4), nullable=True),
            sa.Column("overlap_ratio", sa.Float(), nullable=False, server_default="0"),
            sa.Column("included", sa.Boolean(), nullable=False, server_default=sa.text("true")),
            sa.Column("excluded_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("excluded_reason", sa.String(length=200), nullable=True),
            sa.Column("lat", sa.Float(), nullable=True),
            sa.Column("lng", sa.Float(), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
            sa.ForeignKeyConstraint(["zone_analysis_id"], ["zone_analyses.id"], ondelete="CASCADE"),
            sa.PrimaryKeyConstraint("id"),
            sa.UniqueConstraint("zone_analysis_id", "pnu", name="uq_zone_analysis_parcel"),
        )

    refreshed = sa.inspect(bind)
    detail_indexes = (
        {idx["name"] for idx in refreshed.get_indexes("zone_analysis_parcels")}
        if "zone_analysis_parcels" in refreshed.get_table_names()
        else set()
    )
    if "ix_zone_analysis_parcels_zone_analysis_id" not in detail_indexes:
        op.create_index(
            "ix_zone_analysis_parcels_zone_analysis_id",
            "zone_analysis_parcels",
            ["zone_analysis_id"],
            unique=False,
        )
    if "ix_zone_analysis_parcels_pnu" not in detail_indexes:
        op.create_index("ix_zone_analysis_parcels_pnu", "zone_analysis_parcels", ["pnu"], unique=False)


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    tables = set(inspector.get_table_names())

    if "zone_analysis_parcels" in tables:
        indexes = {idx["name"] for idx in inspector.get_indexes("zone_analysis_parcels")}
        if "ix_zone_analysis_parcels_pnu" in indexes:
            op.drop_index("ix_zone_analysis_parcels_pnu", table_name="zone_analysis_parcels")
        if "ix_zone_analysis_parcels_zone_analysis_id" in indexes:
            op.drop_index("ix_zone_analysis_parcels_zone_analysis_id", table_name="zone_analysis_parcels")
        op.drop_table("zone_analysis_parcels")

    if "zone_analyses" in tables:
        indexes = {idx["name"] for idx in inspector.get_indexes("zone_analyses")}
        if "ix_zone_analyses_created_at" in indexes:
            op.drop_index("ix_zone_analyses_created_at", table_name="zone_analyses")
        if "ix_zone_analyses_user_id" in indexes:
            op.drop_index("ix_zone_analyses_user_id", table_name="zone_analyses")
        op.drop_table("zone_analyses")

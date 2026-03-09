"""add building register extra metrics

Revision ID: 20260310_0010
Revises: 20260309_0009
Create Date: 2026-03-10 10:30:00.000000
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = "20260310_0010"
down_revision = "20260309_0009"
branch_labels = None
depends_on = None


def _column_names(table_name: str) -> set[str]:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    return {column["name"] for column in inspector.get_columns(table_name)}


def upgrade() -> None:
    columns = _column_names("building_register_caches")

    if "building_coverage_ratio" not in columns:
        op.add_column("building_register_caches", sa.Column("building_coverage_ratio", sa.Float(), nullable=True))

    if "household_count" not in columns:
        op.add_column("building_register_caches", sa.Column("household_count", sa.Integer(), nullable=True))


def downgrade() -> None:
    columns = _column_names("building_register_caches")

    if "household_count" in columns:
        op.drop_column("building_register_caches", "household_count")

    if "building_coverage_ratio" in columns:
        op.drop_column("building_register_caches", "building_coverage_ratio")

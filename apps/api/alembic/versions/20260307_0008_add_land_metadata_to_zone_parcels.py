"""add land metadata to zone analysis parcels

Revision ID: 20260307_0008
Revises: 20260306_0007
Create Date: 2026-03-07 15:20:00
"""

from alembic import op
import sqlalchemy as sa


revision = "20260307_0008"
down_revision = "20260306_0007"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("zone_analysis_parcels", sa.Column("land_category_name", sa.String(length=100), nullable=True))
    op.add_column("zone_analysis_parcels", sa.Column("purpose_area_name", sa.String(length=100), nullable=True))


def downgrade() -> None:
    op.drop_column("zone_analysis_parcels", "purpose_area_name")
    op.drop_column("zone_analysis_parcels", "land_category_name")

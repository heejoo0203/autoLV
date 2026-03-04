"""add phone number column to users

Revision ID: 20260305_0005
Revises: 20260305_0004
Create Date: 2026-03-05 15:20:00.000000
"""

from __future__ import annotations

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "20260305_0005"
down_revision: Union[str, None] = "20260305_0004"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if "users" not in inspector.get_table_names():
        return

    columns = {col["name"] for col in inspector.get_columns("users")}
    if "phone_number" not in columns:
        op.add_column("users", sa.Column("phone_number", sa.String(length=20), nullable=True))

    refreshed = sa.inspect(bind)
    indexes = {idx["name"] for idx in refreshed.get_indexes("users")}
    if "ix_users_phone_number" not in indexes:
        op.create_index("ix_users_phone_number", "users", ["phone_number"], unique=False)


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if "users" not in inspector.get_table_names():
        return

    indexes = {idx["name"] for idx in inspector.get_indexes("users")}
    if "ix_users_phone_number" in indexes:
        op.drop_index("ix_users_phone_number", table_name="users")

    columns = {col["name"] for col in inspector.get_columns("users")}
    if "phone_number" in columns:
        op.drop_column("users", "phone_number")

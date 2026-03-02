"""add query logs table

Revision ID: 20260302_0002
Revises: 20260302_0001
Create Date: 2026-03-02 20:10:00.000000
"""

from __future__ import annotations

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "20260302_0002"
down_revision: Union[str, None] = "20260302_0001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    tables = set(inspector.get_table_names())

    if "query_logs" not in tables:
        op.create_table(
            "query_logs",
            sa.Column("id", sa.String(length=36), nullable=False),
            sa.Column("user_id", sa.String(length=36), nullable=False),
            sa.Column("search_type", sa.String(length=10), nullable=False),
            sa.Column("pnu", sa.String(length=19), nullable=False),
            sa.Column("address_summary", sa.String(length=300), nullable=False, server_default=""),
            sa.Column("rows_json", sa.Text(), nullable=False, server_default="[]"),
            sa.Column("result_count", sa.Integer(), nullable=False, server_default="0"),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
            sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
            sa.PrimaryKeyConstraint("id"),
        )

    indexes = {idx["name"] for idx in inspector.get_indexes("query_logs")} if "query_logs" in inspector.get_table_names() else set()
    if "ix_query_logs_user_id" not in indexes:
        op.create_index("ix_query_logs_user_id", "query_logs", ["user_id"], unique=False)
    if "ix_query_logs_pnu" not in indexes:
        op.create_index("ix_query_logs_pnu", "query_logs", ["pnu"], unique=False)
    if "ix_query_logs_created_at" not in indexes:
        op.create_index("ix_query_logs_created_at", "query_logs", ["created_at"], unique=False)


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    tables = set(inspector.get_table_names())
    if "query_logs" not in tables:
        return

    indexes = {idx["name"] for idx in inspector.get_indexes("query_logs")}
    if "ix_query_logs_created_at" in indexes:
        op.drop_index("ix_query_logs_created_at", table_name="query_logs")
    if "ix_query_logs_pnu" in indexes:
        op.drop_index("ix_query_logs_pnu", table_name="query_logs")
    if "ix_query_logs_user_id" in indexes:
        op.drop_index("ix_query_logs_user_id", table_name="query_logs")
    op.drop_table("query_logs")

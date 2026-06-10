"""baseline existing prisma schema

Revision ID: 65d0b607c636
Revises:
Create Date: 2026-06-10 13:03:20.492051
"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


revision: str = "65d0b607c636"
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Baseline only. The 11 tables already exist in Supabase (created by Prisma),
    # so this revision is intentionally empty and is applied with
    # `alembic stamp 65d0b607c636` (no DDL). Future schema changes branch from
    # here via `alembic revision --autogenerate`.
    pass


def downgrade() -> None:
    pass

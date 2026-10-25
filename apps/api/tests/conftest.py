"""Hermetic test env — dummy settings, and an in-memory SQLite database with the
D1 schema (d1/migrations) for the `db`/`client` fixtures. Environment variables
take precedence over the .env file in pydantic-settings, so these override any
local .env during tests.
"""

import os
from collections.abc import Iterator
from pathlib import Path

import pytest

os.environ["DATABASE_URL"] = "sqlite://"
os.environ.setdefault("AUTH_MODE", "access")
os.environ.setdefault("ACCESS_TEAM_DOMAIN", "example.cloudflareaccess.com")
os.environ.setdefault("ACCESS_AUD", "test-aud")


_MIGRATIONS = Path(__file__).parent.parent / "d1" / "migrations"


@pytest.fixture
def db() -> Iterator[None]:
    """Fresh in-memory database with the D1 schema applied."""
    from sqlalchemy import text

    from app import db as app_db

    app_db._engine = None  # new in-memory database per test
    engine = app_db.get_engine()
    raw = engine.raw_connection()
    try:
        for migration in sorted(_MIGRATIONS.glob("*.sql")):
            raw.driver_connection.executescript(migration.read_text())  # type: ignore[union-attr]
    finally:
        raw.close()
    with engine.connect() as conn:
        conn.execute(text("SELECT 1"))
    yield
    engine.dispose()
    app_db._engine = None

"""Async SQLAlchemy engine + session, wired to the Supabase Postgres pooler.

The Prisma-style DATABASE_URL (`postgresql://...?pgbouncer=true&...`) is
normalised for asyncpg: the driver is switched to `postgresql+asyncpg`, and
pooler-only query params are stripped. Because the app connects through the
Supabase *transaction* pooler (pgbouncer), asyncpg's prepared-statement cache is
disabled (`statement_cache_size=0`) — otherwise queries fail intermittently.
"""

import logging
import time
from collections.abc import AsyncGenerator
from urllib.parse import urlencode, urlsplit, urlunsplit

from sqlalchemy import event
from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

from app.config import get_settings

# Query params that belong to Prisma/pgbouncer, not asyncpg.
_DROP_PARAMS = {"pgbouncer", "connection_limit", "schema", "sslmode", "connect_timeout"}


def _normalise_async_url(url: str) -> str:
    parts = urlsplit(url)
    scheme = "postgresql+asyncpg"
    kept = [
        (k, v)
        for k, v in (
            tuple(p.split("=", 1)) if "=" in p else (p, "") for p in parts.query.split("&") if p
        )
        if k not in _DROP_PARAMS
    ]
    return urlunsplit((scheme, parts.netloc, parts.path, urlencode(kept), parts.fragment))


_settings = get_settings()

engine = create_async_engine(
    _normalise_async_url(_settings.database_url),
    # pool_pre_ping is intentionally OFF. Through the Supabase transaction pooler
    # (pgbouncer) the liveness ping cost ~195ms on EVERY checkout (measured) — a
    # validation round-trip on an already-healthy, reused connection. Dropping it
    # removes that per-request cost. `pool_recycle` bounds connection age so a
    # long-idle connection the pooler may have closed is replaced rather than
    # reused; on the rare stale connection SQLAlchemy raises and recovers.
    pool_pre_ping=False,
    pool_recycle=1800,
    # Transaction pooler (pgbouncer) is incompatible with prepared statements.
    connect_args={"statement_cache_size": 0},
)

SessionLocal = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)

# --- TEMPORARY: pool reuse probe (slowness fix #1) -------------------------
# If `connect` fires about as often as `checkout`, connections are NOT being
# reused — every request pays a fresh pgbouncer/TLS handshake. Remove after.
_pool_log = logging.getLogger("uvicorn.error")
_pool_stats = {"connect": 0, "checkout": 0}


@event.listens_for(engine.sync_engine, "connect")
def _on_pool_connect(_dbapi_conn: object, _rec: object) -> None:
    _pool_stats["connect"] += 1
    _pool_log.info(
        "DB pool: NEW physical connection #%d (checkouts so far=%d) t=%.3f",
        _pool_stats["connect"],
        _pool_stats["checkout"],
        time.time(),
    )


@event.listens_for(engine.sync_engine, "checkout")
def _on_pool_checkout(_dbapi_conn: object, _rec: object, _proxy: object) -> None:
    _pool_stats["checkout"] += 1
# --------------------------------------------------------------------------


async def get_session() -> AsyncGenerator[AsyncSession]:
    """FastAPI dependency yielding a request-scoped async session."""
    async with SessionLocal() as session:
        yield session

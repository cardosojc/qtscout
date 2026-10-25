"""Weekly database backup: a SQL dump of every table, written to R2.

Run by the Worker's cron trigger (`scheduled` in entry.py). The dump holds
INSERTs only, in foreign-key order, plus the FTS5 search rows; the schema comes
from d1/migrations. To restore into an empty database:

    npx wrangler d1 migrations apply <db> --remote
    npx wrangler r2 object get qtscout-backups/<key> --remote --file backup.sql
    npx wrangler d1 execute <db> --remote --file backup.sql

Exports live under `d1/` in the `qtscout-backups` bucket; an R2 lifecycle rule
deletes them after 180 days.
"""

from datetime import UTC, datetime
from typing import Any

from app.models import Base

BACKUP_PREFIX = "d1/"
# Not a model (no SQLAlchemy table): the FTS5 index in core/meeting_search.py.
_EXTRA_TABLES = ["meeting_search"]


def _literal(value: Any) -> str:
    if value is None:
        return "NULL"
    if isinstance(value, bool):
        return "1" if value else "0"
    if isinstance(value, int | float):
        return repr(value)
    if isinstance(value, bytes | bytearray):
        return "X'" + bytes(value).hex() + "'"
    return "'" + str(value).replace("'", "''") + "'"


def dump_sql(connection: Any) -> str:
    """INSERT statements for every table, via a DB-API connection (D1 or sqlite3)."""
    tables = [t.name for t in Base.metadata.sorted_tables] + _EXTRA_TABLES
    lines = [
        f"-- QTScout D1 backup, {datetime.now(UTC).isoformat(timespec='seconds')}",
        "-- Data only: apply d1/migrations to an empty database first.",
    ]
    for table in tables:
        cursor = connection.cursor()
        cursor.execute(f'SELECT * FROM "{table}"')  # noqa: S608 (fixed table names)
        columns = ", ".join(f'"{d[0]}"' for d in cursor.description or [])
        rows = cursor.fetchall()
        lines.append(f"-- {table}: {len(rows)} rows")
        for row in rows:
            values = ", ".join(_literal(v) for v in row)
            lines.append(f'INSERT INTO "{table}" ({columns}) VALUES ({values});')
    return "\n".join(lines) + "\n"


def backup_key(now: datetime | None = None) -> str:
    stamp = (now or datetime.now(UTC)).strftime("%Y%m%dT%H%M%SZ")
    return f"{BACKUP_PREFIX}qtscout-{stamp}.sql"


async def run_backup(env: Any) -> str:
    """Dump the D1 database to the BACKUPS bucket; returns the object key."""
    from app.db import _D1Connection
    from app.runtime import to_js_obj

    sql = dump_sql(_D1Connection(env.DB))
    key = backup_key()
    await env.BACKUPS.put(key, sql, to_js_obj({"httpMetadata": {"contentType": "application/sql"}}))
    return key

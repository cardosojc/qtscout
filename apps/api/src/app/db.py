"""Sync SQLAlchemy engine + session on SQLite: Cloudflare D1 in the Worker, a
local SQLite file elsewhere.

D1 has no Python driver, so in the Worker a minimal DB-API shim (`_D1Connection`)
runs each statement through the D1 binding and blocks on it with Pyodide's
`run_sync` (JSPI). That keeps the ORM synchronous: handlers stay `async def` and
call the session without `await`. D1 has no interactive transactions: every
statement autocommits, so `commit()`/`rollback()` are no-ops there. Code that
needs several writes to land atomically uses `atomic_batch()` (one D1 batch).

Locally (`DATABASE_URL=sqlite:///…`, default `./local.db`) the stdlib sqlite3
driver is used with the same schema (`schema/*.sql`, applied by `wrangler d1
migrations apply` / `scripts/local_db.py`).
"""

from collections.abc import Generator, Sequence
from datetime import datetime
from typing import Any

from sqlalchemy import Engine, create_engine, event
from sqlalchemy.engine import Connection
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.runtime import IN_WORKER, binding


class _D1Cursor:
    """Minimal DB-API 2.0 cursor over the D1 binding."""

    arraysize = 1

    def __init__(self, db: Any) -> None:
        self._db = db
        self._rows: list[tuple[Any, ...]] = []
        self.description: list[tuple[Any, ...]] | None = None
        self.rowcount = -1
        self.lastrowid = None

    def execute(self, sql: str, params: Sequence[Any] = ()) -> "_D1Cursor":
        from pyodide.ffi import run_sync

        from app.runtime import to_js_obj

        if sql.strip().upper() == "PRAGMA READ_UNCOMMITTED":
            # D1 denies this PRAGMA; SQLAlchemy only probes it for the isolation level.
            self.description = [("read_uncommitted",) + (None,) * 6]
            self._rows, self.rowcount = [(0,)], 1
            return self
        stmt = self._db.prepare(sql)
        if params:
            stmt = stmt.bind(*[_to_d1(p) for p in params])
        if _returns_rows(sql):
            # raw() keeps columns positional (joins repeat names like "id").
            res = run_sync(stmt.raw(to_js_obj({"columnNames": True})))
            res = res.to_py() if hasattr(res, "to_py") else list(res)
            cols, rows = (res[0], res[1:]) if res else ([], [])
            self.description = [(c, None, None, None, None, None, None) for c in cols] or None
            self._rows = [tuple(r) for r in rows]
            self.rowcount = len(self._rows)
        else:
            # The ORM checks UPDATE/DELETE row counts, so report D1's `changes`.
            meta = run_sync(stmt.run()).meta
            self.description, self._rows = None, []
            self.rowcount = int(meta.changes)
            self.lastrowid = meta.last_row_id
        return self

    def executemany(self, sql: str, seq: Sequence[Sequence[Any]]) -> None:
        for p in seq:
            self.execute(sql, p)

    def fetchone(self) -> tuple[Any, ...] | None:
        return self._rows.pop(0) if self._rows else None

    def fetchmany(self, size: int | None = None) -> list[tuple[Any, ...]]:
        n = size or self.arraysize
        out, self._rows = self._rows[:n], self._rows[n:]
        return out

    def fetchall(self) -> list[tuple[Any, ...]]:
        out, self._rows = self._rows, []
        return out

    def close(self) -> None:
        pass


def _returns_rows(sql: str) -> bool:
    head = sql.lstrip().split(None, 1)[0].upper() if sql.strip() else ""
    return head in ("SELECT", "WITH", "PRAGMA", "VALUES") or " RETURNING " in sql.upper()


def _to_d1(value: Any) -> Any:
    # D1 binds JS values: None -> null, bool -> 0/1 (SQLite has no booleans),
    # datetimes as SQLAlchemy's SQLite text format (what the ORM stores).
    if isinstance(value, bool):
        return int(value)
    if isinstance(value, datetime):
        return value.strftime("%Y-%m-%d %H:%M:%S.%f")
    return value


class _D1Connection:
    def __init__(self, db: Any) -> None:
        self._db = db

    def cursor(self) -> _D1Cursor:
        return _D1Cursor(self._db)

    def commit(self) -> None:
        pass

    def rollback(self) -> None:
        pass

    def close(self) -> None:
        pass

    def create_function(self, *args: Any, **kwargs: Any) -> None:
        pass


def _d1_connection() -> _D1Connection:
    db = binding("DB")
    if db is None:
        raise RuntimeError("D1 binding DB is not available outside a request")
    return _D1Connection(db)


def _make_engine() -> Engine:
    if IN_WORKER:
        # The binding is per request, so the "connection" is created on checkout
        # and never pooled across requests.
        from sqlalchemy.pool import NullPool

        return create_engine("sqlite://", creator=_d1_connection, poolclass=NullPool)

    from app.config import get_settings

    url = get_settings().database_url
    kwargs: dict[str, Any] = {"connect_args": {"check_same_thread": False}}
    if url in ("sqlite://", "sqlite:///:memory:"):
        kwargs["poolclass"] = StaticPool
    eng = create_engine(url, **kwargs)

    @event.listens_for(eng, "connect")
    def _fk_on(dbapi_conn: Any, _rec: Any) -> None:
        # D1 enforces foreign keys; make local SQLite match.
        dbapi_conn.execute("PRAGMA foreign_keys = ON")

    return eng


_engine: Engine | None = None


def get_engine() -> Engine:
    global _engine
    if _engine is None:
        _engine = _make_engine()
    return _engine


SessionLocal = sessionmaker(expire_on_commit=False, class_=Session)


def get_session() -> Generator[Session]:
    """FastAPI dependency yielding a request-scoped session."""
    with SessionLocal(bind=get_engine()) as session:
        yield session


def atomic_batch(session: Session, statements: Sequence[tuple[str, Sequence[Any]]]) -> None:
    """Run raw SQL statements atomically: one D1 batch, or one local transaction.

    Use for multi-write operations that must all land or none (D1 has no
    interactive transactions, but a batch is a single implicit transaction).
    """
    if IN_WORKER:
        from pyodide.ffi import run_sync

        db = binding("DB")
        prepared = [
            db.prepare(sql).bind(*[_to_d1(p) for p in params]) for sql, params in statements
        ]
        run_sync(db.batch(prepared))
        return
    session.commit()  # land anything pending before the raw transaction
    conn: Connection = session.connection()
    raw = conn.connection.driver_connection
    assert raw is not None
    with raw:  # sqlite3: commits on success, rolls back on error
        for sql, params in statements:
            raw.execute(sql, tuple(_to_d1(p) for p in params))

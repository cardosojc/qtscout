"""Temporary per-request timing instrumentation (slowness diagnosis).

A ContextVar holds a dict of sub-timings for the current request so inner code
(auth verification, the Profile lookup) can record how long its hop took without
threading a timer through every call. The request-timing middleware in
``app.main`` reads this to emit a ``Server-Timing`` header.

This whole module is diagnostic scaffolding — remove it once the latency budget
is established (see the diagnosis plan).
"""

from __future__ import annotations

import time
from collections.abc import Iterator
from contextlib import contextmanager
from contextvars import ContextVar

# Maps a hop name (e.g. "auth", "profiledb") -> elapsed milliseconds.
_timings: ContextVar[dict[str, float] | None] = ContextVar("_timings", default=None)


def reset_timings() -> dict[str, float]:
    """Start a fresh per-request timing bucket and return it."""
    bucket: dict[str, float] = {}
    _timings.set(bucket)
    return bucket


def record(name: str, ms: float) -> None:
    """Accumulate ``ms`` under ``name`` for the current request, if tracking."""
    bucket = _timings.get()
    if bucket is not None:
        bucket[name] = bucket.get(name, 0.0) + ms


@contextmanager
def track(name: str) -> Iterator[None]:
    """Time the wrapped block and record it under ``name``."""
    start = time.perf_counter()
    try:
        yield
    finally:
        record(name, (time.perf_counter() - start) * 1000.0)

"""Shared column helpers."""

from collections.abc import Callable
from datetime import UTC, datetime
from enum import Enum

from sqlalchemy import Enum as SAEnum


def str_enum(py_enum: type[Enum], name: str) -> SAEnum:
    """Store an enum as its plain string value (SQLite/D1 has no enum types)."""
    values: Callable[[type[Enum]], list[str]] = lambda e: [m.value for m in e]  # noqa: E731
    return SAEnum(
        py_enum, name=name, native_enum=False, create_constraint=False, values_callable=values
    )


def utcnow() -> datetime:
    """Naive UTC now — every timestamp column is naive UTC.

    Set app-side (not only via the DB default) so all stored timestamps share
    SQLAlchemy's text format and compare correctly as strings in SQLite.
    """
    return datetime.now(UTC).replace(tzinfo=None)

"""Shared column helpers."""

from collections.abc import Callable
from enum import Enum

from sqlalchemy import Enum as SAEnum


def pg_enum(py_enum: type[Enum], name: str) -> SAEnum:
    """Bind to an existing Postgres enum type (created by Prisma); emit no DDL."""
    values: Callable[[type[Enum]], list[str]] = lambda e: [m.value for m in e]  # noqa: E731
    return SAEnum(py_enum, name=name, create_type=False, values_callable=values)

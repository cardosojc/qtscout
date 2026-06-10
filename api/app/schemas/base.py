"""Shared response-schema plumbing for parity with the Hono/Prisma API.

- `ORMModel` reads from SQLAlchemy objects and emits **camelCase** JSON keys
  (Prisma returned its field names verbatim, which are camelCase).
- `PrismaDateTime` serialises datetimes exactly like Prisma/`Date.toISOString()`:
  UTC, millisecond precision, trailing `Z` (e.g. `2026-01-01T00:00:00.000Z`).
  Stored timestamps are naive and assumed UTC. Matching this matters: the web
  parses these with `new Date(...)`, which treats a bare (Z-less) string as local.
"""

from datetime import UTC, datetime
from typing import Annotated

from pydantic import BaseModel, ConfigDict, PlainSerializer
from pydantic.alias_generators import to_camel


def _serialize_dt(value: datetime) -> str:
    dt = value.replace(tzinfo=UTC) if value.tzinfo is None else value.astimezone(UTC)
    return dt.isoformat(timespec="milliseconds").replace("+00:00", "Z")


PrismaDateTime = Annotated[datetime, PlainSerializer(_serialize_dt, return_type=str)]


class ORMModel(BaseModel):
    model_config = ConfigDict(
        from_attributes=True,
        populate_by_name=True,
        alias_generator=to_camel,
    )

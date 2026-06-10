from datetime import UTC, datetime

from pydantic import BaseModel

from app.schemas.base import PrismaDateTime


class _M(BaseModel):
    at: PrismaDateTime


def test_naive_datetime_serialized_as_utc_z() -> None:
    # Stored timestamps are naive (assumed UTC) -> must match Prisma's toISOString.
    out = _M(at=datetime(2026, 1, 2, 3, 4, 5)).model_dump(mode="json")
    assert out["at"] == "2026-01-02T03:04:05.000Z"


def test_aware_datetime_converted_to_utc_z() -> None:
    out = _M(at=datetime(2026, 1, 2, 3, 4, 5, tzinfo=UTC)).model_dump(mode="json")
    assert out["at"] == "2026-01-02T03:04:05.000Z"

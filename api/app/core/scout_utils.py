"""Nights-badge milestone counts. Mirrors `@qtscout/types/scout`."""

from typing import Any

NIGHTS_BADGE_COUNTS: tuple[int, ...] = (25, 50, 75, 100, 200)


def is_nights_badge_count(value: Any) -> bool:
    return (
        isinstance(value, (int, float))
        and not isinstance(value, bool)
        and value in NIGHTS_BADGE_COUNTS
    )

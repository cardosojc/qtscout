"""Full-text index for meetings (SQLite FTS5 table `meeting_search`).

Replaces the Postgres `contentTsvector` column + trigger. FTS5 can't strip HTML
inside a trigger, so the app keeps the index current: `reindex_meeting` after a
meeting is created or changed, `unindex_meeting` when it is deleted. The
tokenizer (`unicode61 remove_diacritics 2`) makes matching accent-insensitive
("reuniao" finds "Reunião"); there is no Portuguese stemming, so queries use
prefix terms instead ("reun*").

Columns, most to least important (weights in `RANK_WEIGHTS`): `body` (minutes
text), `identifier`, `location`, `extra` (agenda + action items text).
"""

import html
import re
from typing import Any

from sqlalchemy import text
from sqlalchemy.orm import Session

from app.models import Meeting

# bm25() weights per column, in table order: meeting_id, identifier, location, body, extra.
RANK_WEIGHTS = "0.0, 4.0, 2.0, 8.0, 1.0"
# Index of `body` in the table (for snippet()).
BODY_COLUMN = 3

_TAG = re.compile(r"<[^>]+>")
_SPACE = re.compile(r"\s+")


def html_to_text(value: str | None) -> str:
    if not value:
        return ""
    return _SPACE.sub(" ", html.unescape(_TAG.sub(" ", value))).strip()


def _strings(value: Any) -> list[str]:
    """Every string inside a JSON value (agenda/action items), HTML stripped."""
    if isinstance(value, str):
        return [html_to_text(value)]
    if isinstance(value, dict):
        return [s for v in value.values() for s in _strings(v)]
    if isinstance(value, list):
        return [s for v in value for s in _strings(v)]
    return []


def unindex_meeting(session: Session, meeting_id: str) -> None:
    session.execute(text("DELETE FROM meeting_search WHERE meeting_id = :id"), {"id": meeting_id})


def reindex_meeting(session: Session, meeting: Meeting) -> None:
    unindex_meeting(session, meeting.id)
    session.execute(
        text(
            "INSERT INTO meeting_search (meeting_id, identifier, location, body, extra) "
            "VALUES (:id, :identifier, :location, :body, :extra)"
        ),
        {
            "id": meeting.id,
            "identifier": meeting.identifier,
            "location": meeting.location or "",
            "body": html_to_text(meeting.content),
            "extra": " ".join(s for s in _strings([meeting.agenda, meeting.action_items]) if s),
        },
    )
    session.commit()


def fts_query(q: str) -> str:
    """User input -> an FTS5 query: every word must match, each as a prefix."""
    terms = [re.sub(r'["*^:()\\]', "", t) for t in q.split()]
    return " ".join(f'"{t}"*' for t in terms if t)

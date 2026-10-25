import json
from datetime import UTC, datetime
from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, text
from sqlalchemy.orm import Session, selectinload

from app.core.document_utils import db_timestamp, format_document_identifier
from app.core.meeting_search import BODY_COLUMN, RANK_WEIGHTS, fts_query
from app.db import get_session
from app.deps import CurrentUser
from app.models import Document, Meeting
from app.models.enums import DocumentType
from app.schemas.base import prisma_iso
from app.schemas.document import DocumentOut
from app.schemas.meeting import MeetingSearchListOut

router = APIRouter(prefix="/search", tags=["search"])


def _parse_dt(value: str) -> datetime:
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError as err:
        raise HTTPException(status_code=400, detail="Invalid date") from err
    return parsed.astimezone(UTC).replace(tzinfo=None) if parsed.tzinfo else parsed


def _maybe_json(value: Any) -> Any:
    # JSON columns come back from a raw query as text; parse to match the ORM.
    if isinstance(value, str):
        try:
            return json.loads(value)
        except ValueError:
            return value
    return value


def _dt(value: Any) -> str:
    # Raw-query timestamps are SQLite text; format like the ORM responses.
    return prisma_iso(value if isinstance(value, datetime) else datetime.fromisoformat(value))


# Raw SQL for the full-text branch (FTS5; see app/core/meeting_search.py).
# rank = -bm25 so that higher means more relevant, as with ts_rank_cd before.
_SEARCH_SQL = f"""
SELECT
  m.id, m.identifier, m.date, m."startTime", m."endTime", m.location,
  m.agenda, m.content, m.decisions, m."actionItems",
  m."createdAt", m."updatedAt", m."meetingTypeId", m."createdById",
  mt.id AS "mt_id", mt.code AS "mt_code", mt.name AS "mt_name",
  mt.description AS "mt_description", mt."createdAt" AS "mt_createdAt",
  mt."updatedAt" AS "mt_updatedAt",
  p.name AS "cb_name", p.email AS "cb_email",
  -bm25(meeting_search, {RANK_WEIGHTS}) AS rank,
  snippet(meeting_search, {BODY_COLUMN}, '<mark>', '</mark>', '…', 24) AS snippet
FROM meeting_search
JOIN meetings m ON m.id = meeting_search.meeting_id
JOIN meeting_types mt ON m."meetingTypeId" = mt.id
JOIN profiles p ON m."createdById" = p.id
WHERE {{where}}
{{order}}
LIMIT 50
"""


@router.get("/meetings")
async def search_meetings(
    user: CurrentUser,
    session: Annotated[Session, Depends(get_session)],
    q: str = "",
    type: Annotated[str | None, Query()] = None,
    from_: Annotated[str | None, Query(alias="from")] = None,
    to: Annotated[str | None, Query()] = None,
    sortBy: str = "relevance",  # noqa: N803
    sortOrder: str = "desc",  # noqa: N803
) -> list[Any]:
    order = "asc" if sortOrder == "asc" else "desc"

    match = fts_query(q)

    if match:
        where_parts = ["meeting_search MATCH :match"]
        params: dict[str, Any] = {"match": match}
        if type:
            where_parts.append('m."meetingTypeId" = :mtid')
            params["mtid"] = type
        if from_:
            where_parts.append("m.date >= :dfrom")
            params["dfrom"] = db_timestamp(_parse_dt(from_))
        if to:
            where_parts.append("m.date <= :dto")
            params["dto"] = db_timestamp(_parse_dt(to))

        if sortBy == "identifier":
            order_clause = f"ORDER BY m.identifier {order.upper()}"
        elif sortBy == "date":
            order_clause = f"ORDER BY m.date {order.upper()}"
        else:
            order_clause = "ORDER BY rank DESC"

        sql = text(_SEARCH_SQL.format(where=" AND ".join(where_parts), order=order_clause))
        rows = (session.execute(sql, params)).mappings().all()
        return [
            {
                "id": r["id"],
                "identifier": r["identifier"],
                "date": _dt(r["date"]),
                "startTime": r["startTime"],
                "endTime": r["endTime"],
                "location": r["location"],
                "agenda": _maybe_json(r["agenda"]),
                "content": r["content"],
                "decisions": _maybe_json(r["decisions"]),
                "actionItems": _maybe_json(r["actionItems"]),
                "createdAt": _dt(r["createdAt"]),
                "updatedAt": _dt(r["updatedAt"]),
                "meetingTypeId": r["meetingTypeId"],
                "createdById": r["createdById"],
                "meetingType": {
                    "id": r["mt_id"],
                    "code": r["mt_code"],
                    "name": r["mt_name"],
                    "description": r["mt_description"],
                    "createdAt": _dt(r["mt_createdAt"]),
                    "updatedAt": _dt(r["mt_updatedAt"]),
                },
                "createdBy": {"name": r["cb_name"], "email": r["cb_email"]},
                "rank": r["rank"],
                "snippet": r["snippet"],
            }
            for r in rows
        ]

    # Fallback (no query, or query reduced to nothing): plain list, no rank/snippet.
    conditions = []
    if type:
        conditions.append(Meeting.meeting_type_id == type)
    if from_:
        conditions.append(Meeting.date >= _parse_dt(from_))
    if to:
        conditions.append(Meeting.date <= _parse_dt(to))

    order_by: Any
    if sortBy == "identifier":
        order_by = Meeting.identifier.asc() if order == "asc" else Meeting.identifier.desc()
    else:
        order_by = Meeting.date.desc()

    rows_orm = (
        session.scalars(
            select(Meeting)
            .where(*conditions)
            .options(selectinload(Meeting.meeting_type), selectinload(Meeting.created_by))
            .order_by(order_by)
            .limit(50)
        )
    ).all()
    return [MeetingSearchListOut.model_validate(m) for m in rows_orm]


@router.get("/documents")
async def search_documents(
    user: CurrentUser,
    session: Annotated[Session, Depends(get_session)],
    q: str = "",
    type: Annotated[DocumentType | None, Query()] = None,
    from_: Annotated[str | None, Query(alias="from")] = None,
    to: Annotated[str | None, Query()] = None,
    sortBy: str = "date",  # noqa: N803
    sortOrder: str = "desc",  # noqa: N803
) -> list[DocumentOut]:
    order = "asc" if sortOrder == "asc" else "desc"
    conditions = []
    if type is not None:
        conditions.append(Document.type == type)
    if q:
        conditions.append(Document.content.ilike(f"%{q}%"))
    if from_:
        conditions.append(Document.created_at >= _parse_dt(from_))
    if to:
        conditions.append(Document.created_at <= _parse_dt(to))

    order_by: list[Any]
    if sortBy == "identifier":
        order_by = (
            [Document.type.asc(), Document.number.asc()]
            if order == "asc"
            else [Document.type.desc(), Document.number.desc()]
        )
    else:
        order_by = [Document.created_at.asc() if order == "asc" else Document.created_at.desc()]

    rows = (
        session.scalars(
            select(Document)
            .where(*conditions)
            .options(selectinload(Document.created_by))
            .order_by(*order_by)
            .limit(50)
        )
    ).all()
    result = []
    for doc in rows:
        out = DocumentOut.model_validate(doc)
        out.identifier = format_document_identifier(doc.type, doc.number, doc.year)
        result.append(out)
    return result

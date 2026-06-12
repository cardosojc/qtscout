from datetime import UTC, datetime
from typing import Annotated, Any

from fastapi import APIRouter, Body, Depends, HTTPException, Query
from fastapi.responses import Response
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.db import get_session
from app.deps import CurrentUser
from app.models import Meeting, MeetingAttendee, MeetingType
from app.pdf.render import generate_meeting_pdf
from app.schemas.document import Pagination
from app.schemas.meeting import MeetingBareOut, MeetingListResponse, MeetingOut

router = APIRouter(prefix="/meetings", tags=["meetings"])

_DUPLICATE = "Já existe uma reunião deste tipo para esta data."


def _includes() -> tuple[Any, ...]:
    return (
        selectinload(Meeting.meeting_type),
        selectinload(Meeting.created_by),
        selectinload(Meeting.attendees).selectinload(MeetingAttendee.profile),
    )


def _parse_dt(value: Any) -> datetime:
    if not isinstance(value, str) or not value:
        raise HTTPException(status_code=400, detail="Invalid date")
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date") from None
    return parsed.astimezone(UTC).replace(tzinfo=None) if parsed.tzinfo else parsed


def _identifier(code: str, dt: datetime) -> str:
    return f"{code}-{dt.year}{dt.month:02d}{dt.day:02d}"


@router.get("")
async def list_meetings(
    user: CurrentUser,
    session: Annotated[AsyncSession, Depends(get_session)],
    page: int = 1,
    limit: int = 10,
    from_: Annotated[str | None, Query(alias="from")] = None,
    to: Annotated[str | None, Query()] = None,
) -> MeetingListResponse:
    conditions = []
    if from_:
        conditions.append(Meeting.date >= _parse_dt(from_))
    if to:
        conditions.append(Meeting.date <= _parse_dt(to))

    total = await session.scalar(select(func.count()).select_from(Meeting).where(*conditions)) or 0
    rows = (
        await session.scalars(
            select(Meeting)
            .where(*conditions)
            .options(*_includes())
            .order_by(Meeting.date.desc())
            .offset((page - 1) * limit)
            .limit(limit)
        )
    ).all()
    return MeetingListResponse(
        meetings=[MeetingOut.model_validate(m) for m in rows],
        pagination=Pagination(
            page=page, limit=limit, total=total, totalPages=-(-total // limit) if limit else 0
        ),
    )


@router.post("")
async def create_meeting(
    user: CurrentUser,
    session: Annotated[AsyncSession, Depends(get_session)],
    body: Annotated[dict[str, Any], Body()],
) -> MeetingBareOut:
    meeting_type_id = body.get("meetingTypeId")
    meeting_type = await session.scalar(
        select(MeetingType).where(MeetingType.id == meeting_type_id)
    )
    if meeting_type is None:
        raise HTTPException(status_code=400, detail="Invalid meeting type")

    date = _parse_dt(body.get("date"))
    meeting = Meeting(
        identifier=_identifier(meeting_type.code, date),
        date=date,
        start_time=body.get("startTime"),
        end_time=body.get("endTime"),
        location=body.get("location"),
        agenda=body.get("agenda"),
        content=body.get("content") or "",
        decisions=None,
        action_items=body.get("actionItems"),
        meeting_type_id=meeting_type_id,
        created_by_id=user.id,
    )
    session.add(meeting)
    try:
        await session.commit()
    except IntegrityError:
        await session.rollback()
        raise HTTPException(status_code=409, detail=_DUPLICATE) from None
    await session.refresh(meeting)

    # Capture the response before the agenda restructure (parity: Hono returns
    # the pre-restructure meeting object).
    response = MeetingBareOut.model_validate(meeting)

    attendees = body.get("attendees")
    chefe = body.get("chefeAgrupamento")
    secretario = body.get("secretario")
    if (attendees and len(attendees) > 0) or chefe or secretario:
        current = meeting.agenda
        items = current if isinstance(current, list) else []
        meeting.agenda = {
            "items": items,
            "attendeeNames": attendees or [],
            "chefeAgrupamento": chefe or "",
            "secretario": secretario or "",
        }
        await session.commit()

    return response


@router.get("/{meeting_id}")
async def get_meeting(
    meeting_id: str, user: CurrentUser, session: Annotated[AsyncSession, Depends(get_session)]
) -> MeetingOut:
    meeting = await session.scalar(
        select(Meeting).where(Meeting.id == meeting_id).options(*_includes())
    )
    if meeting is None:
        raise HTTPException(status_code=404, detail="Meeting not found")
    return MeetingOut.model_validate(meeting)


@router.put("/{meeting_id}")
async def update_meeting(
    meeting_id: str,
    user: CurrentUser,
    session: Annotated[AsyncSession, Depends(get_session)],
    body: Annotated[dict[str, Any], Body()],
) -> MeetingOut:
    meeting = await session.scalar(select(Meeting).where(Meeting.id == meeting_id))
    if meeting is None:
        raise HTTPException(status_code=404, detail="Meeting not found")

    if body.get("meetingTypeId"):
        meeting.meeting_type_id = body["meetingTypeId"]
    if body.get("date"):
        meeting.date = _parse_dt(body["date"])
    for key, attr in (
        ("startTime", "start_time"),
        ("endTime", "end_time"),
        ("location", "location"),
        ("agenda", "agenda"),
        ("content", "content"),
        ("actionItems", "action_items"),
    ):
        if key in body:
            setattr(meeting, attr, body[key])

    if body.get("meetingTypeId") or body.get("date"):
        final_type_id = body.get("meetingTypeId") or meeting.meeting_type_id
        final_date = _parse_dt(body["date"]) if body.get("date") else meeting.date
        mt = await session.scalar(select(MeetingType).where(MeetingType.id == final_type_id))
        if mt is not None:
            meeting.identifier = _identifier(mt.code, final_date)

    try:
        await session.commit()
    except IntegrityError:
        await session.rollback()
        raise HTTPException(status_code=409, detail=_DUPLICATE) from None

    updated = await session.scalar(
        select(Meeting).where(Meeting.id == meeting_id).options(*_includes())
    )
    assert updated is not None
    response = MeetingOut.model_validate(updated)

    if any(k in body for k in ("attendees", "chefeAgrupamento", "secretario", "agenda")):
        current = updated.agenda
        items: Any = []
        att: Any = []
        chefe = ""
        secretario = ""
        if isinstance(current, list):
            items = current
        elif isinstance(current, dict):
            items = current.get("items") or []
            att = current.get("attendeeNames") or []
            chefe = current.get("chefeAgrupamento") or ""
            secretario = current.get("secretario") or ""
        updated.agenda = {
            "items": body["agenda"] if "agenda" in body else items,
            "attendeeNames": body["attendees"] if "attendees" in body else att,
            "chefeAgrupamento": body["chefeAgrupamento"] if "chefeAgrupamento" in body else chefe,
            "secretario": body["secretario"] if "secretario" in body else secretario,
        }
        await session.commit()

    return response


@router.delete("/{meeting_id}")
async def delete_meeting(
    meeting_id: str, user: CurrentUser, session: Annotated[AsyncSession, Depends(get_session)]
) -> dict[str, str]:
    meeting = await session.scalar(select(Meeting).where(Meeting.id == meeting_id))
    if meeting is None:
        raise HTTPException(status_code=404, detail="Meeting not found")
    await session.delete(meeting)
    await session.commit()
    return {"message": "Meeting deleted successfully"}


@router.get("/{meeting_id}/pdf")
async def meeting_pdf(
    meeting_id: str,
    user: CurrentUser,
    session: Annotated[AsyncSession, Depends(get_session)],
    download: Annotated[str | None, Query()] = None,
) -> Response:
    meeting = await session.scalar(
        select(Meeting)
        .where(Meeting.id == meeting_id)
        .options(selectinload(Meeting.meeting_type), selectinload(Meeting.created_by))
    )
    if meeting is None:
        raise HTTPException(status_code=404, detail="Meeting not found")

    pdf = await generate_meeting_pdf(
        {
            "identifier": meeting.identifier,
            "date": meeting.date,
            "startTime": meeting.start_time,
            "endTime": meeting.end_time,
            "location": meeting.location,
            "agenda": meeting.agenda or {},
            "meetingType": {
                "name": meeting.meeting_type.name,
                "code": meeting.meeting_type.code,
            },
            "createdBy": {
                "name": meeting.created_by.name,
                "email": meeting.created_by.email,
            },
        }
    )
    disposition = "attachment" if download == "true" else "inline"
    return Response(
        content=pdf,
        media_type="application/pdf",
        headers={"Content-Disposition": f'{disposition}; filename="{meeting.identifier}.pdf"'},
    )

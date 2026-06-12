from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_session
from app.models import MeetingType
from app.schemas.meeting_type import MeetingTypeOut

router = APIRouter(prefix="/meeting-types", tags=["meeting-types"])


# Public (the Hono route performs no session check).
@router.get("", response_model=list[MeetingTypeOut])
async def list_meeting_types(
    session: Annotated[AsyncSession, Depends(get_session)],
) -> list[MeetingType]:
    result = await session.scalars(select(MeetingType).order_by(MeetingType.name.asc()))
    return list(result.all())

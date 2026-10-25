from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.text_sort import name_key
from app.db import get_session
from app.models import MeetingType
from app.schemas.meeting_type import MeetingTypeOut

router = APIRouter(prefix="/meeting-types", tags=["meeting-types"])


# Public (the Hono route performs no session check).
@router.get("", response_model=list[MeetingTypeOut])
async def list_meeting_types(
    session: Annotated[Session, Depends(get_session)],
) -> list[MeetingType]:
    result = session.scalars(select(MeetingType))
    return sorted(result.all(), key=lambda t: name_key(t.name))

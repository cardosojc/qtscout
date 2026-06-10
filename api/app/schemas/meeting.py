from typing import Any

from app.schemas.base import ORMModel, PrismaDateTime
from app.schemas.document import CreatedByOut
from app.schemas.meeting_type import MeetingTypeOut


class AttendeeProfileOut(ORMModel):
    name: str | None
    email: str


class MeetingAttendeeOut(ORMModel):
    id: str
    present: bool
    role: str | None
    created_at: PrismaDateTime
    meeting_id: str
    profile_id: str
    profile: AttendeeProfileOut


class MeetingBareOut(ORMModel):
    """Bare meeting row (no relations) — the POST create response shape."""

    id: str
    identifier: str
    date: PrismaDateTime
    start_time: str | None
    end_time: str | None
    location: str | None
    agenda: Any
    content: str
    decisions: Any | None
    action_items: Any | None
    created_at: PrismaDateTime
    updated_at: PrismaDateTime
    meeting_type_id: str
    created_by_id: str


class MeetingOut(MeetingBareOut):
    meeting_type: MeetingTypeOut
    created_by: CreatedByOut
    attendees: list[MeetingAttendeeOut]


class MeetingSearchListOut(MeetingBareOut):
    """Search fallback shape: meeting + meetingType + createdBy, no attendees."""

    meeting_type: MeetingTypeOut
    created_by: CreatedByOut

from datetime import datetime
from typing import TYPE_CHECKING, Any

from sqlalchemy import JSON, Boolean, DateTime, ForeignKey, String, UniqueConstraint, func, text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models import Base
from app.models._columns import utcnow
from app.models.ids import cuid_id

if TYPE_CHECKING:
    from app.models.profile import Profile


class MeetingType(Base):
    __tablename__ = "meeting_types"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=cuid_id)
    code: Mapped[str] = mapped_column(String, unique=True)
    name: Mapped[str] = mapped_column(String)
    description: Mapped[str | None] = mapped_column(String, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        "createdAt", server_default=func.now(), default=utcnow
    )
    updated_at: Mapped[datetime] = mapped_column(
        "updatedAt", server_default=func.now(), default=utcnow, onupdate=utcnow
    )


class Meeting(Base):
    __tablename__ = "meetings"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=cuid_id)
    identifier: Mapped[str] = mapped_column(String, unique=True)
    date: Mapped[datetime] = mapped_column(DateTime)
    start_time: Mapped[str | None] = mapped_column("startTime", String, nullable=True)
    end_time: Mapped[str | None] = mapped_column("endTime", String, nullable=True)
    location: Mapped[str | None] = mapped_column(String, nullable=True)
    agenda: Mapped[Any] = mapped_column(JSON)
    content: Mapped[str] = mapped_column(String)
    decisions: Mapped[Any | None] = mapped_column(JSON, nullable=True)
    action_items: Mapped[Any | None] = mapped_column("actionItems", JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        "createdAt", server_default=func.now(), default=utcnow
    )
    updated_at: Mapped[datetime] = mapped_column(
        "updatedAt", server_default=func.now(), default=utcnow, onupdate=utcnow
    )
    meeting_type_id: Mapped[str] = mapped_column(
        "meetingTypeId", String, ForeignKey("meeting_types.id")
    )
    created_by_id: Mapped[str] = mapped_column("createdById", String, ForeignKey("profiles.id"))

    meeting_type: Mapped["MeetingType"] = relationship("MeetingType", lazy="raise")
    created_by: Mapped["Profile"] = relationship(
        "Profile", foreign_keys=[created_by_id], lazy="raise"
    )
    attendees: Mapped[list["MeetingAttendee"]] = relationship(
        "MeetingAttendee", lazy="raise", cascade="all, delete-orphan"
    )


class MeetingAttendee(Base):
    __tablename__ = "meeting_attendees"
    __table_args__ = (UniqueConstraint("meetingId", "profileId"),)

    id: Mapped[str] = mapped_column(String, primary_key=True, default=cuid_id)
    present: Mapped[bool] = mapped_column(Boolean, server_default=text("1"))
    role: Mapped[str | None] = mapped_column(String, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        "createdAt", server_default=func.now(), default=utcnow
    )
    meeting_id: Mapped[str] = mapped_column(
        "meetingId", String, ForeignKey("meetings.id", ondelete="CASCADE")
    )
    profile_id: Mapped[str] = mapped_column("profileId", String, ForeignKey("profiles.id"))

    profile: Mapped["Profile"] = relationship("Profile", lazy="raise")

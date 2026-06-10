from datetime import datetime
from typing import Any

from sqlalchemy import Boolean, DateTime, ForeignKey, String, UniqueConstraint, func, text
from sqlalchemy.dialects.postgresql import JSONB, TSVECTOR
from sqlalchemy.orm import Mapped, mapped_column

from app.models import Base
from app.models.ids import cuid_id


class MeetingType(Base):
    __tablename__ = "meeting_types"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=cuid_id)
    code: Mapped[str] = mapped_column(String, unique=True)
    name: Mapped[str] = mapped_column(String)
    description: Mapped[str | None] = mapped_column(String, nullable=True)
    created_at: Mapped[datetime] = mapped_column("createdAt", server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        "updatedAt", server_default=func.now(), onupdate=func.now()
    )


class Meeting(Base):
    __tablename__ = "meetings"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=cuid_id)
    identifier: Mapped[str] = mapped_column(String, unique=True)
    date: Mapped[datetime] = mapped_column(DateTime)
    start_time: Mapped[str | None] = mapped_column("startTime", String, nullable=True)
    end_time: Mapped[str | None] = mapped_column("endTime", String, nullable=True)
    location: Mapped[str | None] = mapped_column(String, nullable=True)
    agenda: Mapped[Any] = mapped_column(JSONB)
    content: Mapped[str] = mapped_column(String)
    decisions: Mapped[Any | None] = mapped_column(JSONB, nullable=True)
    action_items: Mapped[Any | None] = mapped_column("actionItems", JSONB, nullable=True)
    created_at: Mapped[datetime] = mapped_column("createdAt", server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        "updatedAt", server_default=func.now(), onupdate=func.now()
    )
    # Maintained by a DB trigger (Portuguese tsvector). Read-only from the app.
    content_tsvector: Mapped[Any | None] = mapped_column("contentTsvector", TSVECTOR, nullable=True)
    meeting_type_id: Mapped[str] = mapped_column(
        "meetingTypeId", String, ForeignKey("meeting_types.id")
    )
    created_by_id: Mapped[str] = mapped_column("createdById", String, ForeignKey("profiles.id"))


class MeetingAttendee(Base):
    __tablename__ = "meeting_attendees"
    __table_args__ = (UniqueConstraint("meetingId", "profileId"),)

    id: Mapped[str] = mapped_column(String, primary_key=True, default=cuid_id)
    present: Mapped[bool] = mapped_column(Boolean, server_default=text("true"))
    role: Mapped[str | None] = mapped_column(String, nullable=True)
    created_at: Mapped[datetime] = mapped_column("createdAt", server_default=func.now())
    meeting_id: Mapped[str] = mapped_column(
        "meetingId", String, ForeignKey("meetings.id", ondelete="CASCADE")
    )
    profile_id: Mapped[str] = mapped_column("profileId", String, ForeignKey("profiles.id"))

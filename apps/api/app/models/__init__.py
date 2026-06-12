"""SQLAlchemy declarative base. Models are added in Phase 1 and imported here so
Alembic autogenerate and `Base.metadata` see every table.
"""

from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    pass


# Import every model so Base.metadata is complete (Alembic + mapper config).
# Placed after Base to avoid a circular import (models import Base from here).
from app.models.document import (  # noqa: E402,F401
    Document,
    DocumentSequence,
    DocumentSettings,
    OrdemItem,
)
from app.models.meeting import Meeting, MeetingAttendee, MeetingType  # noqa: E402,F401
from app.models.profile import Profile  # noqa: E402,F401
from app.models.scout import Scout, ScoutLeader, ScoutNightsBadge  # noqa: E402,F401

__all__ = [
    "Base",
    "Profile",
    "MeetingType",
    "Meeting",
    "MeetingAttendee",
    "Scout",
    "ScoutNightsBadge",
    "ScoutLeader",
    "Document",
    "DocumentSequence",
    "DocumentSettings",
    "OrdemItem",
]

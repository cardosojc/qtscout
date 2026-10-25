from datetime import datetime

from sqlalchemy import JSON, String, func, text
from sqlalchemy.orm import Mapped, mapped_column

from app.models import Base
from app.models._columns import str_enum, utcnow
from app.models.enums import OrdemSection, UserRole
from app.models.ids import uuid_id


class Profile(Base):
    __tablename__ = "profiles"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=uuid_id)
    username: Mapped[str] = mapped_column(String, unique=True)
    email: Mapped[str] = mapped_column(String, unique=True)
    name: Mapped[str] = mapped_column(String)
    role: Mapped[UserRole] = mapped_column(
        str_enum(UserRole, "UserRole"), server_default=text("'MEMBER'")
    )
    signature: Mapped[str | None] = mapped_column(String, nullable=True)
    roles: Mapped[list[str]] = mapped_column(JSON, server_default=text("'[]'"))
    section: Mapped[OrdemSection | None] = mapped_column(
        str_enum(OrdemSection, "OrdemSection"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        "createdAt", server_default=func.now(), default=utcnow
    )
    updated_at: Mapped[datetime] = mapped_column(
        "updatedAt", server_default=func.now(), default=utcnow, onupdate=utcnow
    )

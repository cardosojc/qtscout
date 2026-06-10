from datetime import datetime
from typing import TYPE_CHECKING, Any

from sqlalchemy import DateTime, ForeignKey, Integer, String, UniqueConstraint, func, text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models import Base
from app.models._columns import pg_enum
from app.models.enums import DocumentType, OrdemSection
from app.models.ids import cuid_id

if TYPE_CHECKING:
    from app.models.profile import Profile


class Document(Base):
    __tablename__ = "documents"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=cuid_id)
    type: Mapped[DocumentType] = mapped_column(pg_enum(DocumentType, "DocumentType"))
    number: Mapped[int] = mapped_column(Integer)
    year: Mapped[int | None] = mapped_column(Integer, nullable=True)
    content: Mapped[str] = mapped_column(String, server_default=text("''"))
    created_at: Mapped[datetime] = mapped_column("createdAt", server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        "updatedAt", server_default=func.now(), onupdate=func.now()
    )
    created_by_id: Mapped[str] = mapped_column("createdById", String, ForeignKey("profiles.id"))
    signed_by_id: Mapped[str | None] = mapped_column(
        "signedById", String, ForeignKey("profiles.id"), nullable=True
    )
    signed_at: Mapped[datetime | None] = mapped_column("signedAt", DateTime, nullable=True)

    # Eager-load explicitly (selectinload) — lazy IO is unavailable under async.
    created_by: Mapped["Profile"] = relationship(
        "Profile", foreign_keys=[created_by_id], lazy="raise"
    )
    signed_by: Mapped["Profile | None"] = relationship(
        "Profile", foreign_keys=[signed_by_id], lazy="raise"
    )


class DocumentSequence(Base):
    __tablename__ = "document_sequences"
    __table_args__ = (UniqueConstraint("type", "year"),)

    id: Mapped[str] = mapped_column(String, primary_key=True, default=cuid_id)
    type: Mapped[DocumentType] = mapped_column(pg_enum(DocumentType, "DocumentType"))
    # 0 = sentinel for ORDEM_SERVICO (global sequence, no year reset).
    year: Mapped[int] = mapped_column(Integer, server_default=text("0"))
    current_number: Mapped[int] = mapped_column("currentNumber", Integer, server_default=text("1"))


class DocumentSettings(Base):
    __tablename__ = "document_settings"

    type: Mapped[DocumentType] = mapped_column(
        pg_enum(DocumentType, "DocumentType"), primary_key=True
    )
    starting_number: Mapped[int] = mapped_column(
        "startingNumber", Integer, server_default=text("1")
    )


class OrdemItem(Base):
    __tablename__ = "ordem_items"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=cuid_id)
    external_id: Mapped[str | None] = mapped_column(
        "externalId", String, unique=True, nullable=True
    )
    category: Mapped[str] = mapped_column(String)
    section: Mapped[OrdemSection | None] = mapped_column(
        pg_enum(OrdemSection, "OrdemSection"), nullable=True
    )
    date: Mapped[datetime] = mapped_column(DateTime)
    data: Mapped[Any] = mapped_column(JSONB)
    created_at: Mapped[datetime] = mapped_column("createdAt", server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        "updatedAt", server_default=func.now(), onupdate=func.now()
    )
    created_by_id: Mapped[str] = mapped_column("createdById", String, ForeignKey("profiles.id"))
    included_in_os_id: Mapped[str | None] = mapped_column(
        "includedInOsId", String, ForeignKey("documents.id", ondelete="SET NULL"), nullable=True
    )

    created_by: Mapped["Profile"] = relationship(
        "Profile", foreign_keys=[created_by_id], lazy="raise"
    )

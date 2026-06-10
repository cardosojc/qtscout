from datetime import datetime

from sqlalchemy import (
    Boolean,
    DateTime,
    ForeignKey,
    Integer,
    String,
    UniqueConstraint,
    func,
    text,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.models import Base
from app.models._columns import pg_enum
from app.models.enums import OrdemSection
from app.models.ids import cuid_id


class Scout(Base):
    __tablename__ = "scouts"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=cuid_id)
    profile_id: Mapped[str | None] = mapped_column(
        "profileId",
        String,
        ForeignKey("profiles.id", ondelete="SET NULL"),
        unique=True,
        nullable=True,
    )
    first_name: Mapped[str] = mapped_column("firstName", String)
    last_name: Mapped[str] = mapped_column("lastName", String)
    numero_associado: Mapped[str | None] = mapped_column(
        "numeroAssociado", String, unique=True, nullable=True
    )
    date_of_birth: Mapped[datetime] = mapped_column("dateOfBirth", DateTime)
    section: Mapped[OrdemSection | None] = mapped_column(
        pg_enum(OrdemSection, "OrdemSection"), nullable=True
    )
    sexo: Mapped[str | None] = mapped_column(String, nullable=True)
    cc: Mapped[str | None] = mapped_column(String, nullable=True)
    nif: Mapped[str | None] = mapped_column(String, nullable=True)
    email: Mapped[str | None] = mapped_column(String, nullable=True)
    telefone: Mapped[str | None] = mapped_column(String, nullable=True)
    telemovel: Mapped[str | None] = mapped_column(String, nullable=True)
    morada: Mapped[str | None] = mapped_column(String, nullable=True)
    localidade: Mapped[str | None] = mapped_column(String, nullable=True)
    codigo_postal: Mapped[str | None] = mapped_column("codigoPostal", String, nullable=True)
    pai_nome: Mapped[str | None] = mapped_column("paiNome", String, nullable=True)
    pai_telefone: Mapped[str | None] = mapped_column("paiTelefone", String, nullable=True)
    pai_email: Mapped[str | None] = mapped_column("paiEmail", String, nullable=True)
    mae_nome: Mapped[str | None] = mapped_column("maeNome", String, nullable=True)
    mae_telefone: Mapped[str | None] = mapped_column("maeTelefone", String, nullable=True)
    mae_email: Mapped[str | None] = mapped_column("maeEmail", String, nullable=True)
    encarregado_nome: Mapped[str | None] = mapped_column("encarregadoNome", String, nullable=True)
    encarregado_telefone: Mapped[str | None] = mapped_column(
        "encarregadoTelefone", String, nullable=True
    )
    encarregado_email: Mapped[str | None] = mapped_column("encarregadoEmail", String, nullable=True)
    joined_at: Mapped[datetime] = mapped_column("joinedAt", DateTime, server_default=func.now())
    active: Mapped[bool] = mapped_column(Boolean, server_default=text("true"))
    noites_campo_inicial: Mapped[int] = mapped_column(
        "noitesCampoInicial", Integer, server_default=text("0")
    )
    created_at: Mapped[datetime] = mapped_column("createdAt", server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        "updatedAt", server_default=func.now(), onupdate=func.now()
    )


class ScoutNightsBadge(Base):
    __tablename__ = "scout_nights_badges"
    __table_args__ = (UniqueConstraint("scoutId", "count"),)

    id: Mapped[str] = mapped_column(String, primary_key=True, default=cuid_id)
    scout_id: Mapped[str] = mapped_column(
        "scoutId", String, ForeignKey("scouts.id", ondelete="CASCADE")
    )
    count: Mapped[int] = mapped_column(Integer)
    awarded_at: Mapped[datetime] = mapped_column("awardedAt", DateTime)
    created_at: Mapped[datetime] = mapped_column("createdAt", server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        "updatedAt", server_default=func.now(), onupdate=func.now()
    )


class ScoutLeader(Base):
    __tablename__ = "scout_leaders"
    __table_args__ = (UniqueConstraint("scoutId", "leaderId"),)

    id: Mapped[str] = mapped_column(String, primary_key=True, default=cuid_id)
    scout_id: Mapped[str] = mapped_column(
        "scoutId", String, ForeignKey("scouts.id", ondelete="CASCADE")
    )
    leader_id: Mapped[str] = mapped_column(
        "leaderId", String, ForeignKey("profiles.id", ondelete="CASCADE")
    )
    assigned_at: Mapped[datetime] = mapped_column("assignedAt", DateTime, server_default=func.now())

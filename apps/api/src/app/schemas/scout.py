from app.models.enums import OrdemSection
from app.schemas.base import ORMModel, PrismaDateTime


class ScoutOut(ORMModel):
    id: str
    profile_id: str | None
    first_name: str
    last_name: str
    numero_associado: str | None
    date_of_birth: PrismaDateTime
    section: OrdemSection | None
    sexo: str | None
    cc: str | None
    nif: str | None
    email: str | None
    telefone: str | None
    telemovel: str | None
    morada: str | None
    localidade: str | None
    codigo_postal: str | None
    pai_nome: str | None
    pai_telefone: str | None
    pai_email: str | None
    mae_nome: str | None
    mae_telefone: str | None
    mae_email: str | None
    encarregado_nome: str | None
    encarregado_telefone: str | None
    encarregado_email: str | None
    joined_at: PrismaDateTime
    active: bool
    noites_campo_inicial: int
    created_at: PrismaDateTime
    updated_at: PrismaDateTime


class NightsBadgeOut(ORMModel):
    count: int
    awarded_at: PrismaDateTime


class CampNightOut(ORMModel):
    """One SIIE activity a scout took part in (camp-night accounting)."""

    activity_id: str
    description: str
    activity_type: str | None
    start_date: PrismaDateTime
    end_date: PrismaDateTime | None
    nights: int
    camp_nights: int


class CampNightMilestoneOut(ORMModel):
    count: int
    reached_on: PrismaDateTime
    activity_id: str
    description: str
    # The badge already recorded for this count (ScoutNightsBadge), if any.
    recorded_on: PrismaDateTime | None = None


class ScoutCampNightsOut(ORMModel):
    total: int
    activities: list[CampNightOut]
    milestones: list[CampNightMilestoneOut]
    imported_at: PrismaDateTime | None

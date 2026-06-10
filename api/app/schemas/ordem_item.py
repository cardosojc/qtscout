from typing import Any

from app.models.enums import OrdemSection
from app.schemas.base import ORMModel, PrismaDateTime


class OrdemCreatedByOut(ORMModel):
    id: str
    name: str | None
    email: str


class OrdemItemOut(ORMModel):
    id: str
    external_id: str | None
    category: str
    section: OrdemSection | None
    date: PrismaDateTime
    data: Any
    created_at: PrismaDateTime
    updated_at: PrismaDateTime
    created_by_id: str
    included_in_os_id: str | None
    created_by: OrdemCreatedByOut

from app.models.enums import OrdemSection, UserRole
from app.schemas.base import ORMModel, PrismaDateTime


class UserOut(ORMModel):
    id: str
    name: str
    email: str
    username: str
    role: UserRole
    created_at: PrismaDateTime


class LeaderProfileOut(ORMModel):
    id: str
    name: str
    email: str
    section: OrdemSection | None
    roles: list[str]

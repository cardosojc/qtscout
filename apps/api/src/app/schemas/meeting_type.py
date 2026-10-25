from app.schemas.base import ORMModel, PrismaDateTime


class MeetingTypeOut(ORMModel):
    id: str
    code: str
    name: str
    description: str | None
    created_at: PrismaDateTime
    updated_at: PrismaDateTime

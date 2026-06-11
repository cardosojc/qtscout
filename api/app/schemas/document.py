from pydantic import BaseModel

from app.models.enums import DocumentType
from app.schemas.base import ORMModel, PrismaDateTime


class CreatedByOut(ORMModel):
    name: str | None
    email: str


class SignedByOut(ORMModel):
    id: str
    name: str | None
    email: str
    signature: str | None
    roles: list[str]


class DocumentOut(ORMModel):
    id: str
    type: DocumentType
    number: int
    year: int | None
    content: str
    created_at: PrismaDateTime
    updated_at: PrismaDateTime
    created_by_id: str
    signed_by_id: str | None
    signed_at: PrismaDateTime | None
    created_by: CreatedByOut
    identifier: str = ""


class DocumentDetailOut(DocumentOut):
    signed_by: SignedByOut | None = None


class Pagination(BaseModel):
    page: int
    limit: int
    total: int
    totalPages: int  # noqa: N815


class DocumentListResponse(BaseModel):
    documents: list[DocumentOut]
    pagination: Pagination

from datetime import UTC, datetime
from typing import Annotated, Any

from fastapi import APIRouter, Body, Depends, HTTPException, Query
from fastapi.responses import Response
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.document_utils import format_document_identifier
from app.db import get_session
from app.deps import AdminUser, CurrentUser
from app.models import Document, DocumentSequence, DocumentSettings, Profile
from app.models.enums import DocumentType
from app.pdf.render import generate_document_pdf
from app.schemas.document import DocumentDetailOut, DocumentOut, Pagination

router = APIRouter(prefix="/documents", tags=["documents"])

_VALID_TYPES = {"OFICIO", "CIRCULAR", "ORDEM_SERVICO"}


def _parse_date(value: str) -> datetime:
    # Mirror `new Date(...)`; store comparison value as naive UTC (columns are tz-naive).
    parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    return parsed.astimezone(UTC).replace(tzinfo=None) if parsed.tzinfo else parsed


def _with_identifier(doc: Document, schema: type[DocumentOut] = DocumentOut) -> DocumentOut:
    out = schema.model_validate(doc)
    out.identifier = format_document_identifier(doc.type, doc.number, doc.year)
    return out


@router.get("")
async def list_documents(
    user: CurrentUser,
    session: Annotated[AsyncSession, Depends(get_session)],
    page: int = 1,
    limit: int = 10,
    type: Annotated[DocumentType | None, Query()] = None,
    from_: Annotated[str | None, Query(alias="from")] = None,
    to: Annotated[str | None, Query()] = None,
) -> dict[str, Any]:
    conditions = []
    if type is not None:
        conditions.append(Document.type == type)
    if from_:
        conditions.append(Document.created_at >= _parse_date(from_))
    if to:
        conditions.append(Document.created_at <= _parse_date(to))

    total = await session.scalar(select(func.count()).select_from(Document).where(*conditions)) or 0
    rows = (
        await session.scalars(
            select(Document)
            .where(*conditions)
            .options(selectinload(Document.created_by))
            .order_by(Document.created_at.desc())
            .offset((page - 1) * limit)
            .limit(limit)
        )
    ).all()

    return {
        "documents": [_with_identifier(d) for d in rows],
        "pagination": Pagination(
            page=page, limit=limit, total=total, totalPages=-(-total // limit) if limit else 0
        ),
    }


@router.post("")
async def create_document(
    user: CurrentUser,
    session: Annotated[AsyncSession, Depends(get_session)],
    body: Annotated[dict[str, Any], Body()],
) -> DocumentOut:
    doc_type = body.get("type")
    if not doc_type or doc_type not in _VALID_TYPES:
        raise HTTPException(status_code=400, detail="Invalid document type")
    type_ = DocumentType(doc_type)
    content = body.get("content") or ""

    current_year = datetime.now(UTC).year
    is_os = type_ == DocumentType.ORDEM_SERVICO
    document_year = None if is_os else current_year
    seq_year = 0 if is_os else current_year

    settings = await session.scalar(select(DocumentSettings).where(DocumentSettings.type == type_))
    starting_number = settings.starting_number if settings else 1

    existing = await session.scalar(
        select(DocumentSequence)
        .where(DocumentSequence.type == type_, DocumentSequence.year == seq_year)
        .with_for_update()
    )
    if existing is not None:
        next_number = max(existing.current_number + 1, starting_number)
        existing.current_number = next_number
    else:
        next_number = starting_number
        session.add(DocumentSequence(type=type_, year=seq_year, current_number=next_number))

    doc = Document(
        type=type_,
        number=next_number,
        year=document_year,
        content=content,
        created_by_id=user.id,
    )
    session.add(doc)
    await session.commit()

    created = await session.scalar(
        select(Document).where(Document.id == doc.id).options(selectinload(Document.created_by))
    )
    assert created is not None
    return _with_identifier(created)


@router.get("/{doc_id}")
async def get_document(
    doc_id: str, user: CurrentUser, session: Annotated[AsyncSession, Depends(get_session)]
) -> DocumentDetailOut:
    doc = await session.scalar(
        select(Document)
        .where(Document.id == doc_id)
        .options(selectinload(Document.created_by), selectinload(Document.signed_by))
    )
    if doc is None:
        raise HTTPException(status_code=404, detail="Document not found")
    out = DocumentDetailOut.model_validate(doc)
    out.identifier = format_document_identifier(doc.type, doc.number, doc.year)
    return out


@router.put("/{doc_id}")
async def update_document(
    doc_id: str,
    user: CurrentUser,
    session: Annotated[AsyncSession, Depends(get_session)],
    body: Annotated[dict[str, Any], Body()],
) -> DocumentOut:
    doc = await session.scalar(
        select(Document).where(Document.id == doc_id).options(selectinload(Document.created_by))
    )
    if doc is None:
        raise HTTPException(status_code=404, detail="Document not found")
    doc.content = body.get("content", "")
    await session.commit()
    await session.refresh(doc, attribute_names=["content", "updated_at"])
    return _with_identifier(doc)


@router.delete("/{doc_id}")
async def delete_document(
    doc_id: str, admin: AdminUser, session: Annotated[AsyncSession, Depends(get_session)]
) -> dict[str, str]:
    doc = await session.scalar(select(Document).where(Document.id == doc_id))
    if doc is None:
        raise HTTPException(status_code=404, detail="Document not found")
    await session.delete(doc)
    await session.commit()
    return {"message": "Document deleted successfully"}


@router.post("/{doc_id}/sign")
async def sign_document(
    doc_id: str, user: CurrentUser, session: Annotated[AsyncSession, Depends(get_session)]
) -> dict[str, bool]:
    profile = await session.scalar(select(Profile).where(Profile.id == user.id))
    if profile is None or not profile.signature:
        raise HTTPException(
            status_code=400, detail="Carregue uma assinatura no seu perfil antes de assinar."
        )
    doc = await session.scalar(select(Document).where(Document.id == doc_id))
    if doc is None:
        raise HTTPException(status_code=404, detail="Documento não encontrado")
    if doc.signed_by_id:
        raise HTTPException(status_code=409, detail="Documento já assinado")
    doc.signed_by_id = user.id
    doc.signed_at = datetime.now(UTC).replace(tzinfo=None)
    await session.commit()
    return {"ok": True}


@router.delete("/{doc_id}/sign")
async def unsign_document(
    doc_id: str, user: CurrentUser, session: Annotated[AsyncSession, Depends(get_session)]
) -> dict[str, bool]:
    doc = await session.scalar(select(Document).where(Document.id == doc_id))
    if doc is None:
        raise HTTPException(status_code=404, detail="Documento não encontrado")
    if not doc.signed_by_id:
        return {"ok": True}
    if doc.signed_by_id != user.id and user.role != "ADMIN":
        raise HTTPException(
            status_code=403,
            detail="Apenas o signatário ou um administrador podem remover a assinatura.",
        )
    doc.signed_by_id = None
    doc.signed_at = None
    await session.commit()
    return {"ok": True}


@router.get("/{doc_id}/pdf")
async def document_pdf(
    doc_id: str,
    user: CurrentUser,
    session: Annotated[AsyncSession, Depends(get_session)],
    download: Annotated[str | None, Query()] = None,
) -> Response:
    doc = await session.scalar(
        select(Document)
        .where(Document.id == doc_id)
        .options(selectinload(Document.created_by), selectinload(Document.signed_by))
    )
    if doc is None:
        raise HTTPException(status_code=404, detail="Document not found")

    identifier = format_document_identifier(doc.type, doc.number, doc.year)
    signed_by = None
    if doc.signed_by is not None:
        signed_by = {
            "name": doc.signed_by.name,
            "email": doc.signed_by.email,
            "signature": doc.signed_by.signature,
            "roles": doc.signed_by.roles,
        }
    pdf = await generate_document_pdf(
        {
            "type": doc.type,
            "content": doc.content,
            "identifier": identifier,
            "createdAt": doc.created_at,
            "createdBy": {"name": doc.created_by.name, "email": doc.created_by.email},
            "signedAt": doc.signed_at,
            "signedBy": signed_by,
        }
    )
    disposition = "attachment" if download == "true" else "inline"
    return Response(
        content=pdf,
        media_type="application/pdf",
        headers={"Content-Disposition": f'{disposition}; filename="{identifier}.pdf"'},
    )

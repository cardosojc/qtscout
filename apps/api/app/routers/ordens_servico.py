import json
from datetime import UTC, datetime
from typing import Annotated, Any

from fastapi import APIRouter, Body, Depends, HTTPException
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.document_utils import format_document_identifier
from app.core.ordem_assembler import add_noites_member, assemble_ordem_servico
from app.core.ordem_resolver import resolve_refs, scout_label
from app.core.ordem_servico import SECTION_KEY
from app.db import get_session
from app.deps import AdminUser
from app.models import (
    Document,
    DocumentSequence,
    DocumentSettings,
    OrdemItem,
    Scout,
    ScoutNightsBadge,
)
from app.models.enums import DocumentType
from app.schemas.document import DocumentOut

router = APIRouter(prefix="/ordens-servico", tags=["ordens-servico"])

_OS = DocumentType.ORDEM_SERVICO


def _parse(value: Any, message: str) -> datetime:
    if not isinstance(value, str):
        raise HTTPException(status_code=400, detail=message)
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        raise HTTPException(status_code=400, detail=message) from None
    return parsed.astimezone(UTC).replace(tzinfo=None) if parsed.tzinfo else parsed


@router.post("/generate")
async def generate(
    admin: AdminUser,
    session: Annotated[AsyncSession, Depends(get_session)],
    body: Annotated[dict[str, Any], Body()],
) -> dict[str, Any]:
    from_dt = _parse(body.get("from"), "Data inicial inválida")
    to_dt = _parse(body.get("to"), "Data final inválida")
    if from_dt > to_dt:
        raise HTTPException(status_code=400, detail="Intervalo inválido")

    items = (
        await session.scalars(
            select(OrdemItem)
            .where(
                OrdemItem.date >= from_dt,
                OrdemItem.date <= to_dt,
                OrdemItem.included_in_os_id.is_(None),
            )
            .order_by(OrdemItem.date.asc(), OrdemItem.created_at.asc())
        )
    ).all()
    admitted = (
        await session.execute(
            select(Scout.first_name, Scout.last_name, Scout.numero_associado, Scout.section)
            .where(
                Scout.joined_at >= from_dt,
                Scout.joined_at <= to_dt,
                Scout.section.is_not(None),
            )
            .order_by(Scout.section.asc(), Scout.joined_at.asc())
        )
    ).all()
    badges = (
        await session.execute(
            select(
                # Alias avoids Row.count colliding with tuple.count (returns the
                # method, not the column value).
                ScoutNightsBadge.count.label("noites"),
                Scout.first_name,
                Scout.last_name,
                Scout.numero_associado,
                Scout.section,
            )
            .join(Scout, ScoutNightsBadge.scout_id == Scout.id)
            .where(
                ScoutNightsBadge.awarded_at >= from_dt,
                ScoutNightsBadge.awarded_at <= to_dt,
                Scout.section.is_not(None),
            )
            .order_by(ScoutNightsBadge.count.asc(), ScoutNightsBadge.awarded_at.asc())
        )
    ).all()

    if not items and not admitted and not badges:
        raise HTTPException(
            status_code=400, detail="Sem itens, admissões nem insígnias neste intervalo"
        )

    refs = await resolve_refs(session, items)
    assembled = assemble_ordem_servico(
        items, {"de": from_dt.isoformat()[:10], "ate": to_dt.isoformat()[:10]}, refs
    )

    # Auto-include admissions (Scout.joinedAt in range).
    for s in admitted:
        key = SECTION_KEY.get(s.section)
        if not key:
            continue
        assembled["efetivo"]["admissao"][key].append(
            scout_label(
                {
                    "firstName": s.first_name,
                    "lastName": s.last_name,
                    "numeroAssociado": s.numero_associado,
                }
            )
        )

    # Auto-include noites de campo milestones, merged into the manually-logged
    # buckets (grouped by section + count, deduped by member name).
    for b in badges:
        key = SECTION_KEY.get(b.section)
        if not key:
            continue
        add_noites_member(
            assembled["noitesCampo"][key],
            b.noites,
            scout_label(
                {
                    "firstName": b.first_name,
                    "lastName": b.last_name,
                    "numeroAssociado": b.numero_associado,
                }
            ),
        )
    for buckets in assembled["noitesCampo"].values():
        buckets.sort(key=lambda x: x.get("count", 0))

    # Transactional: bump the OS sequence, create the Document, mark source items.
    settings = await session.scalar(select(DocumentSettings).where(DocumentSettings.type == _OS))
    starting = settings.starting_number if settings else 1
    existing = await session.scalar(
        select(DocumentSequence)
        .where(DocumentSequence.type == _OS, DocumentSequence.year == 0)
        .with_for_update()
    )
    if existing is not None:
        next_number = max(existing.current_number + 1, starting)
        existing.current_number = next_number
    else:
        next_number = starting
        session.add(DocumentSequence(type=_OS, year=0, current_number=next_number))

    doc = Document(
        type=_OS,
        number=next_number,
        year=None,
        content=json.dumps(assembled, separators=(",", ":"), ensure_ascii=False),
        created_by_id=admin.id,
    )
    session.add(doc)
    await session.flush()
    if items:
        await session.execute(
            update(OrdemItem)
            .where(OrdemItem.id.in_([i.id for i in items]))
            .values(included_in_os_id=doc.id)
        )
    await session.commit()

    created = await session.scalar(
        select(Document).where(Document.id == doc.id).options(selectinload(Document.created_by))
    )
    assert created is not None
    out = DocumentOut.model_validate(created)
    out.identifier = format_document_identifier(_OS, created.number, created.year)
    return {
        **out.model_dump(mode="json", by_alias=True),
        "itemCount": len(items),
        "autoAdmissions": len(admitted),
        "autoNightsBadges": len(badges),
    }

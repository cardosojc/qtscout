from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.dialects.sqlite import insert as sqlite_insert
from sqlalchemy.orm import Session

from app.db import get_session
from app.deps import AdminUser, CurrentUser
from app.models import DocumentSettings
from app.models.enums import DocumentType
from app.schemas.settings import DocumentSettingItem, DocumentSettingsBody

router = APIRouter(prefix="/settings", tags=["settings"])

ALL_TYPES = [DocumentType.OFICIO, DocumentType.CIRCULAR, DocumentType.ORDEM_SERVICO]


@router.get("/documents")
async def get_document_settings(
    user: CurrentUser,
    session: Annotated[Session, Depends(get_session)],
) -> dict[str, list[DocumentSettingItem]]:
    rows = (session.scalars(select(DocumentSettings))).all()
    by_type = {r.type: r.starting_number for r in rows}
    settings = [DocumentSettingItem(type=t, startingNumber=by_type.get(t, 1)) for t in ALL_TYPES]
    return {"settings": settings}


@router.put("/documents")
async def put_document_settings(
    user: AdminUser,
    body: DocumentSettingsBody,
    session: Annotated[Session, Depends(get_session)],
) -> dict[str, str]:
    for item in body.settings:
        stmt = (
            sqlite_insert(DocumentSettings)
            .values(type=item.type, starting_number=item.startingNumber)
            .on_conflict_do_update(
                index_elements=[DocumentSettings.type],
                set_={DocumentSettings.starting_number: item.startingNumber},
            )
        )
        session.execute(stmt)
    session.commit()
    return {"message": "Settings saved"}

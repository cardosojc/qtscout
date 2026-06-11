import re
from typing import Annotated, Any

from fastapi import APIRouter, Body, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.leader_roles import is_leader_role
from app.db import get_session
from app.deps import CurrentUser
from app.models import Profile
from app.models.enums import OrdemSection

router = APIRouter(prefix="/profile", tags=["profile"])

MAX_SIGNATURE_BYTES = 500_000  # ~500KB of base64 payload
ALLOWED_MIME = re.compile(r"^data:image/(png|jpe?g);base64,", re.IGNORECASE)


async def _load(session: AsyncSession, user_id: str) -> Profile:
    profile = await session.scalar(select(Profile).where(Profile.id == user_id))
    if profile is None:
        raise HTTPException(status_code=401, detail="Unauthorized")
    return profile


@router.get("/roles")
async def get_roles(
    user: CurrentUser, session: Annotated[AsyncSession, Depends(get_session)]
) -> dict[str, list[str]]:
    profile = await session.scalar(select(Profile).where(Profile.id == user.id))
    return {"roles": profile.roles if profile else []}


@router.put("/roles")
async def put_roles(
    user: CurrentUser,
    session: Annotated[AsyncSession, Depends(get_session)],
    payload: Annotated[dict[str, Any], Body()],
) -> dict[str, list[str]]:
    roles = payload.get("roles")
    if not isinstance(roles, list) or not all(is_leader_role(r) for r in roles):
        raise HTTPException(status_code=400, detail="Funções inválidas")
    unique = list(dict.fromkeys(roles))  # de-dupe, preserve order
    profile = await _load(session, user.id)
    profile.roles = unique
    await session.commit()
    return {"roles": unique}


@router.get("/section")
async def get_section(
    user: CurrentUser, session: Annotated[AsyncSession, Depends(get_session)]
) -> dict[str, OrdemSection | None]:
    profile = await session.scalar(select(Profile).where(Profile.id == user.id))
    return {"section": profile.section if profile else None}


@router.put("/section")
async def put_section(
    user: CurrentUser,
    session: Annotated[AsyncSession, Depends(get_session)],
    payload: Annotated[dict[str, Any], Body()],
) -> dict[str, OrdemSection | None]:
    section = payload.get("section")
    if section is not None and section not in OrdemSection.__members__.values():
        raise HTTPException(status_code=400, detail="Secção inválida")
    parsed = OrdemSection(section) if section is not None else None
    profile = await _load(session, user.id)
    profile.section = parsed
    await session.commit()
    return {"section": parsed}


@router.get("/signature")
async def get_signature(
    user: CurrentUser, session: Annotated[AsyncSession, Depends(get_session)]
) -> dict[str, str | None]:
    profile = await session.scalar(select(Profile).where(Profile.id == user.id))
    return {"signature": profile.signature if profile else None}


@router.put("/signature")
async def put_signature(
    user: CurrentUser,
    session: Annotated[AsyncSession, Depends(get_session)],
    payload: Annotated[dict[str, Any], Body()],
) -> dict[str, str]:
    signature = payload.get("signature")
    if not isinstance(signature, str) or not ALLOWED_MIME.match(signature):
        raise HTTPException(status_code=400, detail="Imagem inválida (PNG ou JPEG)")
    if len(signature) > MAX_SIGNATURE_BYTES:
        raise HTTPException(status_code=413, detail="Imagem demasiado grande (máx. ~400KB)")
    profile = await _load(session, user.id)
    profile.signature = signature
    await session.commit()
    return {"signature": signature}


@router.delete("/signature")
async def delete_signature(
    user: CurrentUser, session: Annotated[AsyncSession, Depends(get_session)]
) -> dict[str, None]:
    profile = await _load(session, user.id)
    profile.signature = None
    await session.commit()
    return {"signature": None}

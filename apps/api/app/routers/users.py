from typing import Annotated, Any

from fastapi import APIRouter, Body, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_session
from app.deps import AdminUser
from app.models import Profile
from app.models.enums import UserRole
from app.schemas.user import UserOut
from app.supabase_admin import delete_user

router = APIRouter(prefix="/users", tags=["users"])

_VALID_ROLES = {"ADMIN", "LEADER", "MEMBER"}


@router.get("")
async def list_users(
    admin: AdminUser, session: Annotated[AsyncSession, Depends(get_session)]
) -> dict[str, list[UserOut]]:
    result = await session.scalars(select(Profile).order_by(Profile.created_at.asc()))
    return {"users": [UserOut.model_validate(p) for p in result.all()]}


@router.patch("/{user_id}")
async def update_user_role(
    user_id: str,
    admin: AdminUser,
    session: Annotated[AsyncSession, Depends(get_session)],
    payload: Annotated[dict[str, Any], Body()],
) -> dict[str, UserOut]:
    if user_id == admin.id:
        raise HTTPException(status_code=400, detail="Não pode alterar o seu próprio papel")
    role = payload.get("role")
    if role not in _VALID_ROLES:
        raise HTTPException(status_code=400, detail="Papel inválido")
    profile = await session.scalar(select(Profile).where(Profile.id == user_id))
    if profile is None:
        raise HTTPException(status_code=404, detail="Utilizador não encontrado")
    profile.role = UserRole(role)
    await session.commit()
    await session.refresh(profile)
    return {"user": UserOut.model_validate(profile)}


@router.delete("/{user_id}")
async def delete_user_route(
    user_id: str,
    admin: AdminUser,
    session: Annotated[AsyncSession, Depends(get_session)],
) -> dict[str, str]:
    if user_id == admin.id:
        raise HTTPException(status_code=400, detail="Não pode eliminar a sua própria conta")
    error = await delete_user(user_id)
    if error:
        raise HTTPException(status_code=500, detail=error)
    profile = await session.scalar(select(Profile).where(Profile.id == user_id))
    if profile is not None:
        await session.delete(profile)
        await session.commit()
    return {"message": "Utilizador eliminado"}

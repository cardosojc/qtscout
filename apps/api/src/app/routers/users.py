from typing import Annotated, Any

from fastapi import APIRouter, Body, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.access_admin import grant_access, revoke_access
from app.db import get_session
from app.deps import AdminUser
from app.models import Profile
from app.models.enums import UserRole
from app.schemas.user import UserOut

router = APIRouter(prefix="/users", tags=["users"])

_VALID_ROLES = {"ADMIN", "LEADER", "MEMBER"}


@router.get("")
async def list_users(
    admin: AdminUser, session: Annotated[Session, Depends(get_session)]
) -> dict[str, list[UserOut]]:
    result = session.scalars(select(Profile).order_by(Profile.created_at.asc()))
    return {"users": [UserOut.model_validate(p) for p in result.all()]}


@router.post("", status_code=201)
async def create_user(
    admin: AdminUser,
    session: Annotated[Session, Depends(get_session)],
    payload: Annotated[dict[str, Any], Body()],
) -> dict[str, Any]:
    """Give someone access: a profile row + their email in the Access group.

    There are no passwords — the person signs in with a one-time PIN sent to
    this email by Cloudflare Access.
    """
    email = (payload.get("email") or "").strip().lower()
    name = (payload.get("name") or "").strip()
    username = (payload.get("username") or "").strip()
    role = payload.get("role") or "MEMBER"

    if not email or not name or not username:
        raise HTTPException(status_code=400, detail="Todos os campos são obrigatórios")
    if "@" not in email:
        raise HTTPException(status_code=400, detail="Email inválido")
    if role not in _VALID_ROLES:
        raise HTTPException(status_code=400, detail="Papel inválido")
    if session.scalar(select(Profile).where(Profile.username == username)):
        raise HTTPException(status_code=400, detail="Nome de utilizador já existe")
    if session.scalar(select(Profile).where(func.lower(Profile.email) == email)):
        raise HTTPException(status_code=400, detail="Email já está registado")

    # Grant Access first: if it fails, no orphan profile is left behind.
    error = await grant_access(email)
    if error:
        raise HTTPException(status_code=502, detail=error)

    profile = Profile(username=username, email=email, name=name, role=UserRole(role))
    session.add(profile)
    session.commit()
    session.refresh(profile)
    return {"message": "Utilizador criado com sucesso", "user": UserOut.model_validate(profile)}


@router.patch("/{user_id}")
async def update_user_role(
    user_id: str,
    admin: AdminUser,
    session: Annotated[Session, Depends(get_session)],
    payload: Annotated[dict[str, Any], Body()],
) -> dict[str, UserOut]:
    if user_id == admin.id:
        raise HTTPException(status_code=400, detail="Não pode alterar o seu próprio papel")
    role = payload.get("role")
    if role not in _VALID_ROLES:
        raise HTTPException(status_code=400, detail="Papel inválido")
    profile = session.scalar(select(Profile).where(Profile.id == user_id))
    if profile is None:
        raise HTTPException(status_code=404, detail="Utilizador não encontrado")
    profile.role = UserRole(role)
    session.commit()
    session.refresh(profile)
    return {"user": UserOut.model_validate(profile)}


@router.delete("/{user_id}")
async def delete_user_route(
    user_id: str,
    admin: AdminUser,
    session: Annotated[Session, Depends(get_session)],
) -> dict[str, str]:
    if user_id == admin.id:
        raise HTTPException(status_code=400, detail="Não pode eliminar a sua própria conta")
    profile = session.scalar(select(Profile).where(Profile.id == user_id))
    if profile is None:
        raise HTTPException(status_code=404, detail="Utilizador não encontrado")
    error = await revoke_access(profile.email)
    if error:
        raise HTTPException(status_code=502, detail=error)
    session.delete(profile)
    session.commit()
    return {"message": "Utilizador eliminado"}

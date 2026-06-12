from typing import Annotated, Any

from fastapi import APIRouter, Body, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_session
from app.deps import CurrentUser
from app.models import Profile
from app.models.enums import UserRole
from app.schemas.session import SessionUser
from app.schemas.user import UserOut
from app.supabase_admin import create_user

router = APIRouter(prefix="/auth", tags=["auth"])


@router.get("/profile", response_model=SessionUser)
async def get_profile(user: CurrentUser) -> SessionUser:
    return user


@router.post("/register", status_code=201)
async def register(
    session: Annotated[AsyncSession, Depends(get_session)],
    payload: Annotated[dict[str, Any], Body()],
) -> dict[str, Any]:
    username = payload.get("username")
    email = payload.get("email")
    name = payload.get("name")
    password = payload.get("password")
    confirm_password = payload.get("confirmPassword")

    if not username or not email or not name or not password or not confirm_password:
        raise HTTPException(status_code=400, detail="Todos os campos são obrigatórios")
    if password != confirm_password:
        raise HTTPException(status_code=400, detail="As palavras-passe não coincidem")
    if len(password) < 6:
        raise HTTPException(
            status_code=400, detail="A palavra-passe deve ter pelo menos 6 caracteres"
        )

    if await session.scalar(select(Profile).where(Profile.username == username)):
        raise HTTPException(status_code=400, detail="Nome de utilizador já existe")
    if await session.scalar(select(Profile).where(Profile.email == email)):
        raise HTTPException(status_code=400, detail="Email já está registado")

    sb_user, error = await create_user(email=email, password=password, name=name, username=username)
    if error or sb_user is None:
        raise HTTPException(status_code=400, detail=error or "Erro ao criar utilizador")

    profile = Profile(
        id=sb_user["id"], username=username, email=email, name=name, role=UserRole.MEMBER
    )
    session.add(profile)
    await session.commit()
    await session.refresh(profile)

    return {
        "message": "Utilizador criado com sucesso",
        "user": UserOut.model_validate(profile),
    }

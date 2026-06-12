"""Auth dependencies — replace the Hono `requireAuth` / `requireAdmin` middleware.

Use `CurrentUser` on any authenticated route and `AdminUser` on ADMIN-only ones.
The hydrated `SessionUser` mirrors `c.get('session').user`.
"""

from typing import Annotated

from fastapi import Depends, Header, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import bearer_from_header, verify_supabase_token
from app.db import get_session
from app.models import Profile
from app.models.enums import UserRole
from app.schemas.session import SessionUser


async def current_user(
    session: Annotated[AsyncSession, Depends(get_session)],
    authorization: Annotated[str | None, Header()] = None,
) -> SessionUser:
    token = bearer_from_header(authorization)
    if not token:
        raise HTTPException(status_code=401, detail="Unauthorized")
    sb_user = await verify_supabase_token(token)
    if not sb_user:
        raise HTTPException(status_code=401, detail="Unauthorized")
    profile = await session.scalar(select(Profile).where(Profile.id == sb_user["id"]))
    if profile is None:
        raise HTTPException(status_code=401, detail="Unauthorized")
    return SessionUser(
        id=profile.id,
        email=profile.email,
        name=profile.name,
        username=profile.username,
        role=profile.role,
    )


CurrentUser = Annotated[SessionUser, Depends(current_user)]


async def require_admin(user: CurrentUser) -> SessionUser:
    if user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Forbidden")
    return user


AdminUser = Annotated[SessionUser, Depends(require_admin)]

"""Auth dependencies — replace the Hono `requireAuth` / `requireAdmin` middleware.

Use `CurrentUser` on any authenticated route and `AdminUser` on ADMIN-only ones.
The hydrated `SessionUser` mirrors `c.get('session').user`.
"""

from typing import Annotated

from fastapi import Cookie, Depends, Header, HTTPException
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.auth import ACCESS_JWT_COOKIE, identify
from app.db import get_session
from app.models import Profile
from app.models.enums import UserRole
from app.schemas.session import SessionUser


async def current_user(
    session: Annotated[Session, Depends(get_session)],
    cf_access_jwt_assertion: Annotated[str | None, Header()] = None,
    cf_authorization: Annotated[str | None, Cookie(alias=ACCESS_JWT_COOKIE)] = None,
) -> SessionUser:
    email = await identify(cf_access_jwt_assertion, cf_authorization)
    if not email:
        raise HTTPException(status_code=401, detail="Unauthorized")
    # Access authenticates the email; the profile authorizes it. An email that
    # passed Access but has no profile is signed in yet has no access to the app.
    profile = session.scalar(select(Profile).where(func.lower(Profile.email) == email))
    if profile is None:
        raise HTTPException(status_code=403, detail="Sem acesso a esta aplicação")
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

from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db import get_session
from app.deps import CurrentUser
from app.models import Profile
from app.models.enums import UserRole
from app.schemas.user import LeaderProfileOut

router = APIRouter(prefix="/profiles", tags=["profiles"])


@router.get("/leaders")
async def list_leaders(
    user: CurrentUser, session: Annotated[Session, Depends(get_session)]
) -> dict[str, list[LeaderProfileOut]]:
    result = session.scalars(
        select(Profile)
        .where(Profile.role.in_([UserRole.ADMIN, UserRole.LEADER]))
        .order_by(Profile.name.asc())
    )
    return {"profiles": [LeaderProfileOut.model_validate(p) for p in result.all()]}

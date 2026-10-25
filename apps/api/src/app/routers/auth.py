from fastapi import APIRouter

from app.deps import CurrentUser
from app.schemas.session import SessionUser

router = APIRouter(prefix="/auth", tags=["auth"])


@router.get("/profile", response_model=SessionUser)
async def get_profile(user: CurrentUser) -> SessionUser:
    return user

from pydantic import BaseModel

from app.models.enums import UserRole


class SessionUser(BaseModel):
    """Hydrated session user — same shape as the Hono API's Session.user."""

    id: str
    email: str
    name: str
    username: str
    role: UserRole

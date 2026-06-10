"""SQLAlchemy declarative base. Models are added in Phase 1 and imported here so
Alembic autogenerate and `Base.metadata` see every table.
"""

from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    pass


# Model modules are imported here as they are added (Phase 1), e.g.:
# from app.models.profile import Profile  # noqa: F401

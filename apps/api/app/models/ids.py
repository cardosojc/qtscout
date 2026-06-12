"""Primary-key generators matching Prisma's client-side defaults.

Profile uses uuid (`@default(uuid())`); every other table uses cuid
(`@default(cuid())`). These run app-side, so the columns have no DB default.
"""

from uuid import uuid4

import cuid as _cuid  # type: ignore[import-untyped]


def cuid_id() -> str:
    return str(_cuid.cuid())


def uuid_id() -> str:
    return str(uuid4())

"""Diagnostic endpoint that times each API->Supabase hop from inside the process.

Hit it from the laptop (EU->EU) and from the deployed API (region->Supabase EU)
to fill the latency budget without DevTools. Gated behind ``DEBUG_TIMING`` and
``AdminUser`` — remove once the slowness root cause is established.

Each field is wall-clock milliseconds:
- ``select1_ms``        — raw DB round-trip floor (SELECT 1).
- ``meetings_query_ms`` — the real list query (COUNT + SELECT + selectinloads).
- ``supabase_auth_ms``  — one GET /auth/v1/user (the per-request auth hop).
- ``pool_checkout_ms``  — opening a fresh pooled connection (incl. pre_ping).
"""

import time
from typing import Annotated, Any

from fastapi import APIRouter, Depends, Header, HTTPException
from sqlalchemy import func, select, text
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.auth import bearer_from_header, verify_supabase_token
from app.config import get_settings
from app.db import engine, get_session
from app.deps import AdminUser
from app.models import Meeting, MeetingAttendee

router = APIRouter(prefix="/_debug", tags=["_debug"])

settings = get_settings()


async def _elapsed_ms(coro: Any) -> float:
    start = time.perf_counter()
    await coro
    return (time.perf_counter() - start) * 1000.0


@router.get("/timing")
async def timing(
    _user: AdminUser,
    session: Annotated[AsyncSession, Depends(get_session)],
    authorization: Annotated[str | None, Header()] = None,
) -> dict[str, float]:
    if not settings.debug_timing:
        raise HTTPException(status_code=404, detail="Not Found")

    # 1. Raw DB round-trip floor.
    t0 = time.perf_counter()
    await session.execute(text("SELECT 1"))
    select1_ms = (time.perf_counter() - t0) * 1000.0

    # 2. The real meetings list query (COUNT + SELECT + selectinloads, page 1).
    t0 = time.perf_counter()
    await session.scalar(select(func.count()).select_from(Meeting))
    rows = (
        await session.scalars(
            select(Meeting)
            .options(
                selectinload(Meeting.meeting_type),
                selectinload(Meeting.created_by),
                selectinload(Meeting.attendees).selectinload(MeetingAttendee.profile),
            )
            .order_by(Meeting.date.desc())
            .limit(10)
        )
    ).all()
    _ = len(rows)
    meetings_query_ms = (time.perf_counter() - t0) * 1000.0

    # 3. The per-request Supabase auth hop, in isolation (uses caller's token).
    token = bearer_from_header(authorization)
    supabase_auth_ms = -1.0
    if token:
        t0 = time.perf_counter()
        await verify_supabase_token(token)
        supabase_auth_ms = (time.perf_counter() - t0) * 1000.0

    # 4. Opening a brand-new pooled connection (includes pool_pre_ping).
    t0 = time.perf_counter()
    async with engine.connect() as conn:
        await conn.execute(text("SELECT 1"))
    pool_checkout_ms = (time.perf_counter() - t0) * 1000.0

    return {
        "select1_ms": round(select1_ms, 1),
        "meetings_query_ms": round(meetings_query_ms, 1),
        "supabase_auth_ms": round(supabase_auth_ms, 1),
        "pool_checkout_ms": round(pool_checkout_ms, 1),
    }

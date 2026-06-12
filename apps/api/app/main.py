"""FastAPI application entrypoint.

All domain routers mount under /api so the web client only swaps the origin
(mirrors the Hono app). The OpenAPI schema generated here is the FE/BE contract
consumed by the web app's type generation.
"""

import logging
import time
from collections.abc import AsyncIterator, Awaitable, Callable
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.auth import close_http
from app.config import get_settings
from app.db import engine
from app.routers import (
    ai,
    auth,
    documents,
    meeting_types,
    meetings,
    ordem_items,
    ordens_servico,
    profile,
    profiles,
    scouts,
    search,
    users,
)
from app.routers import settings as settings_router
from app.timing import reset_timings

settings = get_settings()


@asynccontextmanager
async def lifespan(_app: FastAPI) -> AsyncIterator[None]:
    yield
    await engine.dispose()
    await close_http()


app = FastAPI(
    title="QTScout API",
    version="0.1.0",
    description="Meeting minutes + document management for Agrupamento 61 (CNE).",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
    # Diagnostic: let the browser read the per-hop timing header.
    expose_headers=["Server-Timing"],
)

# Use uvicorn's logger so the line shows under both `uvicorn` (local) and the
# gunicorn UvicornWorker (Railway) without extra logging config.
_timing_log = logging.getLogger("uvicorn.error")


@app.middleware("http")
async def request_timing(
    request: Request, call_next: Callable[[Request], Awaitable[Response]]
) -> Response:
    """Diagnostic: emit a Server-Timing header breaking a request into hops.

    `auth`/`profiledb` are filled by inner code via app.timing; `handler` is the
    remainder (business logic + endpoint queries). Remove once the slowness
    budget is established.
    """
    bucket = reset_timings()
    start = time.perf_counter()
    response = await call_next(request)
    total_ms = (time.perf_counter() - start) * 1000.0

    auth_ms = bucket.get("auth", 0.0)
    profile_ms = bucket.get("profiledb", 0.0)
    handler_ms = max(total_ms - auth_ms - profile_ms, 0.0)
    response.headers["Server-Timing"] = (
        f"auth;dur={auth_ms:.1f}, "
        f"profiledb;dur={profile_ms:.1f}, "
        f"handler;dur={handler_ms:.1f}, "
        f"total;dur={total_ms:.1f}"
    )
    _timing_log.info(
        "%s %s -> %d total=%.1fms auth=%.1fms profiledb=%.1fms handler=%.1fms",
        request.method,
        request.url.path,
        response.status_code,
        total_ms,
        auth_ms,
        profile_ms,
        handler_ms,
    )
    return response


@app.exception_handler(StarletteHTTPException)
async def http_exception_handler(_request: Request, exc: StarletteHTTPException) -> JSONResponse:
    """Render errors as `{"error": ...}` to match the Hono API's response shape."""
    return JSONResponse(status_code=exc.status_code, content={"error": exc.detail})


@app.get("/health")
@app.get("/api/health")
async def health() -> dict[str, bool]:
    return {"ok": True}


# Domain routers (mounted under /api as they are ported in Phase 2).
app.include_router(auth.router, prefix="/api")
app.include_router(profile.router, prefix="/api")
app.include_router(profiles.router, prefix="/api")
app.include_router(users.router, prefix="/api")
app.include_router(documents.router, prefix="/api")
app.include_router(scouts.router, prefix="/api")
app.include_router(meetings.router, prefix="/api")
app.include_router(meeting_types.router, prefix="/api")
app.include_router(ordem_items.router, prefix="/api")
app.include_router(ordens_servico.router, prefix="/api")
app.include_router(search.router, prefix="/api")
app.include_router(ai.router, prefix="/api")
app.include_router(settings_router.router, prefix="/api")

# Diagnostic-only: per-hop timing probe, gated by DEBUG_TIMING (remove after).
if settings.debug_timing:
    from app.routers import _debug_timing

    app.include_router(_debug_timing.router, prefix="/api")

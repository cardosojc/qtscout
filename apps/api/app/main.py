"""FastAPI application entrypoint.

All domain routers mount under /api so the web client only swaps the origin
(mirrors the Hono app). The OpenAPI schema generated here is the FE/BE contract
consumed by the web app's type generation.
"""

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.auth import close_http, prefetch_jwks
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

settings = get_settings()


@asynccontextmanager
async def lifespan(_app: FastAPI) -> AsyncIterator[None]:
    await prefetch_jwks()
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
)


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

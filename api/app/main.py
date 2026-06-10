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

from app.auth import close_http
from app.config import get_settings
from app.db import engine

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
)


@app.exception_handler(StarletteHTTPException)
async def http_exception_handler(_request: Request, exc: StarletteHTTPException) -> JSONResponse:
    """Render errors as `{"error": ...}` to match the Hono API's response shape."""
    return JSONResponse(status_code=exc.status_code, content={"error": exc.detail})


@app.get("/health")
@app.get("/api/health")
async def health() -> dict[str, bool]:
    return {"ok": True}


# Domain routers are mounted here as they are ported (Phase 2):
# from app.routers import meetings, documents, scouts, ...
# app.include_router(meetings.router, prefix="/api")

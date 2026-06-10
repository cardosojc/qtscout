"""FastAPI application entrypoint.

All domain routers mount under /api so the web client only swaps the origin
(mirrors the Hono app). The OpenAPI schema generated here is the FE/BE contract
consumed by the web app's type generation.
"""

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.db import engine

settings = get_settings()


@asynccontextmanager
async def lifespan(_app: FastAPI):  # type: ignore[no-untyped-def]
    yield
    await engine.dispose()


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


@app.get("/health")
@app.get("/api/health")
async def health() -> dict[str, bool]:
    return {"ok": True}


# Domain routers are mounted here as they are ported (Phase 2):
# from app.routers import meetings, documents, scouts, ...
# app.include_router(meetings.router, prefix="/api")

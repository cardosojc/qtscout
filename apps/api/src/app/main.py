"""FastAPI application entrypoint.

All domain routers mount under /api. The web Worker forwards same-origin
`/api/*` here over a service binding (the API has no public hostname), so there
is no CORS. In production this app runs inside the Python Worker (`entry.py`).
The OpenAPI schema generated here is the FE/BE contract consumed by the web
app's type generation.
"""

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.pdf.render import PdfBusy, PdfUnavailable
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

app = FastAPI(
    title="QTScout API",
    version="0.1.0",
    description="Meeting minutes + document management for Agrupamento 61 (CNE).",
)


@app.exception_handler(StarletteHTTPException)
async def http_exception_handler(_request: Request, exc: StarletteHTTPException) -> JSONResponse:
    """Render errors as `{"error": ...}` to match the Hono API's response shape."""
    return JSONResponse(status_code=exc.status_code, content={"error": exc.detail})


@app.exception_handler(PdfUnavailable)
async def pdf_unavailable_handler(_request: Request, _exc: PdfUnavailable) -> JSONResponse:
    return JSONResponse(status_code=503, content={"error": "PDF indisponível neste ambiente"})


@app.exception_handler(PdfBusy)
async def pdf_busy_handler(_request: Request, _exc: PdfBusy) -> JSONResponse:
    return JSONResponse(
        status_code=503,
        headers={"Retry-After": "10"},
        content={"error": "Muitos pedidos de PDF. Tente novamente daqui a alguns segundos."},
    )


@app.get("/health")
@app.get("/api/health")
async def health() -> dict[str, bool]:
    return {"ok": True}


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

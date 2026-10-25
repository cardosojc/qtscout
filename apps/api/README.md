# QTScout API (FastAPI on a Cloudflare Python Worker)

Backend for QTScout — meeting minutes + document management for **Agrupamento 61
– Santa Maria dos Olivais** (CNE). All endpoints mount under `/api`. User-facing
strings are pt-PT.

In production it runs as the Python Worker `qtscout-api`, reached only through
the web Worker's service binding (same hostname, behind Cloudflare Access).

## Stack

- **FastAPI** + Pydantic v2 (the OpenAPI schema is the FE/BE contract)
- **SQLAlchemy 2.0** (sync) on **D1** via a small DB-API shim; SQLite locally
- **Cloudflare Access** JWT verification (PyJWT + the team JWKS)
- **Browser Run** (headless Chromium) + **Jinja2** for PDFs
- **Workers AI** for the editor's AI rewrite
- **openpyxl** for SIIE xlsx imports
- Tooling: **uv**, **pywrangler** (`workers-py`), ruff, mypy, pytest

## Local development

```bash
cd apps/api
uv sync
uv run playwright install chromium          # local PDF rendering (optional)
uv run python scripts/local_db.py local.db --seed you@example.pt
AUTH_MODE=dev AUTH_DEV_EMAIL=you@example.pt \
  uv run uvicorn app.main:app --app-dir src --reload --port 3001
curl localhost:3001/api/health
```

Or in the real Worker runtime with a local D1 (Workers AI and Browser Run are
remote bindings, so this needs `npx wrangler login`):

```bash
npx wrangler d1 migrations apply qtscout --local
printf 'AUTH_MODE=dev\nAUTH_DEV_EMAIL=you@example.pt\n' > .dev.vars
uv run pywrangler dev
```

OpenAPI docs (uvicorn): <http://localhost:3001/docs>.

Checks: `uv run pytest`, `uv run ruff check src tests scripts`, `uv run mypy src/app`.

## Database

D1 database `qtscout` (binding `DB`). Schema in `d1/migrations/` — `0001_init.sql`
is generated from the models (`uv run python scripts/gen_schema.py`); later
changes are new numbered files applied with `npx wrangler d1 migrations apply
qtscout --remote`. D1 has no interactive transactions: see `src/app/db.py`.

## Deployment

See [`DEPLOY.md`](DEPLOY.md).

## Layout

```
src/
  entry.py       Worker entrypoint (ASGI adapter, env -> settings, bindings)
  app/
    main.py      FastAPI app, error handlers, router includes
    config.py    settings (pydantic-settings; read lazily)
    runtime.py   Worker vs local CPython (bindings, outbound HTTP)
    db.py        engine/session, D1 DB-API shim, atomic_batch
    auth.py      Access JWT verification; deps.py: current_user / require_admin
    access_admin.py  Access group membership (user create/delete)
    routers/     one module per domain
    models/      SQLAlchemy models (11 tables)
    schemas/     Pydantic request/response models
    core/        ordem assembler/resolver/permissions, SIIE import, search, numbering
    pdf/         Jinja2 templates + Browser Run renderer + fonts/assets
d1/migrations/   D1 schema
scripts/         gen_schema, local_db, export_openapi, pg_to_d1 (one-off)
tests/           pytest (SQLite with the D1 schema)
```

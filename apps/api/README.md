# QTScout API (FastAPI)

Backend for QTScout — meeting minutes + document management for **Agrupamento 61
– Santa Maria dos Olivais** (CNE). Replaces the former Hono/TypeScript API
(`apps/api`). All endpoints mount under `/api`. User-facing strings are pt-PT.

## Stack

- **FastAPI** + Pydantic v2 (the OpenAPI schema is the FE/BE contract)
- **SQLAlchemy 2.0** (async, asyncpg) + **Alembic** against Supabase Postgres
- **Supabase** auth (Bearer JWT) — `supabase-py` for service-role admin ops
- **Playwright** (Chromium) + **Jinja2** for PDF rendering
- **openpyxl** for SIIE xlsx imports
- Tooling: **uv**, ruff, mypy, pytest

## Local development

```bash
cd apps/api
uv sync                       # create .venv + install deps
cp .env.example .env          # fill in Supabase/DB values
uv run uvicorn app.main:app --reload --port 3001
# health check:
curl localhost:3001/api/health
```

OpenAPI docs: <http://localhost:3001/docs>. Raw schema: `/openapi.json`.

## Database / migrations

The schema already exists in Supabase (created by Prisma). Alembic is
**baseline-stamped** so no DDL runs on the existing tables; new changes go
through `uv run alembic revision --autogenerate` + `uv run alembic upgrade head`.
`DATABASE_URL` is the pooler (app); `DIRECT_URL` is the direct connection
(migrations).

## Deployment

Container on Railway/Render (see `Dockerfile`). The image installs Chromium for
Playwright. Set the env vars from `.env.example`; the platform provides `$PORT`.
The Next.js web app stays on Vercel and points `NEXT_PUBLIC_API_URL` at this
service.

## Layout

```
app/
  main.py        FastAPI app, CORS, router includes
  config.py      env settings (pydantic-settings)
  db.py          async engine/session
  deps.py        auth dependencies (current_user / require_admin)
  routers/       one module per domain
  models/        SQLAlchemy models (11 tables)
  schemas/       Pydantic request/response models
  core/          ordem assembler/resolver/permissions, SIIE import, ano_escutista
  pdf/           Jinja2 templates + Playwright renderer
migrations/      Alembic
```

# QTScout

Meeting minutes + document management for **Agrupamento 61 – Santa Maria dos
Olivais** (CNE). All user-facing strings are pt-PT.

## Architecture

A monorepo with a TypeScript front end and a standalone Python backend:

- **`apps/web`** — Next.js 15 (App Router) UI. No DB / business logic; talks to
  the API over `fetch` + Bearer token (`NEXT_PUBLIC_API_URL`). Deploys to
  **Vercel**.
- **`apps/api`** — **FastAPI** service (Python, managed with `uv`). All endpoints
  under `/api/*`; SQLAlchemy 2.0 (async) + Alembic against Supabase Postgres.
  Deploys as a Docker container on **Railway**. See [`apps/api/README.md`](apps/api/README.md).
- **`packages/*`** — shared TypeScript (`@qtscout/types`): domain types + FE
  runtime helpers. Consumed by the web via `transpilePackages`.

Both halves share one Supabase project (Postgres + Auth). npm workspaces +
Turborepo cover the TS side (`apps/web`, `packages/*`); the Python API is
standalone.

## Prerequisites

- [Node.js](https://nodejs.org/) 20+ (Vercel builds on 24.x)
- [uv](https://docs.astral.sh/uv/) (for the Python API)
- A [Supabase](https://supabase.com/) project

## Local development

Run the API and the web app together (the web's `NEXT_PUBLIC_API_URL` must point
at the API):

```bash
# 1. Backend (FastAPI) — from apps/api
cd apps/api
uv sync
cp .env.example .env          # fill in Supabase + DB values
uv run uvicorn app.main:app --reload --port 3001

# 2. Frontend (Next.js) — from the repo root, in another shell
npm install
# ensure apps/web/.env.local has NEXT_PUBLIC_API_URL=http://localhost:3001
npm run dev                   # web on http://localhost:3000
```

API health check: <http://localhost:3001/api/health>. OpenAPI docs:
<http://localhost:3001/docs>.

## Scripts (repo root)

| Command | Description |
|---|---|
| `npm run dev` | Start the web dev server (Turbopack, :3000) |
| `npm run build` | Production build (web + packages) |
| `npm run lint` | Lint |
| `npm run typecheck` | Type-check (fastest signal) |
| `npm run test:e2e` | Playwright e2e (drives the web UI → live API) |
| `npm run sync:categories` | Regenerate the FE ordem-categories from the API catalog |

Backend commands (from `apps/api`): `uv run pytest`, `uv run ruff check app`,
`uv run mypy app`, `uv run alembic …`. See [`apps/api/README.md`](apps/api/README.md).

## Environment variables

**Web** (`apps/web/.env.local`):

| Variable | Description |
|---|---|
| `NEXT_PUBLIC_API_URL` | Base URL of the FastAPI service (e.g. `http://localhost:3001`) |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase publishable key (client-side) |
| `SUPABASE_SECRET_KEY` | Supabase secret key (server-side; recovery flow + e2e) |

**API** (`apps/api/.env`): `DATABASE_URL`, `DIRECT_URL`, `SUPABASE_URL`,
`SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`, `WEB_ORIGIN`, optional
`MISTRAL_API_KEY` / `JWT_LOCAL_VERIFY`. See [`apps/api/.env.example`](apps/api/.env.example).

## Tech stack

- **Web:** Next.js 15 (App Router), React 19, TypeScript 5, Tailwind CSS 4,
  TipTap, SWR — on Vercel.
- **API:** FastAPI + Pydantic v2, SQLAlchemy 2.0 (async, asyncpg) + Alembic,
  `uv`; **Playwright** (Chromium) + Jinja2 for PDF, openpyxl for SIIE imports —
  Docker on Railway.
- **Database:** Supabase Postgres (the schema was originally created by Prisma;
  the API now uses SQLAlchemy + Alembic).
- **Auth:** Supabase Auth — cookies for the web shell, Bearer JWT for the API
  (verified offline via JWKS/ES256).

## Further reading

- [`CLAUDE.md`](CLAUDE.md) — operating notes / architecture overview.
- [`apps/api/README.md`](apps/api/README.md) and [`apps/api/DEPLOY.md`](apps/api/DEPLOY.md) — API setup + deploy.
- [`docs/`](docs/) — deeper dives (ordem categories, performance follow-ups, etc.).

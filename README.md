# QTScout

Meeting minutes + document management for **Agrupamento 61 – Santa Maria dos
Olivais** (CNE). All user-facing strings are pt-PT.

## Architecture

Everything runs on Cloudflare, on one hostname (`qtscout.cardosojcs.org`)
behind Cloudflare Access:

- **`apps/web`** — Next.js 16 (App Router) UI, a Worker via OpenNext. No DB /
  business logic; calls the API on same-origin `/api/*`, which the Worker entry
  (`apps/web/worker.ts`) forwards to the API Worker over a service binding.
- **`apps/api`** — **FastAPI** (Python, `uv`) running as a **Python Worker** on
  **D1**, with Browser Run for PDFs and Workers AI for the editor's AI rewrite.
  See [`apps/api/README.md`](apps/api/README.md).
- **`packages/*`** — shared TypeScript (`@qtscout/types`): domain types + FE
  runtime helpers. Consumed by the web via `transpilePackages`.

npm workspaces + Turborepo cover the TS side (`apps/web`, `packages/*`); the
Python API is standalone.

## Prerequisites

- [Node.js](https://nodejs.org/) 20+
- [uv](https://docs.astral.sh/uv/) (for the Python API)

## Local development

```bash
# 1. API — from apps/api (throwaway SQLite database, dev auth as <you>)
cd apps/api
uv sync
uv run playwright install chromium   # local PDF rendering (optional)
uv run python scripts/local_db.py local.db --seed you@example.pt
AUTH_MODE=dev AUTH_DEV_EMAIL=you@example.pt \
  uv run uvicorn app.main:app --app-dir src --reload --port 3001

# 2. Web — from the repo root, in another shell
npm install
API_ORIGIN=http://localhost:3001 npm run dev   # web on http://localhost:3000
```

API health check: <http://localhost:3001/api/health>. OpenAPI docs:
<http://localhost:3001/docs>. To run the API in the real Worker runtime instead,
see [`apps/api/README.md`](apps/api/README.md).

## Scripts (repo root)

| Command | Description |
|---|---|
| `npm run dev` | Start the web dev server (Turbopack, :3000) |
| `npm run build` | Production build (web + packages) |
| `npm run lint` | Lint |
| `npm run typecheck` | Type-check (fastest signal) |
| `npm run test:e2e` | Playwright e2e (web UI → local API on a throwaway SQLite DB) |
| `npm run sync:categories` | Regenerate the FE ordem-categories from the API catalog |

Backend commands (from `apps/api`): `uv run pytest`, `uv run ruff check src tests scripts`,
`uv run mypy src/app`, `uv run pywrangler dev|deploy`. See [`apps/api/README.md`](apps/api/README.md).

## Configuration

No secrets are needed for local development. In production, the API's
settings are `vars` in `apps/api/wrangler.jsonc` plus one secret
(`CF_API_TOKEN`); see [`apps/api/DEPLOY.md`](apps/api/DEPLOY.md).

## Tech stack

- **Web:** Next.js 16 (App Router), React 19, TypeScript 5, Tailwind CSS 4,
  TipTap, SWR — a Cloudflare Worker (OpenNext).
- **API:** FastAPI + Pydantic v2, SQLAlchemy 2.0, `uv` — a Cloudflare Python
  Worker. Jinja2 + Browser Run for PDFs, openpyxl for SIIE imports, Workers AI.
- **Database:** Cloudflare D1 (SQLite).
- **Auth:** Cloudflare Access (one-time PIN by email) in front of the whole
  hostname; the API verifies the Access JWT (JWKS/RS256).

## Further reading

- [`CLAUDE.md`](CLAUDE.md) — operating notes / architecture overview.
- [`apps/api/README.md`](apps/api/README.md) and [`apps/api/DEPLOY.md`](apps/api/DEPLOY.md) — API setup + deploy.
- [`docs/`](docs/) — deeper dives (ordem categories, performance follow-ups, etc.).

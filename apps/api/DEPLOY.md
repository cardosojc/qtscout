# QTScout API — deploy runbook

The API runs on **FastAPI Cloud** (`https://qtscout.fastapicloud.dev`). This
directory is linked to the app via `.fastapicloud/cloud.json` (git-ignored).
The web (Cloudflare Workers, `qtscout.cardosojcs.org`) proxies same-origin
`/api/*` to it — see `rewrites()` in `apps/web/next.config.ts` (`API_ORIGIN`).

PDF rendering is pure-Python (xhtml2pdf), so no browser or system libraries are
needed on the host.

## 1. Log in (once per machine)

```bash
cd apps/api
uv run fastapi cloud login
uv run fastapi cloud whoami
```

## 2. Environment variables

Manage them with `uv run fastapi cloud env {list,get,set,delete}`. The full list
with comments is in `.env.example`:

| Var | Value |
|-----|-------|
| `DATABASE_URL` / `DIRECT_URL` | Supabase pooler (app) / direct connection (Alembic) |
| `AUTH_MODE` | `access` (default; never `dev` here) |
| `ACCESS_TEAM_DOMAIN` | `snowy-hall-cc58.cloudflareaccess.com` |
| `ACCESS_AUD` | AUD tag of the Access application `qtscout` |
| `CF_ACCOUNT_ID` / `ACCESS_GROUP_ID` / `CF_API_TOKEN` | Access group management (user create/delete) |
| `MISTRAL_API_KEY` | AI rewrite |
| `WEB_ORIGIN` | CORS origins (only matters for direct cross-origin calls) |

The app refuses to start if `AUTH_MODE=access` is missing `ACCESS_TEAM_DOMAIN`
or `ACCESS_AUD`.

## 3. Deploy

```bash
cd apps/api
uv run fastapi cloud deploy
curl https://qtscout.fastapicloud.dev/api/health   # -> {"ok": true}
```

The API is reachable directly, but every route except `/api/health` requires a
valid Access JWT, so direct calls without one get `401`.

## 4. Database migrations

Alembic is baseline-stamped at `65d0b607c636` (the schema was created by
Prisma). For a schema change: edit a model →
`uv run alembic revision --autogenerate -m "…"` → `uv run alembic upgrade head`
(runs against `DIRECT_URL` from your local `.env`).

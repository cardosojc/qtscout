# QTScout API — deploy & cutover runbook

Cut over the backend from the Hono API (Vercel project `qtscout-api`) to this
FastAPI service on Render/Railway. The Next.js web app stays on Vercel; only
`NEXT_PUBLIC_API_URL` changes. **Keep the old Hono API running until step 7.**

## 0. Prerequisites

- Render or Railway account with access to this GitHub repo.
- The env values from `apps/web/.env.local` (mapping below).
- A Supabase **access token** for an ADMIN test user (for the parity harness):
  sign in to the web app, then DevTools → Application → the Supabase auth entry
  → copy `access_token`.

Env var mapping (Hono → FastAPI service):

| FastAPI service var          | Source (`apps/web/.env.local`)          |
|------------------------------|-----------------------------------------|
| `DATABASE_URL`               | `DATABASE_URL` (pooler)                 |
| `DIRECT_URL`                 | `DIRECT_URL` (direct)                   |
| `SUPABASE_URL`               | `NEXT_PUBLIC_SUPABASE_URL`              |
| `SUPABASE_PUBLISHABLE_KEY`   | `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`  |
| `SUPABASE_SECRET_KEY`        | `SUPABASE_SECRET_KEY`                   |
| `MISTRAL_API_KEY`            | `MISTRAL_API_KEY`                       |
| `WEB_ORIGIN`                 | the web origin(s), e.g. `https://qtscout.vercel.app` (comma-sep) |

## 1. Provision the service

- **Render**: New + → Blueprint → this repo (`render.yaml`). Fill the env vars.
- **Railway**: New service → Deploy from repo → set root directory `api/`
  (uses `api/Dockerfile`). Add the same env vars. `$PORT` is provided.

The image installs Chromium for PDF rendering (`playwright install --with-deps`).

## 2. Baseline-stamp Alembic (one-time, no DDL)

The 11 tables already exist (created by Prisma). Mark the baseline so future
migrations work without recreating anything. Run **once**, locally, against the
direct connection:

```bash
cd api
cp .env.example .env   # fill DIRECT_URL etc. (or reuse the existing api/.env)
uv run alembic stamp 65d0b607c636
```

## 3. Deploy + smoke test

Trigger the deploy. When live:

```bash
curl https://<api-host>/api/health        # -> {"ok": true}
open  https://<api-host>/docs              # OpenAPI UI
```

## 4. Parity check (Hono vs FastAPI)

With both APIs up and a token, diff responses per endpoint:

```bash
cd api
HONO_URL=https://qtscout-api.vercel.app \
FASTAPI_URL=https://<api-host> \
TOKEN="<supabase access token>" \
uv run python scripts/parity_check.py
```

Investigate any `DIFF`. Spot-check writes (create meeting/document/item,
sign/unsign, SIIE import, `POST /ordens-servico/generate`) and **download a PDF
from each backend** and compare visually (meeting CA, OFICIO/CIRCULAR, OS).

## 5. Repoint the web's types (optional, do before flipping)

Wire shapes are identical by design, so this is safe and de-risks cutover:

```bash
npm run gen:api-types --workspace @qtscout/web   # refresh from openapi/openapi.json
```

Repoint **type-only** imports in `apps/web` from `@qtscout/types/*` to
`@/lib/api-schemas` where they describe API responses. **Keep** runtime imports
(`ORDEM_CATEGORIES`, `DOCUMENT_TYPE_LABELS`, `scoutDisplayName`,
`validateItemData`, `defaultOrdemServicoData`/`parseOrdemServicoData`,
`@qtscout/core/ano-escutista`) on `packages/types` / `packages/core` — those
stay FE-side. Verify with `npm run typecheck`.

## 6. (Optional) single-source the OS catalog

Now safe since `packages/types` is becoming FE-only: extract the catalog to
`packages/ordem-categories.json`, have both `packages/types/ordem-item.ts` and
`api/app/core/ordem_categories.py` load it (copy the JSON into `api/` at build
time so it lands in the image), and keep the existing catalog-drift unit tests.

## 7. Flip the web → FastAPI

- Vercel (web project `qtscout`): set `NEXT_PUBLIC_API_URL` = `https://<api-host>`.
- Ensure the API's `WEB_ORIGIN` includes the web origin (CORS).
- Redeploy the web app. Run the Playwright e2e suite against the deployed pair.
- Watch logs; keep the Hono API up briefly as a rollback (just flip
  `NEXT_PUBLIC_API_URL` back).

## 8. Retire the Hono backend

Once stable:

- Delete `apps/api` (Hono), `packages/db`, `packages/auth`.
- Trim `packages/core` to **`ano-escutista`** only (keep — FE uses it); remove
  pdf-generator, ordem-*, siie-*, document-utils, assets.
- **Keep `packages/types`** (FE runtime helpers + types).
- Update root `package.json` workspaces, `turbo.json`, and remove the now-unused
  Vercel `qtscout-api` project.
- Update `CLAUDE.md` and `docs/architecture.md` to describe the FastAPI backend
  (`api/`), the new auth/PDF/contract flows, and this runbook.

# QTScout — Claude operating notes

Meeting minutes + document management for **Agrupamento 61 – Santa Maria dos
Olivais** (CNE). All user-facing strings are **pt-PT**. Never add emojis to UI
or files unless asked.

## Monorepo

npm workspaces + Turborepo for the TS side; the backend is a standalone
**FastAPI (Python)** service that the Next.js UI talks to over `fetch` + Bearer
token. (The backend was previously a Hono/TS API — fully rewritten in Python;
see `apps/api/DEPLOY.md` and the git history.)

- `apps/web` — Next.js 15 UI (no DB / business logic). Calls the API via
  `apiFetch()` (`apps/web/src/lib/api-client.ts`); base URL is
  `NEXT_PUBLIC_API_URL`.
- `apps/api/` — **FastAPI service** (Python, `uv`). All endpoints under `/api/*`.
  Deployed as a Docker container on **Railway** (web stays on Vercel).
- `packages/types` (`@qtscout/types`) — the only shared TS package: pure types
  **+ FE runtime helpers** (labels, the OS catalog, `scoutDisplayName`,
  validators, `ano-escutista`). No backend deps.

The web also consumes the generated API types: `apps/web/src/lib/api-types.ts`
(from `openapi/openapi.json` via `npm run gen:api-types`) + `api-schemas.ts`
aliases. Internal TS packages ship raw TS (no build); web consumes them via
`transpilePackages`.

## Stack

- **Web**: Next.js 15 App Router (Turbopack), React 19, TypeScript 5, TipTap,
  Tailwind 4, SWR. Unchanged by the migration; stays on Vercel.
- **API**: FastAPI + Pydantic v2, `uv`; SQLAlchemy 2.0 async (asyncpg) +
  Alembic; Supabase auth (access tokens verified offline via JWKS/ES256, with a
  `/auth/v1/user` fallback); **xhtml2pdf (pure-Python) + Jinja2** for PDF;
  **openpyxl** for SIIE xlsx; httpx → Mistral for AI rewrite. Tooling: ruff,
  mypy, pytest.
- Supabase Postgres (shared by both); `DATABASE_URL` (transaction pooler) +
  `DIRECT_URL` (Alembic).

### Commands

- **API** (from `apps/api/`): `uv run uvicorn app.main:app --reload --port 3001`
  (local dev), `uv run pytest`, `uv run ruff check app`, `uv run mypy app`.
  Export the contract: `uv run python scripts/export_openapi.py`.
- **Web** (root): `npm run dev` (web :3000 only now), `npm run build`,
  `npm run typecheck` (fastest signal), `npm run lint`, `npm run test:e2e`,
  `npm run gen:api-types` (regenerate FE types after the API contract changes).
- **Local full stack**: run the API (`uv run uvicorn …`) and point the web's
  `NEXT_PUBLIC_API_URL` at `http://localhost:3001`, or at the Railway URL.

## Auth

One identity (Supabase), two transports: cookies for the web shell, **Bearer
tokens** for the API.

- API: routes depend on `CurrentUser` / `AdminUser` (`apps/api/app/deps.py`).
  `current_user` extracts the Bearer token and verifies it **offline against
  Supabase's JWKS** (ES256; keys fetched once + cached, warmed at startup),
  falling back to `GET {SUPABASE_URL}/auth/v1/user` when `jwt_local_verify` is
  off or local verification fails (`apps/api/app/auth.py`). It then loads the
  `Profile` by id (`sub`) and returns `SessionUser {id, email, name, username,
  role}`. Offline verification can't see server-side revocation until the
  short-lived token expires — set `JWT_LOCAL_VERIFY=false` to force the API path.
  `AdminUser` adds the ADMIN check. Errors render as `{"error": ...}` to match
  the old API (exception handler in `app/main.py`).
- Client: `const { user, loading, signOut } = useAuth()` from
  `apps/web/src/components/providers/auth-provider.tsx`. All data calls go
  through `apiFetch()`, which attaches the Supabase access token as Bearer.
- **No authZ middleware** beyond the deps — handlers check `user.role` directly.
- Supabase service-role admin ops (user create/delete) go through
  `apps/api/app/supabase_admin.py` (GoTrue REST, `SUPABASE_SECRET_KEY`).
- Two endpoints stay in the web app (cookie/email-redirect recovery flow):
  `POST /api/auth/{forgot,reset}-password`.

## Database / SQLAlchemy + Alembic — read carefully

- Models: `apps/api/app/models/` (11 tables). Snake_case Python attrs map to the
  **exact camelCase Prisma column names** (e.g. `created_at` →
  `mapped_column("createdAt", …)`). PG enums bind to existing types with
  `create_type=False`. IDs use cuid (most) / uuid (`Profile`) factories.
- Engine: `apps/api/app/db.py` normalises the Prisma-style `DATABASE_URL` for asyncpg
  and **disables the prepared-statement cache** (`statement_cache_size=0`) —
  required because the app connects through the Supabase transaction pooler
  (pgbouncer). `pool_pre_ping` is **off** (its liveness round-trip cost ~100–200ms
  per request through the pooler — measured) with `pool_recycle=1800` as the
  staleness guard instead. `DIRECT_URL` is used by Alembic.
- **Migrations** (`apps/api/migrations/`): the schema already existed (Prisma), so
  Alembic is **baseline-stamped** at `65d0b607c636` (no DDL). New changes:
  edit a model → `uv run alembic revision --autogenerate -m "…"` →
  `uv run alembic upgrade head` (against `DIRECT_URL`).
- Response parity: `apps/api/app/schemas/base.py` — `ORMModel` emits **camelCase**
  keys; `PrismaDateTime` serialises datetimes as UTC `…000Z` (Prisma's
  `toISOString` format) so the web's `new Date()` parsing is unchanged.

## Feature flags

Defined in `apps/web/src/flags.ts` using `@flags-sdk/vercel`. Three flags gate the
document types: `oficio-enabled`, `circular-enabled`, `ordem-servico-enabled`.
All default to `true`. Discovered at `/.well-known/vercel/flags`. The OS flag
also controls visibility of the `/ordem-servico` sidebar nav entry.

## Document model

Single `Document` table for OFICIO / CIRCULAR / ORDEM_SERVICO. Numbering via
`DocumentSequence` (year=0 sentinel for OS, real year for others); starting
numbers configurable in `DocumentSettings`. Identifier format:
`OF-001/2026`, `CI-001/2026`, `OS-001` (no year for OS — global sequence). See
`apps/api/app/core/document_utils.py` and `apps/api/app/routers/documents.py`.

Signing: `Profile.signature` is a base64 PNG data URL; `Document.signedById`
+ `signedAt`. Sign/unsign: `POST/DELETE /api/documents/{id}/sign`.
Render: "Saudações Escutistas" + image (or handwritten Caveat fallback) +
name + roles in parentheses.

## Ordem de Serviço pipeline (the non-obvious bit)

Two phases: **logging** and **assembly**.

**Logging.** Section + group leaders log individual `OrdemItem` rows. Each item:
- `category` (string key, e.g. `ATIVIDADE`, `NOMEACAO_DIRIGENTE`) — validated
  against the catalog.
- `section` (`OrdemSection?`) — null = Agrupamento-level. Set = section item.
- `data` (JSON) — shape depends on category (`ItemShape` + `validate_item_data`).
- `externalId?` — used by SIIE activity imports to upsert.

The **catalog is single-sourced** from `apps/api/app/core/ordem_categories.json`:
the Python backend loads it; the web's typed copy
(`packages/types/src/ordem-categories.generated.ts`) is generated from it by
`npm run sync:categories` (CI guards drift with `:check`). To change categories,
edit the JSON and run `npm run sync:categories`. The Python validator
(`ordem_categories.py`) and permissions (`ordem_permissions.py`) live alongside.

**Assembly.** `POST /api/ordens-servico/generate` with `{ from, to }`
(`apps/api/app/routers/ordens_servico.py`):
1. Loads pending items (`includedInOsId IS NULL`) in the range.
2. Resolves scout/profile refs via `apps/api/app/core/ordem_resolver.py` (batched).
3. `assemble_ordem_servico()` (`apps/api/app/core/ordem_assembler.py`) folds items
   into `OrdemServicoData` JSON (`apps/api/app/core/ordem_servico.py`). Snapshot is
   stored on `Document.content` so later item edits don't change the doc.
4. **Auto-includes admissions** (`Scout.joinedAt` in period, has section) and
   **noites de campo milestones** (`ScoutNightsBadge.awardedAt` in period,
   grouped by `(section, count)`). Neither is a manual category.
5. Transactional: bumps `DocumentSequence`, creates the `Document`
   (`with_for_update` on the sequence), marks source items `includedInOsId`.
   Items already in an OS are immutable (item PATCH/DELETE → 409).

PDF for OS reads the snapshotted JSON: `apps/api/app/pdf/os_content.py`.

## PDF generation

`apps/api/app/pdf/`: `render.py` runs **xhtml2pdf (`pisa`)** — pure-Python, no
browser — synchronously off the event loop (`run_in_threadpool`); a
`link_callback` resolves local `@font-face`/asset paths while passing `data:`
URIs through. `html_builders.py` builds the meeting body (incl. the CA-only
signature page) and document body/signature; `os_content.py` renders the OS
snapshot. Page shells + CSS are Jinja2 templates (`templates/meeting.html.j2`,
`document.html.j2`) using xhtml2pdf's subset — **table-based layout (no
flexbox/grid)**, static `@frame` header/footer (repeating, with page numbers via
`<pdf:pagenumber>`), and local fonts in `pdf/fonts/` (Lato, Caveat); header
images in `pdf/assets/`. Endpoints: `GET /api/{documents,meetings}/{id}/pdf?download=`.
No browser or system libs are needed, so PDF rendering runs in-process on **any**
host (Railway/Docker **and** FastAPI Cloud).

## Scouts (members)

`Scout` is the canonical member record (`firstName + lastName`,
`numeroAssociado`, `dateOfBirth`, optional `section`, plus identification +
address + parent + Encarregado de Educação fields). Section is optional so
leaders/honorários can be tracked alongside section members.

`Scout.profileId` optionally links a `Profile` (leaders with an account). SIIE
import sets it on **create** when email matches an existing Profile — never
overwrites a manual link.

Noites de campo are milestones in `ScoutNightsBadge` (unique `(scoutId, count)`;
`NIGHTS_BADGE_COUNTS = [25, 50, 75, 100, 200]`). The Scout detail page has a
date-per-milestone editor (ADMIN writes via `PUT /api/scouts/{id}/nights-badges`).
`Scout.noitesCampoInicial` is the manual snapshot as of
`NOITES_CAMPO_SNAPSHOT_DATE` (2025-10-01). `computeNoitesCampoAtual`
(`packages/types/src/scout.ts`, FE) echoes the snapshot for now.

Item forms with `MEMBER_REF`/`NOITES_REF`/`SCOUT_OR_PROFILE_REF` pick from
`/api/scouts?section=…`. Leader picker calls `/api/profiles/leaders`.

## SIIE imports (ADMIN-only multipart `file`)

- `POST /api/scouts/import` — `export.xlsx`. `nin → numeroAssociado` (upsert
  key), split `nome`, `section` from `Categoria` last letter (L/E/P/C → section,
  else null). Logic: `apps/api/app/core/siie_import.py`.
- `POST /api/ordem-items/import-activities` — `export (1).xlsx`.
  `idatividade → externalId`, one `ATIVIDADE` per row; `section` from a
  single-letter `Sigla Seccao`. Items already in an OS are skipped.
  Logic: `apps/api/app/core/siie_atividades_import.py`.

Both: read via openpyxl → `map_row`/`map_activity_row` → pre-fetch existing +
profile emails → **per-row upsert** with per-row commit + try/except.

## Where things live

- `apps/web/src/app/(app)/` — authenticated pages (`meetings/`, `documents/`,
  `ordem-servico/`, `membros/`, `profile/`, `settings/`, `search/`).
- `apps/web/src/app/api/` — ONLY `auth/{forgot,reset}-password` (recovery flow).
- `apps/web/src/lib/` — `api-client` (apiFetch), `api-hooks` (SWR),
  `api-types`/`api-schemas` (generated), `supabase/`, `flags`.
- `apps/api/app/routers/` — one router per domain (13). `apps/api/app/{models,schemas}/`,
  `apps/api/app/core/` (ordem_*, siie_*, document_utils, scout_utils, leader_roles),
  `apps/api/app/pdf/`, `apps/api/app/{deps,auth,supabase_admin,db,config,main}.py`.
- `apps/api/migrations/` — Alembic. `apps/api/scripts/` — `parity_check.py`,
  `export_openapi.py`. `apps/api/DEPLOY.md` — the cutover runbook.
- `packages/types/src/` — domain types + FE runtime helpers.
- `openapi/openapi.json` — generated API contract.

## Deeper reading

- `apps/api/README.md` — API setup, layout, deploy. `apps/api/DEPLOY.md` — full cutover
  runbook (provision, env mapping, Alembic stamp, parity, flip, retirement).
- `docs/architecture.md` — deeper architecture dive (kept current with the
  FastAPI backend). When it drifts from the code, the code wins.
- `docs/ordem-categories.md` — category table; `npm run docs:sync` regenerates
  it from the FE catalog (`packages/types/src/ordem-item.ts`).

## Gotchas

- API: FastAPI path/query params via function signature; raw bodies validated
  manually for pt-PT 400 messages (`Annotated[dict, Body()]`). Web page dynamic
  params are Promises: `{ params }: { params: Promise<{ id: string }> }`.
- Web data fetching goes through `apiFetch()` (Bearer) / SWR hooks, never
  relative `fetch('/api/...')` — the routes live in the FastAPI service.
- API auth is Bearer-only via `CurrentUser`/`AdminUser`.
- `useAuth()`'s `user.role` is `'ADMIN' | 'LEADER' | 'MEMBER'`, separate from
  `Profile.roles[]` (human-readable leader role labels).
- The OS **catalog is duplicated** (Python BE + TS FE) — keep both in sync.
- E2E tests in `e2e/` use Playwright with a shared `storageState`; test user is
  `e2e-test@qtscout.test`. They drive the web UI → the live FastAPI backend.
- Full-text search on Meetings uses a Portuguese `tsvector` column + GIN index
  (raw SQL in `apps/api/app/routers/search.py`).
- Old OS documents with the legacy JSON shape still render — the OS body
  renderer tolerates partial/missing buckets.

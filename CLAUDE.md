# QTScout — Claude operating notes

Meeting minutes + document management for **Agrupamento 61 – Santa Maria dos
Olivais** (CNE). All user-facing strings are **pt-PT**. Never add emojis to UI
or files unless asked.

## Monorepo

npm workspaces + Turborepo for the TS side; the backend is a **FastAPI (Python)**
app running as a **Cloudflare Python Worker on D1**. Everything runs on
Cloudflare, on one hostname (`qtscout.cardosojcs.org`) behind Cloudflare Access.
(The backend was previously a Hono/TS API, then FastAPI on Supabase Postgres;
see the git history.)

- `apps/web` — Next.js 16 UI (no DB / business logic), a Cloudflare Worker via
  OpenNext (`qtscout-web`). Calls the API via `apiFetch()`
  (`apps/web/src/lib/api-client.ts`) on same-origin `/api/*`; the Worker entry
  (`apps/web/worker.ts`) forwards those to the API Worker over a **service
  binding** (`API`). `next dev` proxies them to `API_ORIGIN` instead.
- `apps/api/` — **FastAPI app** (Python, `uv`), code in `apps/api/src/app/`,
  deployed as the Python Worker `qtscout-api` (`src/entry.py`, `wrangler.jsonc`;
  no public route). All endpoints under `/api/*`. Runbook: `apps/api/DEPLOY.md`.
- `packages/types` (`@qtscout/types`) — the only shared TS package: pure types
  **+ FE runtime helpers** (labels, the OS catalog, `scoutDisplayName`,
  validators, `ano-escutista`). No backend deps.

The web also consumes the generated API types: `apps/web/src/lib/api-types.ts`
(from `openapi/openapi.json` via `npm run gen:api-types`) + `api-schemas.ts`
aliases. Internal TS packages ship raw TS (no build); web consumes them via
`transpilePackages`.

## Stack

- **Web**: Next.js 16 App Router (Turbopack), React 19, TypeScript 5, TipTap,
  Tailwind 4, SWR; OpenNext for Cloudflare.
- **API**: FastAPI + Pydantic v2, `uv`; sync SQLAlchemy 2.0 on **D1** (local:
  SQLite); **Browser Run** (headless Chromium) for PDFs; **openpyxl** for SIIE
  xlsx; **Workers AI** for the AI rewrite. Tooling: ruff, mypy, pytest,
  pywrangler (`workers-py`).
- Auth: **Cloudflare Access** (see below).

### Commands

- **API** (from `apps/api/`): `uv run pytest`, `uv run ruff check src tests scripts`,
  `uv run mypy src/app`. Local server, either:
  - `uv run python scripts/local_db.py local.db --seed <you>` then
    `AUTH_MODE=dev AUTH_DEV_EMAIL=<you> uv run uvicorn app.main:app --app-dir src --reload --port 3001`
    (CPython + SQLite; PDFs via Playwright's Chromium), or
  - `uv run pywrangler dev` (the real Worker runtime + a local D1; `.dev.vars`
    holds `AUTH_MODE=dev`; schema: `npx wrangler d1 migrations apply qtscout --local`).
  Export the contract: `uv run python scripts/export_openapi.py`.
- **Web** (root): `npm run dev` (web :3000), `npm run build`,
  `npm run typecheck` (fastest signal), `npm run lint`, `npm run test:e2e`,
  `npm run gen:api-types` (regenerate FE types after the API contract changes).
- **Local full stack**: the API as above, plus the web with
  `API_ORIGIN=http://localhost:3001` (or `:8787` for `pywrangler dev`).

## Auth

**Cloudflare Access** (one-time PIN by email; no passwords). Web and API share
one hostname behind an Access application; the web proxies same-origin
`/api/*` to the API (`rewrites()` in `apps/web/next.config.ts`, target
`API_ORIGIN`), so the browser's Access cookie/JWT reaches the API and there is
no CORS or client-side token.

- API: routes depend on `CurrentUser` / `AdminUser` (`apps/api/src/app/deps.py`).
  `current_user` takes the `Cf-Access-Jwt-Assertion` header (or the
  `CF_Authorization` cookie), verifies it **offline against the Access team
  JWKS** (RS256 + application `ACCESS_AUD` + issuer; `apps/api/src/app/auth.py`),
  then loads the `Profile` **by email** (401 no/invalid token, 403 no profile)
  and returns `SessionUser {id, email, name, username, role}`. `AdminUser` adds
  the ADMIN check. Errors render as `{"error": ...}` (handler in `app/main.py`).
- `AUTH_MODE=dev` + `AUTH_DEV_EMAIL` skips Access and treats every request as
  that email — local dev and Playwright only (no Access on localhost). Never in
  production; settings validation requires the Access vars in `access` mode.
- Who may sign in = the Access group `qtscout-users` (email include-list).
  ADMIN user create/delete (`POST/DELETE /api/users`) adds/removes the email via
  the Cloudflare API (`apps/api/src/app/access_admin.py`; `CF_API_TOKEN`,
  `CF_ACCOUNT_ID`, `ACCESS_GROUP_ID`). There is no self-registration.
- Client: `const { user, loading, denied, signOut } = useAuth()` from
  `apps/web/src/components/providers/auth-provider.tsx`; `signOut` goes to
  `/cdn-cgi/access/logout`. `apiFetch()` is a same-origin fetch that reloads the
  page when an expired Access session redirects an API call to the login.
- **No authZ middleware** beyond the deps — handlers check `user.role` directly.

## Database / D1 + SQLAlchemy — read carefully

- **D1** (SQLite) database `qtscout`, binding `DB`. There is no Python driver:
  `apps/api/src/app/db.py` has a small **DB-API shim** that runs each statement
  through the binding and blocks on it with Pyodide's `run_sync`, so the ORM is
  **synchronous** — handlers stay `async def` and call `session.*` without
  `await`. Locally the same code uses stdlib `sqlite3` (`DATABASE_URL`).
- **No interactive transactions** on D1: every statement autocommits, and
  `commit()`/`rollback()` are no-ops there. Multi-write operations that must be
  atomic use `atomic_batch()` (one D1 batch). D1 also caps a statement at 100
  bound parameters — chunk large `IN (...)` lists.
- Models: `apps/api/src/app/models/` (11 tables). Snake_case Python attrs map to
  the **exact camelCase column names** (e.g. `created_at` →
  `mapped_column("createdAt", …)`). Enums are stored as strings (`str_enum`),
  JSON columns as text, timestamps as **naive UTC** text set app-side
  (`utcnow`). IDs: cuid (`ids.cuid_id`, inline cuid v1) / uuid (`Profile`).
- **Schema / migrations**: `apps/api/d1/migrations/*.sql`. `0001_init.sql` is
  generated from the models (`scripts/gen_schema.py`). For a change: edit the
  model, add `d1/migrations/000N_….sql` (`npx wrangler d1 migrations create
  qtscout <name>`), apply with `npx wrangler d1 migrations apply qtscout
  --remote` (and `--local`). Tests and `scripts/local_db.py` apply the same files.
- Raw SQL binds datetimes in the stored text format (`db_timestamp`).
- Response parity: `apps/api/src/app/schemas/base.py` — `ORMModel` emits
  **camelCase** keys; `PrismaDateTime` serialises datetimes as UTC `…000Z`
  (Prisma's `toISOString` format) so the web's `new Date()` parsing is unchanged.

## Feature flags

Read from the Cloudflare Flagship binding (`FLAGS`) in
`apps/web/src/lib/flags.ts`. Three flags gate the document types:
`oficio-enabled`, `circular-enabled`, `ordem-servico-enabled`. All default to
`true` (fail open). The OS flag also controls visibility of the `/ordem-servico`
sidebar nav entry.

## Document model

Single `Document` table for OFICIO / CIRCULAR / ORDEM_SERVICO. Numbering via
`DocumentSequence` (year=0 sentinel for OS, real year for others); starting
numbers configurable in `DocumentSettings`. Identifier format:
`OF-001/2026`, `CI-001/2026`, `OS-001` (no year for OS — global sequence). See
`apps/api/src/app/core/document_utils.py` and `apps/api/src/app/routers/documents.py`.

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

The **catalog is single-sourced** from `apps/api/src/app/core/ordem_categories.json`:
the Python backend loads it; the web's typed copy
(`packages/types/src/ordem-categories.generated.ts`) is generated from it by
`npm run sync:categories` (CI guards drift with `:check`). To change categories,
edit the JSON and run `npm run sync:categories`. The Python validator
(`ordem_categories.py`) and permissions (`ordem_permissions.py`) live alongside.

**Assembly.** `POST /api/ordens-servico/generate` with `{ from, to }`
(`apps/api/src/app/routers/ordens_servico.py`):
1. Loads pending items (`includedInOsId IS NULL`) in the range.
2. Resolves scout/profile refs via `apps/api/src/app/core/ordem_resolver.py` (batched).
3. `assemble_ordem_servico()` (`apps/api/src/app/core/ordem_assembler.py`) folds items
   into `OrdemServicoData` JSON (`apps/api/src/app/core/ordem_servico.py`). Snapshot is
   stored on `Document.content` so later item edits don't change the doc.
4. **Auto-includes admissions** (`Scout.joinedAt` in period, has section) and
   **noites de campo milestones** (`ScoutNightsBadge.awardedAt` in period,
   grouped by `(section, count)`). Neither is a manual category.
5. Atomic (one D1 batch, `create_numbered_document` in `document_utils.py`):
   bumps `DocumentSequence`, creates the `Document`, marks source items
   `includedInOsId`. Ofício/circular numbering uses the same helper.
   Items already in an OS are immutable (item PATCH/DELETE → 409).

PDF for OS reads the snapshotted JSON: `apps/api/src/app/pdf/os_content.py`.

## PDF generation

`apps/api/src/app/pdf/`: `render.py` sends the page HTML to **Browser Run**
(`BROWSER` binding, `quickAction("pdf")`, headless Chromium). The repeating
header/footer are Chromium print templates (inline styles, data-URI logos, page
numbers via `pageNumber`/`totalPages`). Page fonts (Lato, Caveat) are
Latin-subset WOFF2 in `pdf/fonts/`, **inlined as data URIs** — Browser Run can't
fetch from our hostname (Access). `html_builders.py` builds the meeting body
(incl. the CA-only signature page) and document body/signature; `os_content.py`
renders the OS snapshot. Page shells + CSS are Jinja2 templates
(`templates/meeting.html.j2`, `document.html.j2`). Endpoints:
`GET /api/{documents,meetings}/{id}/pdf?download=`. Browser Run rate-limits
quick actions (Workers Free: 1 per 10 s); a 429 is retried once after
`Retry-After`, then answered with 503 + a pt-PT message. Outside the Worker the
same HTML/options render through Playwright's Chromium (dev dependency).

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
  else null). Logic: `apps/api/src/app/core/siie_import.py`.
- `POST /api/ordem-items/import-activities` — `export (1).xlsx`.
  `idatividade → externalId`, one `ATIVIDADE` per row; `section` from a
  single-letter `Sigla Seccao`. Items already in an OS are skipped.
  Logic: `apps/api/src/app/core/siie_atividades_import.py`.

Both: read via openpyxl → `map_row`/`map_activity_row` → pre-fetch existing +
profile emails → **per-row upsert** with per-row commit + try/except.

## Where things live

- `apps/web/src/app/(app)/` — authenticated pages (`meetings/`, `documents/`,
  `ordem-servico/`, `membros/`, `profile/`, `settings/`, `search/`).
- `apps/web/src/lib/` — `api-client` (apiFetch), `api-hooks` (SWR),
  `api-types`/`api-schemas` (generated), `flags` (Flagship). `apps/web/worker.ts` — Worker
  entry (`/api/*` → API service binding).
- `apps/api/src/app/routers/` — one router per domain (13). `apps/api/src/app/{models,schemas}/`,
  `apps/api/src/app/core/` (ordem_*, siie_*, document_utils, meeting_search,
  scout_utils, leader_roles), `apps/api/src/app/pdf/`,
  `apps/api/src/app/{deps,auth,access_admin,db,runtime,config,main}.py`.
  `apps/api/src/entry.py` — Worker entrypoint. `runtime.py` holds everything
  that differs between the Worker and local CPython (bindings, HTTP).
- `apps/api/d1/migrations/` — D1 schema. `apps/api/scripts/` — `gen_schema.py`,
  `local_db.py`, `export_openapi.py`, `pg_to_d1.py` (one-off data copy).
- `packages/types/src/` — domain types + FE runtime helpers.
- `openapi/openapi.json` — generated API contract.

## Deeper reading

- `apps/api/README.md` — API setup and layout. `apps/api/DEPLOY.md` — deploy
  runbook (D1, secrets, deploy order, migrations).
- `docs/architecture.md` — deeper architecture dive (kept current with the
  FastAPI backend). When it drifts from the code, the code wins.
- `docs/ordem-categories.md` — category table; `npm run docs:sync` regenerates
  it from the FE catalog (`packages/types/src/ordem-item.ts`).

## Gotchas

- API: FastAPI path/query params via function signature; raw bodies validated
  manually for pt-PT 400 messages (`Annotated[dict, Body()]`). Web page dynamic
  params are Promises: `{ params }: { params: Promise<{ id: string }> }`.
- Web data fetching goes through `apiFetch()` / SWR hooks (same-origin
  `/api/...`, proxied to the FastAPI service — no Next route handlers).
- API auth is the Access JWT via `CurrentUser`/`AdminUser`.
- `useAuth()`'s `user.role` is `'ADMIN' | 'LEADER' | 'MEMBER'`, separate from
  `Profile.roles[]` (human-readable leader role labels).
- The OS **catalog is duplicated** (Python BE + TS FE) — keep both in sync.
- E2E tests in `e2e/` use Playwright; the API runs under uvicorn with
  `AUTH_MODE=dev` as `e2e-test@qtscout.test` on a **throwaway SQLite database**
  (`apps/api/e2e.db`, recreated and seeded each run) — never real data.
- Full-text search on meetings: FTS5 table `meeting_search`
  (`apps/api/src/app/core/meeting_search.py`), kept current by the meetings
  router (`reindex_meeting`/`unindex_meeting`); accent-insensitive, prefix terms,
  no Portuguese stemming. Raw SQL in `apps/api/src/app/routers/search.py`.
- Python Worker: keep heavy imports at module top level (they land in the
  deploy-time memory snapshot), never read settings or bindings at import time,
  and take randomness at call time (snapshot state is shared by every isolate).
  Non-Python files the app reads must match the `rules` globs in
  `apps/api/wrangler.jsonc`.
- Old OS documents with the legacy JSON shape still render — the OS body
  renderer tolerates partial/missing buckets.

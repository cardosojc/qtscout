# Architecture

Deeper notes for QTScout. Pair this with `CLAUDE.md` (operating notes / quick
reference). When something here drifts from the code, the code wins — update
this file or delete the stale section.

The backend was rewritten from a Hono/TypeScript API into **FastAPI (Python)**
(`apps/api/`). The Next.js web app (`apps/web`) is unchanged — it talks to the API
over `fetch` + Bearer token. See `apps/api/README.md` and `apps/api/DEPLOY.md`.

## Monorepo layout

npm workspaces + Turborepo for the TS side; the backend is a self-contained
Python service with its own tooling (`uv`).

```
apps/
├── web/                          # Next.js 15 UI (no business logic / DB)
│   ├── src/app/(app)/            # Authenticated, sidebar-shell pages
│   │   ├── meetings/ documents/ ordem-servico/ membros/ profile/ settings/ search/
│   ├── src/app/api/              # ONLY auth recovery flows (Supabase cookie/redirect)
│   ├── src/components/           # ordem-servico, membros, documents, editor, providers, ui
│   ├── src/lib/                  # api-client (apiFetch), api-hooks (SWR),
│   │                             #   api-types/api-schemas (generated), supabase/
│   └── src/flags.ts              # Vercel flags (UI visibility + /documents gating)
└── api/                          # FastAPI service — the backend (Docker on Railway)
    ├── pyproject.toml  uv.lock  Dockerfile
    ├── app/
    │   ├── main.py config.py db.py deps.py auth.py supabase_admin.py
    │   ├── routers/  models/  schemas/   # 13 routers · 11 models · Pydantic schemas
    │   ├── core/                 # ordem_*, siie_*, document_utils, ordem_categories(.json)
    │   └── pdf/                  # render.py (Playwright) + html_builders + templates + assets
    ├── migrations/               # Alembic (baseline-stamped)
    └── scripts/                  # parity_check.py, export_openapi.py

packages/
└── types/   # @qtscout/types — the only shared TS package: types + FE runtime
              #   helpers (labels, scoutDisplayName, ano-escutista) + the OS catalog
              #   (ordem-categories.generated.ts ← apps/api/.../ordem_categories.json)

openapi/openapi.json              # generated API contract (FE typegen source)
```

Internal TS packages ship **raw TypeScript** (no build), consumed by Next via
`transpilePackages`. The web depends only on `@qtscout/types` and the generated
`api-types`/`api-schemas`.

## Domain model

Unchanged by the migration — same 11 tables (now SQLAlchemy models in
`apps/api/app/models/`, mapping the existing camelCase Prisma columns).

```
Profile (Supabase Auth ↔ profiles)
  │   role: ADMIN | LEADER | MEMBER             # coarse system permission
  │   roles: string[]                           # human-readable functions
  │   section: OrdemSection?                    # only meaningful with section-level roles
  │   signature: string?                        # base64 PNG data URL
  ├──< Meeting (createdBy)  ├──< Document (createdBy / signedBy)
  ├──< OrdemItem (createdBy)  └──< Scout (profileId, optional 1:1)

Scout (scouts)                                   # member, may or may not be a leader
  │   numeroAssociado: string? @unique          # NIN, SIIE upsert key
  │   firstName/lastName, dateOfBirth, joinedAt
  │   section: OrdemSection?                    # null = leader / unassigned
  │   profileId?                                # set when this scout is also a leader
  ├──< ScoutLeader                              # responsible leaders (UI not yet built)
  └──< ScoutNightsBadge                         # milestone per scout (25/50/75/100/200)

Meeting (meetings)
  │   type: CA | RD (via MeetingType)           identifier: "{TYPE}-YYYYMMDD"
  │   agenda: Json (items, attendees, chefe, secretário)
  │   contentTsvector                           # GIN-indexed pt full-text search
  └──< MeetingAttendee (profileId)

Document (documents)
  │   type: OFICIO | CIRCULAR | ORDEM_SERVICO
  │   number: Int (via DocumentSequence; year=0 sentinel for OS), year: Int? (null for OS)
  │   content: string (HTML for OF/CI, JSON snapshot for OS); signedBy/signedAt
  └──< OrdemItem (sourceItems via includedInOsId)

OrdemItem (ordem_items)
      externalId? @unique (SIIE upsert key); category (ORDEM_CATEGORIES catalog)
      section: OrdemSection?; date; data: Json (shape per category.shape)
      includedInOsId? → Document.id            # set on OS generation; locks the item
```

## Auth flow

Single identity (Supabase Auth), two transports — cookies for the web shell,
Bearer tokens for the API.

1. User signs in via Supabase (email/password). `@supabase/ssr` stores the
   session in cookies; `apps/web/src/middleware.ts` refreshes it on navigation.
2. **Web → API.** `apiFetch()` reads the access token via
   `supabase.auth.getSession()` and sends `Authorization: Bearer <jwt>` to
   `NEXT_PUBLIC_API_URL`. `useAuth()` hydrates the user via `/api/auth/profile`.
3. **API auth** (`apps/api/app/deps.py`, `auth.py`): `current_user` extracts the
   Bearer token and verifies it **offline against Supabase's JWKS** (ES256; keys
   cached, warmed at startup), falling back to `GET {SUPABASE_URL}/auth/v1/user`
   (httpx) when `jwt_local_verify` is off or local verification fails. It then
   loads the `Profile` by Supabase user id (`sub`) and returns
   `SessionUser {id, email, name, username, role}`. `AdminUser` adds the ADMIN
   check. Routes depend on `CurrentUser` / `AdminUser`. Offline verification
   can't observe server-side revocation until the short-lived token expires —
   set `JWT_LOCAL_VERIFY=false` to force the network path.
4. **Other clients** authenticate against Supabase (e.g. password grant) and
   send the `access_token` as Bearer — identical server path.

No per-route authZ beyond the deps; handlers check `user.role` directly.
Service-role admin ops (register / delete user) go through
`apps/api/app/supabase_admin.py` (GoTrue REST, `SUPABASE_SECRET_KEY`). Two endpoints
stay in the web app (Supabase cookie/email-redirect recovery):
`POST /api/auth/{forgot,reset}-password`. Errors render as `{"error": …}` (an
exception handler in `app/main.py`) to match the old API.

## Ordem de Serviço pipeline

The OS feature has the most moving parts. Two phases.

### Phase 1: logging items

Leaders log individual `OrdemItem`s via `/ordem-servico` as events happen.

```
User picks category (filtered by permissions)
  └─> ItemForm renders inputs based on category.shape
        STRING/TEXT · ATIVIDADE · NOMEACAO · NOITES · MEMBER_REF ·
        NOITES_REF · PROFILE_REF · SCOUT_OR_PROFILE_REF
  └─> POST /api/ordem-items   (apps/api/app/routers/ordem_items.py)
        ├─ validate_item_data(shape, data)      # app/core/ordem_categories.py
        ├─ can_manage_item(profile, category, section)  # app/core/ordem_permissions.py
        ├─ _validate_refs(scoutId/profileId exists; scout.section matches)
        └─ INSERT
```

The catalog is **single-sourced** from `apps/api/app/core/ordem_categories.json`: the
Python backend loads it; the web's typed copy
(`packages/types/src/ordem-categories.generated.ts`) is generated from it by
`npm run sync:categories` (CI guards drift with `:check`).

Permissions matrix:

| Category scope | ADMIN | Group-level role | Section-level role (own section) |
|---|---|---|---|
| GROUP | yes | yes | no |
| SECTION | yes | no | yes |
| BOTH (section=null) | yes | yes | no |
| BOTH (section set) | yes | yes (any section) | yes (only their own) |

Group-level roles: Chefe de Agrupamento (+ Adjunto), Secretário, Tesoureiro,
Assistente. Section-level: Chefe de Unidade (+ Adjunto), Instrutor — all require
`Profile.section`. (`GROUP_ROLES` / `SECTION_ROLES` in `ordem_permissions.py`.)

### Phase 2: assembly into a Document

`POST /api/ordens-servico/generate { from, to }` (ADMIN; `ordens_servico.py`):

```
1. Load OrdemItems  : date in [from,to] AND includedInOsId IS NULL
2. Load Scouts      : joinedAt in [from,to] AND section IS NOT NULL   (admissions)
3. Load NightsBadge : awardedAt in [from,to] AND scout.section NOT NULL
4. resolve_refs(items)            # one query for scouts, one for profiles
5. assemble_ordem_servico(...)    # fold each item into its OrdemServicoData bucket
                                  #   (app/core/ordem_assembler.py + ordem_servico.py);
                                  #   snapshot holds resolved names, not refs
6. Auto-include admissions  → efetivo.admissao[section]
7. Auto-include noites      → group badges by (section,count) → noitesCampo[section]
8. Transaction: bump DocumentSequence (with_for_update) → Document.create
   (content = JSON) → mark source items includedInOsId
9. Return { …document, identifier, itemCount, autoAdmissions, autoNightsBadges }
```

The snapshot is immutable thereafter. Items already `includedInOsId` return 409
from PATCH/DELETE. The OS PDF reads only `Document.content`.

## PDF rendering

`apps/api/app/pdf/` — `render.py` launches Playwright (Chromium) and runs
`page.pdf()` (A4; 1/2/2.5/2 cm margins; footer; `print_background`). The Docker
image installs Chromium (`playwright install --with-deps chromium`).

- `html_builders.py` — meeting body (incl. the CA-only signature page) and the
  document body/signature; `format_date_pt` for pt-PT dates.
- `os_content.py` — renders the `OrdemServicoData` snapshot into the OS body.
- `templates/{meeting,document}.html.j2` — Jinja2 page shells holding the CSS
  (copied verbatim from the old generator for visual fidelity); `assets/` holds
  the base64-embedded header logos. Fonts: Lato + Caveat (handwritten fallback).

Endpoints: `GET /api/{documents,meetings}/{id}/pdf?download=`. Signature block:
"Saudações Escutistas," → signature image (or Caveat name) → "Name (Role 1, …)".

## SIIE imports

Two ADMIN-only multipart endpoints, same shape:

```
POST /api/scouts/import                 (members; app/core/siie_import.py)
POST /api/ordem-items/import-activities (activities; siie_atividades_import.py)

For each: read (openpyxl) → map per row → pre-fetch → per-row upsert
  1. load_workbook → rows as dicts keyed by header
  2. map_row / map_activity_row (pure): field mapping, section from CNE category
     letter / Sigla Seccao, date parsing (DD/MM/YYYY + Excel serial)
  3. ONE pre-fetch (existing by NIN / externalId); scouts also pre-fetch profile
     emails for leader linking
  4. per-row upsert with per-row commit + try/except (granular error summary)
  5. Activities: rows already in an OS are skipped. Scouts: profile link applied
     only on create (preserves manual edits).
```

Section mapping — members: last letter of `Categoria`
(`L→ALCATEIA, E→EXPEDICAO, P→COMUNIDADE, C→CLA`, else null = leader).
Activities: a single-letter `Sigla Seccao` → its section; else null (Agrupamento).

## Database workflow (SQLAlchemy + Alembic)

- Models in `apps/api/app/models/` map the existing tables — snake_case Python attrs
  to **exact camelCase columns** (`mapped_column("createdAt", …)`); PG enums bound
  with `create_type=False`; cuid/uuid id factories.
- `apps/api/app/db.py` normalises `DATABASE_URL` for asyncpg and disables the
  prepared-statement cache (`statement_cache_size=0`) — required for the Supabase
  transaction pooler (pgbouncer). `pool_pre_ping` is **off** (its per-checkout
  liveness round-trip cost ~100–200ms through the pooler — measured) with
  `pool_recycle=1800` as the staleness guard. Alembic uses `DIRECT_URL`.
- The schema pre-existed (Prisma), so Alembic is **baseline-stamped** at
  `65d0b607c636` (no DDL). New changes: edit a model →
  `uv run alembic revision --autogenerate -m "…"` → `uv run alembic upgrade head`.
- Response parity: `apps/api/app/schemas/base.py` — `ORMModel` emits camelCase keys;
  `PrismaDateTime` serialises datetimes as UTC `…000Z` so the web's `new Date()`
  parsing is unchanged.

## Feature flags

Three booleans via `@flags-sdk/vercel`, default `true`: `oficio-enabled`,
`circular-enabled`, `ordem-servico-enabled`. Read server-side in
`apps/web/src/app/(app)/layout.tsx`, passed to the sidebar + documents list as
`enabledDocTypes`; the OS flag also gates the `/ordem-servico` nav entry.
`apps/web/src/middleware.ts` gates `/documents` by type. Flags live **only in
`apps/web`** (UI visibility); the API does not enforce them.

## Deployment

- **Web** → Vercel project `qtscout` (Next.js). Env: `NEXT_PUBLIC_*` +
  `NEXT_PUBLIC_API_URL` (the API's public origin) + the Supabase/flags vars its
  server side needs.
- **API** → Docker container on **Railway** (`apps/api/Dockerfile`; `render.yaml` is a
  Render Blueprint alternative). Env: `DATABASE_URL`, `DIRECT_URL`,
  `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`,
  `MISTRAL_API_KEY`, `WEB_ORIGIN` (CORS allow-list). `$PORT` is platform-provided;
  the entrypoint is gunicorn + UvicornWorker. CORS (`app/main.py`) allows
  `WEB_ORIGIN` + the `Authorization` header. Full cutover steps: `apps/api/DEPLOY.md`.

## Commands

- **API** (from `apps/api/`, `uv`): `uv run uvicorn app.main:app --reload --port 3001`,
  `uv run pytest`, `uv run ruff check app`, `uv run mypy app`,
  `uv run python scripts/export_openapi.py`, `uv run alembic …`.
- **Web** (root): `npm run dev` (web :3000), `npm run build` / `typecheck` /
  `lint`, `npm run gen:api-types`, `npm run sync:categories[:check]`,
  `npm run docs:sync | docs:check`, `npm run test:e2e`.
- Local full stack: run the API and point the web's `NEXT_PUBLIC_API_URL` at it
  (or at Railway).

## Conventions

- pt-PT user-facing strings everywhere. Code/identifiers in English.
- No emojis in code or UI unless asked.
- Web server routes: dynamic params are `Promise<{ id: string }>`.
- API: FastAPI path/query params via the function signature; raw bodies as
  `Annotated[dict, Body()]` where pt-PT 400 messages must match the old API.
- DB writes: per-row upsert with per-row commit + `try/except` for batches
  (so one conflict doesn't roll back a whole import); `with_for_update` for
  sequence bumps.
- The OS catalog is single-sourced via `ordem_categories.json` — edit the JSON,
  run `npm run sync:categories`.
- Comments explain a non-obvious *why*, not what the code does.
- Admin-gate via the `AdminUser` dependency — never trust the client.

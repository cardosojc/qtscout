# QTScout — Onboarding Guide

> Generated from the Understand-Anything knowledge graph at commit `84c9966` (188 files, 413 nodes).

## 1. Project Overview

**QTScout** is a meeting-minutes and document-management system for **Agrupamento 61 – Santa Maria dos Olivais** (CNE, the Portuguese scouting association). All user-facing strings are **pt-PT**.

It's a **monorepo with two runtimes**:

| Half | Stack | Hosting |
|---|---|---|
| **Web** (`apps/web`) | Next.js 15 (App Router), React 19, TypeScript 5, TipTap, Tailwind 4, SWR | Vercel |
| **API** (`apps/api`) | FastAPI + Pydantic v2, SQLAlchemy 2.0 async (asyncpg) + Alembic, Playwright+Jinja2 PDF, openpyxl | Railway (Docker) |
| **Shared** (`packages/types`) | `@qtscout/types` — TS domain types + FE runtime helpers | consumed via `transpilePackages` |

Both halves share **one Supabase project** (Postgres + Auth). The npm/Turborepo workspace covers the TS side; the Python API is standalone.

**The golden rule:** the web app holds *no business logic or DB access* — it talks to FastAPI over `fetch` + Bearer token. When code and docs disagree, **the code wins**.

## 2. Architecture Layers

The graph organizes the 235 file-level nodes into 10 layers:

1. **Web Frontend** (65) — Next.js pages, React components, the editor, and the `apiFetch`/SWR data-access lib.
2. **API Endpoints** (59) — FastAPI routers exposing `/api/*` (documents, meetings, scouts, ordem-servico, auth, search, settings) + the cookie password-recovery routes that stay in the web app.
3. **API Business Logic** (18) — Ordem de Serviço assembly/resolution, SIIE imports, document utilities, and the PDF pipeline.
4. **Data & Schemas** (21) — SQLAlchemy ORM models (mapped to the existing Prisma columns), Pydantic schemas, Alembic migrations.
5. **API Foundation** (14) — app bootstrap, JWKS auth, async DB engine, deps/DI, config, Supabase admin client.
6. **Shared Types** (10) — `@qtscout/types`.
7. **Tests** (25) — Playwright E2E suite + FastAPI pytest.
8. **Infrastructure & CI** (3) — API Dockerfile, `render.yaml`, GitHub Actions e2e workflow.
9. **Documentation** (9) — READMEs, architecture/category references, deploy runbooks.
10. **Build & Tooling** (11) — Turborepo/workspace config, generated OpenAPI contract, codegen scripts.

The dependency direction is clean: **Web** and **API Endpoints** depend on **Business Logic** → **Data**, which sits on the **API Foundation**.

## 3. Key Concepts

- **One identity, two transports.** A single Supabase identity is carried as **cookies** for the web shell and **Bearer tokens** for the API. The web attaches the token via `apiFetch`; the API verifies it.
- **Offline JWKS verification.** `apps/api/app/auth.py` validates access-token signatures locally with cached ES256 public keys (fast, but can't see revocation until the short-lived token expires), falling back to Supabase's `/auth/v1/user`.
- **DI-based authZ, no middleware.** Handlers declare `CurrentUser` / `AdminUser` (`apps/api/app/deps.py`) in their signatures — there's no separate auth middleware.
- **Response parity.** `apps/api/app/schemas/base.py` (`ORMModel`) emits **camelCase** keys and serialises datetimes in Prisma's `…000Z` format, so the web's existing parsing works unchanged against the Python backend.
- **ORM maps to existing Prisma columns.** Snake_case Python attrs map to the original camelCase DB columns; Alembic is **baseline-stamped** (the schema pre-existed).
- **Transaction pooler quirk.** `db.py` disables the prepared-statement cache and `pool_pre_ping` because the app connects through Supabase's pgbouncer transaction pooler.
- **The OS catalog is single-sourced** from `ordem_categories.json` and **duplicated** into a generated TS copy for the FE — keep them in sync via `npm run sync:categories`.
- **Generated contract.** `openapi/openapi.json` → `apps/web/src/lib/api-types.ts` (`npm run gen:api-types`).

## 4. Guided Tour (recommended reading path)

| # | Step | Start here |
|---|---|---|
| 1 | Project Overview | `README.md` |
| 2 | Architecture Deep Dive | `docs/architecture.md` |
| 3 | The Two Entry Points | `apps/api/app/main.py`, `apps/web/src/app/layout.tsx` |
| 4 | How the Web Talks to the API | `apps/web/src/lib/api-client.ts`, `api-hooks.ts` |
| 5 | One Identity, Two Transports | `auth-provider.tsx`, `apps/api/app/auth.py` |
| 6 | Route Protection & Config | `apps/api/app/deps.py`, `config.py` |
| 7 | The Database Layer | `db.py`, `models/__init__.py`, `models/enums.py` |
| 8 | Routers & Response Parity | `routers/documents.py`, `meetings.py`, `schemas/base.py` |
| 9 | Ordem de Serviço — The Catalog | `ordem_categories.json`, `ordem_categories.py`, `ordem_permissions.py` |
| 10 | Ordem de Serviço — Logging & Assembly | `ordem-servico/page.tsx`, `ordens_servico.py`, `ordem_assembler.py`, `ordem_resolver.py` |
| 11 | PDF Generation | `pdf/render.py`, `pdf/os_content.py` |
| 12 | Containerization & Deployment | `apps/api/Dockerfile`, `.github/workflows/e2e.yml` |

**The signature feature is the Ordem de Serviço pipeline** (steps 9–11): leaders log individual `OrdemItem` rows (logging phase); then `POST /api/ordens-servico/generate` loads pending items in a date range, resolves refs, auto-includes admissions + noites-de-campo milestones, and folds everything into a JSON snapshot stored on the `Document` so later item edits don't change the issued document (assembly phase).

## 5. File Map (key files by layer)

**Web Frontend** — `lib/api-client.ts` (`apiFetch` + Bearer), `lib/api-hooks.ts` (SWR), `components/providers/auth-provider.tsx` (`useAuth`), `app/layout.tsx` (provider stack), `components/ui/sidebar.tsx` (nav, flag-gated), `middleware.ts` (Supabase session refresh), `flags.ts` (document-type feature flags).

**API Endpoints** — `routers/{documents,meetings,scouts,ordens_servico,ordem_items,auth,profile,users,search,settings,profiles,meeting_types,ai}.py`.

**API Business Logic** — `core/ordem_assembler.py`, `ordem_resolver.py`, `ordem_categories.py`, `ordem_permissions.py`, `siie_import.py`, `siie_atividades_import.py`, `document_utils.py`; `pdf/{render,html_builders,os_content}.py` + Jinja2 templates.

**Data & Schemas** — `models/{document,meeting,scout,profile,enums,_columns,ids}.py`, `schemas/*.py` (`base.py` = `ORMModel`), `migrations/` (Alembic, baseline `65d0b607c636`).

**API Foundation** — `main.py`, `auth.py`, `deps.py`, `db.py`, `config.py`, `supabase_admin.py`.

**Shared Types** — `packages/types/src/{ordem-item,ordem-servico,document,meeting,scout,session,leader-role,ano-escutista}.ts`.

**Infra/Tooling** — `apps/api/Dockerfile`, `render.yaml`, `.github/workflows/e2e.yml`, `openapi/openapi.json`, `scripts/sync-categories.mjs`, `turbo.json`.

## 6. Complexity Hotspots (approach carefully)

27 files rated **complex**. The ones a newcomer should be most careful with:

**Backend**
- `routers/ordens_servico.py` — the OS assembly endpoint (period loading, ref resolution, auto-includes, transactional sequence bump). The hardest single file.
- `routers/documents.py` — CRUD + signing + sequence numbering + PDF across three document types.
- `routers/scouts.py` — Scout CRUD + SIIE xlsx import + noites-de-campo milestones.
- `routers/meetings.py`, `routers/ordem_items.py`.

**Frontend**
- `components/ordem-servico/item-form.tsx` — dynamic form whose fields adapt to the selected category shape.
- `components/documents/ordem-servico-view.tsx` — renders the OS snapshot, tolerant of legacy/partial buckets.
- `components/editor/rich-text-editor.tsx` (TipTap), `components/meetings/meeting-form.tsx`, `components/membros/scout-form.tsx`, `components/ui/sidebar.tsx`.

**Generated (don't hand-edit)** — `apps/web/src/lib/api-types.ts` and `openapi/openapi.json` are generated; change the API contract and regenerate.

**Distribution:** 93 simple · 68 moderate · 27 complex.

---

_This guide was generated by `understand-anything:understand-onboard` from `.understand-anything/knowledge-graph.json`. Regenerate after significant architectural changes._

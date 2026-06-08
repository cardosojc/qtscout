# QTScout — Claude operating notes

Meeting minutes + document management for **Agrupamento 61 – Santa Maria dos
Olivais** (CNE). All user-facing strings are **pt-PT**. Never add emojis to UI
or files unless asked.

## Monorepo

npm workspaces + Turborepo. The backend was extracted from Next.js into a
standalone **Hono** API so other clients can use it; the UI stays in Next.js
and talks to the API over `fetch` + Bearer token.

- `apps/web` — Next.js 15 UI (no DB / business logic). Calls the API via
  `apiFetch()` (`apps/web/src/lib/api-client.ts`).
- `apps/api` — Hono service (`tsx`), all 49 endpoints under `/api/*`.
- `packages/types` (`@qtscout/types`) — pure TS types (incl. `session.ts`).
- `packages/db` (`@qtscout/db`) — Prisma schema + client singleton.
- `packages/core` (`@qtscout/core`) — backend logic: ordem-*, siie-*,
  pdf-generator (+ `assets/images`), document-utils, ano-escutista.
- `packages/auth` (`@qtscout/auth`) — Bearer-JWT verification → `Session`.

Internal packages ship raw TS (no build); web consumes them via
`transpilePackages`, the API via `tsx`. Run everything from the repo root.

## Stack

- Next.js 15 App Router (Turbopack), React 19, TypeScript 5
- Hono (API) on `@hono/node-server` / `tsx`
- Supabase Auth (`@supabase/ssr` in web; `@supabase/supabase-js` token
  validation in the API) + Supabase Postgres
- Prisma ORM (`packages/db/prisma/schema.prisma`)
- TipTap rich text, Puppeteer-headless PDF, Tailwind CSS 4
- `xlsx` (SheetJS) for SIIE imports

Common commands (root): `npm run dev` (starts web :3000 + api :3001),
`npm run build`, `npm run typecheck`, `npm run lint`, `npm run test:e2e`.
Type-check is the fastest signal — prefer `npm run typecheck` over a full
build when verifying changes.

## Auth

One identity (Supabase), two transports: cookies for the web shell, **Bearer
tokens** for the API.

- API: routes use the `requireAuth` middleware (`apps/api/src/middleware/auth.ts`),
  then read `c.get('session')`. Auth itself is `@qtscout/auth`:
  `getSessionFromToken(jwt)` validates via `supabase.auth.getUser(token)` and
  joins the `Profile`, returning the same `{ user: { id, email, name, username,
  role } }` shape as before. `requireAdmin` gates ADMIN-only routes.
- Client: `const { user, loading, signOut } = useAuth()` from
  `apps/web/src/components/providers/auth-provider.tsx`. All data calls go
  through `apiFetch()`, which attaches the Supabase access token as Bearer.
- **No authZ middleware** beyond `requireAuth`/`requireAdmin` — handlers check
  `c.get('session').user.role` directly.
- Supabase admin client (user create/delete) is `apps/api/src/lib/supabase-admin.ts`;
  uses `SUPABASE_SECRET_KEY`.
- Two endpoints stay in the web app (cookie/email-redirect recovery flow):
  `POST /api/auth/{forgot,reset}-password`.
- Never write `getSession()` (the old cookie helper) — it was removed from web.

## Database / Prisma — read carefully

- Schema: `packages/db/prisma/schema.prisma`. Connection via `DATABASE_URL`
  (pooler) + `DIRECT_URL` for migrations. `packages/db/prisma.config.ts` does
  manual env loading from `apps/web/.env.local` (single source of truth).
- **Drift exists** in `_prisma_migrations`: `npx prisma migrate dev` will
  refuse to run because of a historical rolled-back migration row. Don't try
  to reset.
- **Migration workflow**:
  1. Edit `packages/db/prisma/schema.prisma`.
  2. Create the migration folder + SQL manually under
     `packages/db/prisma/migrations/<YYYYMMDDHHMMSS>_<name>/migration.sql`.
  3. Apply via the Supabase MCP (`mcp__claude_ai_Supabase__execute_sql`,
     project `apoltgoxrrzjteosljoo`). In the same SQL block, insert into
     `_prisma_migrations` so Prisma's status stays consistent.
  4. Run `npm run db:generate`.
  5. **Restart the dev server.** Turbopack caches the generated client and
     does not hot-reload `node_modules/@prisma/client` changes — symptoms are
     `Unknown argument 'x'` referring to fields that don't exist anymore.
- Prefer `prisma.X.upsert` over find+create/update. For batches, use
  per-row upsert + `Promise.all` + `try/catch` per row (see
  `apps/api/src/routes/scouts.ts`).

## Feature flags

Defined in `apps/web/src/flags.ts` using `@flags-sdk/vercel`. Three flags gate the
document types: `oficio-enabled`, `circular-enabled`, `ordem-servico-enabled`.
All default to `true`. Discovered at `/.well-known/vercel/flags`. The OS flag
also controls visibility of the `/ordem-servico` sidebar nav entry.

## Document model

Single `Document` table for OFICIO / CIRCULAR / ORDEM_SERVICO. Numbering via
`DocumentSequence` (year=0 sentinel for OS, real year for others); starting
numbers configurable in `DocumentSettings`. Identifier format:
`OF-001/2026`, `CI-001/2026`, `OS-001` (no year for OS — global sequence).

Signing: `Profile.signature` is a base64 PNG data URL; `Document.signedById`
+ `signedAt`. Sign/unsign endpoint: `POST/DELETE /api/documents/[id]/sign`.
Render: "Saudações Escutistas" + image (or handwritten Caveat fallback) +
name + roles in parentheses.

## Ordem de Serviço pipeline (the non-obvious bit)

Two phases: **logging** and **assembly**.

**Logging.** Section leaders + group leaders log individual `OrdemItem`
rows (`packages/db/prisma/schema.prisma`). Each item has:
- `category` (a string key, e.g. `ATIVIDADE`, `NOMEACAO_DIRIGENTE`) —
  validated against the catalog in `packages/types/src/ordem-item.ts`.
- `section` (`OrdemSection?`) — null = Agrupamento-level / leader / group
  item. Set = section-specific item.
- `data` (JSON) — shape depends on category. See `ItemShape` enum and the
  `validateItemData` switch.
- `externalId?` — used by SIIE imports to upsert.

The catalog (`ORDEM_CATEGORIES` in `packages/types/src/ordem-item.ts`) is the source
of truth: it controls form rendering, permission checks, the API validator,
and how the assembler routes each category. Categories declare a `scope`:
`GROUP`, `SECTION`, or `BOTH`. `BOTH` is used by `ATIVIDADE` (the form picks
"Destino: Agrupamento / Alcateia / …").

Permissions: `packages/core/src/ordem-permissions.ts`. Group-level roles
(Chefe de Agrupamento + 4 others) can create group items; section-level
roles (Chefe de Unidade, Adjunto, Instrutor + `Profile.section`) can create
items for their section. ADMIN can do anything.

**Assembly.** `POST /api/ordens-servico/generate` with `{ from, to }`:
1. Loads all pending items (`includedInOsId IS NULL`) in the range.
2. Resolves scout/profile refs via `packages/core/src/ordem-resolver.ts` (single
   batched query for each table).
3. `assembleOrdemServico()` folds items into `OrdemServicoData` JSON
   (`packages/types/src/ordem-servico.ts`). Snapshot is stored on `Document.content`
   so subsequent edits to source items don't change the generated doc.
4. **Auto-includes admissions**: pulls `Scout` rows whose `joinedAt` is in
   the period and has a section; appends their names to
   `efetivo.admissao[section]`. `ADMISSAO` is not a manual category.
   **Auto-includes noites de campo milestones**: pulls `ScoutNightsBadge`
   rows whose `awardedAt` is in the period; groups by `(section, count)`
   and pushes one `OSNoitesMilestone` per group into
   `noitesCampo[section]`. `NOITES_CAMPO` is not a manual category — see
   per-scout editor on `/membros/[id]`.
5. Transactional: bumps `DocumentSequence`, creates the `Document`, marks
   source items as `includedInOsId`. Items already in an OS are
   immutable (item PATCH/DELETE returns 409).

PDF render path unchanged for OS: `packages/core/src/pdf-generator.ts` reads the
snapshotted JSON.

## Scouts (members)

`Scout` table is the canonical member record (`firstName + lastName`,
`numeroAssociado`, `dateOfBirth`, optional `section`, plus identification +
address + parent + Encarregado de Educação contact fields). Section is
optional so leaders/honorários can be tracked alongside section members.

`Scout.profileId` optionally links to a `Profile` (for leaders who also
have an account). SIIE import sets this on **create** when email matches an
existing Profile — never overwrites a manual link.

Noites de campo are tracked per scout as milestones in `ScoutNightsBadge`
(unique on `(scoutId, count)`; counts come from
`NIGHTS_BADGE_COUNTS = [25, 50, 75, 100, 200]`). The Scout detail page
exposes a small editor with one date input per milestone (ADMIN-only
writes via `PUT /api/scouts/[id]/nights-badges`).

Each scout also has a manual `Scout.noitesCampoInicial` snapshot — the
number of noites accumulated as of `NOITES_CAMPO_SNAPSHOT_DATE`
(2025-10-01, start of the current ano escutista). `computeNoitesCampoAtual`
in `packages/types/src/scout.ts` returns the live total; today it just echoes the
snapshot, with a `TODO` to add the delta from activities the scout
participated in after that date once the participation model exists.

Item forms with `MEMBER_REF` / `NOITES_REF` / `SCOUT_OR_PROFILE_REF` shapes
pick from `/api/scouts?section=…`. Leader picker calls
`/api/profiles/leaders`.

## SIIE imports

Two endpoints, both ADMIN-only multipart `file` upload:

- `POST /api/scouts/import` — `export.xlsx` from SIIE. Maps `nin →
  numeroAssociado` (upsert key), splits `nome` on first space, derives
  `section` from `Categoria` last letter (`L`→ALCATEIA, `E`→EXPEDICAO,
  `P`→COMUNIDADE, `C`→CLA, anything else → null = leader). `cc + nif`,
  pai/mãe contacts, `Enc Educ`. Postal code joins `CP 1 + CP 2 +
  codigopostal` into one string.
- `POST /api/ordem-items/import-activities` — `export (1).xlsx` from SIIE.
  Maps `idatividade → externalId`, creates one `ATIVIDADE` OrdemItem per
  row. Section comes from `Sigla Seccao` only when it's a single letter
  (L/E/P/C); multi-letter or anything else → null = Agrupamento. Items
  already snapshotted into an OS are skipped, not overwritten.

Both follow the same pattern: validate → pre-fetch (existing rows, profile
emails) → batch upsert in parallel with per-row try/catch.

## Where things live

- `apps/web/src/app/(app)/` — authenticated pages
  - `meetings/`, `documents/`, `ordem-servico/`, `membros/`, `profile/`,
    `settings/`, `search/`
- `apps/web/src/app/api/` — ONLY `auth/{forgot,reset}-password` (recovery flow)
- `apps/web/src/components/` — UI by domain (`documents/`, `ordem-servico/`,
  `membros/`, `editor/`, `providers/`, `ui/`)
- `apps/web/src/lib/` — `api-client` (apiFetch), `supabase/`, `flags`
- `apps/api/src/routes/` — one Hono router per domain (the ported handlers)
- `apps/api/src/{middleware,lib}/` — `requireAuth`/`requireAdmin`,
  `supabase-admin`, `pdf-response`
- `packages/core/src/` — `pdf-generator`, `ordem-{permissions,assembler,resolver}`,
  `siie-{import,atividades-import}`, `document-utils`, `ano-escutista`
- `packages/types/src/` — domain types (`session`, `document`, `meeting`,
  `ordem-servico`, `ordem-item`, `scout`, `leader-role`)
- `packages/db/src/` — Prisma singleton; `packages/auth/src/` — token auth

## Deeper reading

- `docs/architecture.md` — full source tree map, domain ER summary, OS
  pipeline walkthrough, PDF pipeline, SIIE import flow, and the database
  workflow with the Prisma drift workaround. Read before non-trivial work;
  this file is the quick reference.
- `docs/ordem-categories.md` — generated category → snapshot bucket table.
  Always reflects the current catalog and assembler.

## Keeping docs current

A Stop hook (`scripts/check-docs-drift.sh`, registered in
`.claude/settings.json`) fires when this session ends. If any watchlisted
file changed in the working tree (schema, OS catalog, assembler, resolver,
permissions, PDF generator, key route handlers) but neither `CLAUDE.md` nor
`docs/architecture.md` was touched, the hook surfaces a reminder before the
session can stop. Fires at most once per session.

When the catalog or assembler changes, run `npm run docs:sync` to refresh
`docs/ordem-categories.md`. CI / pre-commit can run `npm run docs:check`,
which fails if the file is stale.

## Gotchas

- API route params (Hono): `c.req.param('id')`, query via `c.req.query('x')`.
  Web page dynamic params are still Promises:
  `{ params }: { params: Promise<{ id: string }> }` → `const { id } = await params`.
- Web data fetching goes through `apiFetch()` (Bearer), never relative
  `fetch('/api/...')` — the routes no longer live in the web app.
- API auth is Bearer-only via `requireAuth`; never reintroduce cookie
  `getSession()` / `getServerSession`.
- `useAuth()`'s `user.role` is `'ADMIN' | 'LEADER' | 'MEMBER'`, separate
  from `Profile.roles[]` (the array of human-readable leader role labels).
- E2E tests in `e2e/` use Playwright with a shared `storageState`; test
  user is `e2e-test@qtscout.test`.
- Full-text search on Meetings uses a `tsvector` column with Portuguese
  config + GIN index. Query path is `/api/search/meetings`.
- Old OS documents with the legacy full-form JSON shape still render —
  `defaultOrdemServicoData()` + `parseOrdemServicoData()` are tolerant.

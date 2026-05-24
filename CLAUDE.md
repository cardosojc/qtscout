# QTScout — Claude operating notes

Meeting minutes + document management for **Agrupamento 61 – Santa Maria dos
Olivais** (CNE). All user-facing strings are **pt-PT**. Never add emojis to UI
or files unless asked.

## Stack

- Next.js 15 App Router (Turbopack), React 19, TypeScript 5
- Supabase Auth (`@supabase/ssr`) + Supabase Postgres
- Prisma ORM (`prisma/schema.prisma`)
- TipTap rich text, Puppeteer-headless PDF, Tailwind CSS 4
- `xlsx` (SheetJS) for SIIE imports

Common commands: `npm run dev`, `npm run build`, `npm run lint`,
`npx tsc --noEmit`, `npm run test:e2e`. Type-check is the fastest signal —
prefer it over a full build when verifying changes.

## Auth

- Server: `const session = await getSession()` from `src/lib/auth-helpers.ts`
  (cached per request). Returns `{ user: { id, email, name, username, role } }`
  or `null`. Use this in every API route.
- Client: `const { user, loading, signOut } = useAuth()` from
  `src/components/providers/auth-provider.tsx`.
- **No middleware** for route protection — each route checks `session`
  explicitly. Admin checks are `session.user.role !== 'ADMIN'`.
- Supabase admin client (for user-create/delete) lives in the route that
  needs it; uses `SUPABASE_SECRET_KEY`.

## Database / Prisma — read carefully

- Schema: `prisma/schema.prisma`. Connection via `DATABASE_URL` (pooler) +
  `DIRECT_URL` for migrations. `prisma.config.ts` does manual env loading.
- **Drift exists** in `_prisma_migrations`: `npx prisma migrate dev` will
  refuse to run because of a historical rolled-back migration row. Don't try
  to reset.
- **Migration workflow**:
  1. Edit `prisma/schema.prisma`.
  2. Create the migration folder + SQL manually under
     `prisma/migrations/<YYYYMMDDHHMMSS>_<name>/migration.sql`.
  3. Apply via the Supabase MCP (`mcp__claude_ai_Supabase__execute_sql`,
     project `apoltgoxrrzjteosljoo`). In the same SQL block, insert into
     `_prisma_migrations` so Prisma's status stays consistent.
  4. Run `npx prisma generate`.
  5. **Restart the dev server.** Turbopack caches the generated client and
     does not hot-reload `node_modules/@prisma/client` changes — symptoms are
     `Unknown argument 'x'` referring to fields that don't exist anymore.
- Prefer `prisma.X.upsert` over find+create/update. For batches, use
  per-row upsert + `Promise.all` + `try/catch` per row (see
  `src/app/api/scouts/import/route.ts`).

## Feature flags

Defined in `src/flags.ts` using `@flags-sdk/vercel`. Three flags gate the
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
rows (`prisma/schema.prisma`). Each item has:
- `category` (a string key, e.g. `ATIVIDADE`, `NOMEACAO_DIRIGENTE`) —
  validated against the catalog in `src/types/ordem-item.ts`.
- `section` (`OrdemSection?`) — null = Agrupamento-level / leader / group
  item. Set = section-specific item.
- `data` (JSON) — shape depends on category. See `ItemShape` enum and the
  `validateItemData` switch.
- `externalId?` — used by SIIE imports to upsert.

The catalog (`ORDEM_CATEGORIES` in `src/types/ordem-item.ts`) is the source
of truth: it controls form rendering, permission checks, the API validator,
and how the assembler routes each category. Categories declare a `scope`:
`GROUP`, `SECTION`, or `BOTH`. `BOTH` is used by `ATIVIDADE` (the form picks
"Destino: Agrupamento / Alcateia / …").

Permissions: `src/lib/ordem-permissions.ts`. Group-level roles
(Chefe de Agrupamento + 4 others) can create group items; section-level
roles (Chefe de Unidade, Adjunto, Instrutor + `Profile.section`) can create
items for their section. ADMIN can do anything.

**Assembly.** `POST /api/ordens-servico/generate` with `{ from, to }`:
1. Loads all pending items (`includedInOsId IS NULL`) in the range.
2. Resolves scout/profile refs via `src/lib/ordem-resolver.ts` (single
   batched query for each table).
3. `assembleOrdemServico()` folds items into `OrdemServicoData` JSON
   (`src/types/ordem-servico.ts`). Snapshot is stored on `Document.content`
   so subsequent edits to source items don't change the generated doc.
4. **Auto-includes admissions**: pulls `Scout` rows whose `joinedAt` is in
   the period and has a section; appends their names to
   `efetivo.admissao[section]`. `ADMISSAO` is not a manual category.
5. Transactional: bumps `DocumentSequence`, creates the `Document`, marks
   source items as `includedInOsId`. Items already in an OS are
   immutable (item PATCH/DELETE returns 409).

PDF render path unchanged for OS: `src/lib/pdf-generator.ts` reads the
snapshotted JSON.

## Scouts (members)

`Scout` table is the canonical member record (`firstName + lastName`,
`numeroAssociado`, `dateOfBirth`, optional `section`, plus identification +
address + parent + Encarregado de Educação contact fields). Section is
optional so leaders/honorários can be tracked alongside section members.

`Scout.profileId` optionally links to a `Profile` (for leaders who also
have an account). SIIE import sets this on **create** when email matches an
existing Profile — never overwrites a manual link.

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

- `src/app/(app)/` — authenticated pages
  - `meetings/`, `documents/`, `ordem-servico/`, `membros/`, `profile/`,
    `settings/`, `search/`
- `src/app/api/` — route handlers (same structure)
- `src/components/` — UI by domain (`documents/`, `ordem-servico/`,
  `membros/`, `editor/`, `providers/`, `ui/`)
- `src/lib/` — shared (`auth-helpers`, `prisma`, `pdf-generator`,
  `ordem-permissions`, `ordem-assembler`, `ordem-resolver`, `siie-import`,
  `siie-atividades-import`, `document-utils`, `ano-escutista`)
- `src/types/` — domain types (`document`, `meeting`, `ordem-servico`,
  `ordem-item`, `scout`, `leader-role`)

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

- Dynamic route params are Promises:
  `{ params }: { params: Promise<{ id: string }> }` → `const { id } = await params`.
- Never write `getServerSession` (legacy NextAuth name); always `getSession()`.
- `useAuth()`'s `user.role` is `'ADMIN' | 'LEADER' | 'MEMBER'`, separate
  from `Profile.roles[]` (the array of human-readable leader role labels).
- E2E tests in `e2e/` use Playwright with a shared `storageState`; test
  user is `e2e-test@qtscout.test`.
- Full-text search on Meetings uses a `tsvector` column with Portuguese
  config + GIN index. Query path is `/api/search/meetings`.
- Old OS documents with the legacy full-form JSON shape still render —
  `defaultOrdemServicoData()` + `parseOrdemServicoData()` are tolerant.

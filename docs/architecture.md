# Architecture

Deeper notes for QTScout. Pair this with `CLAUDE.md` (operating notes / quick
reference). When something here drifts from the code, the code wins — update
this file or delete the stale section.

## Monorepo layout

npm workspaces + Turborepo. Two deployables (`apps/*`) over four shared
packages (`packages/*`). The UI (`apps/web`) talks to the standalone HTTP API
(`apps/api`) over `fetch` + Bearer token — no in-process API anymore.

```
apps/
├── web/                          # Next.js 15 UI (no business logic / DB)
│   ├── src/app/(app)/            # Authenticated, sidebar-shell pages
│   │   ├── meetings/ documents/ ordem-servico/ membros/ profile/ settings/ search/
│   ├── src/app/api/              # ONLY auth recovery flows that need Supabase
│   │   └── auth/{forgot,reset}-password  # cookie/redirect-bound; stay in web
│   ├── src/app/auth/             # Sign-in / sign-up / recovery pages
│   ├── src/components/           # ordem-servico, membros, documents, editor, providers, ui
│   ├── src/lib/api-client.ts     # apiFetch(): prepends NEXT_PUBLIC_API_URL + Bearer
│   ├── src/lib/supabase/         # client.ts, server.ts, middleware.ts (session + flags)
│   └── src/flags.ts              # Vercel flags (UI visibility + /documents gating)
└── api/                          # Hono service — the standalone backend
    └── src/
        ├── index.ts              # app, CORS, mounts routers under /api
        ├── load-env.ts           # loads env before @qtscout/db (Prisma) init
        ├── middleware/auth.ts    # requireAuth (Bearer JWT) + requireAdmin
        ├── lib/                  # supabase-admin, pdf-response
        └── routes/               # one router per domain (auth, profile, profiles,
                                   #   meeting-types, meetings, documents, scouts,
                                   #   ordem-items, ordens-servico, search, settings,
                                   #   users, ai) — ports of the old route handlers

packages/
├── types/   # @qtscout/types — pure TS types (zero runtime deps). session.ts, document.ts,
│            #   meeting.ts, scout.ts, ordem-item.ts, ordem-servico.ts, leader-role.ts
├── db/      # @qtscout/db — Prisma schema + client singleton; re-exports @prisma/client.
│            #   prisma/schema.prisma + migrations + seed.ts + prisma.config.ts live here
├── core/    # @qtscout/core — backend business logic (depends on db + types):
│            #   ordem-{assembler,resolver,permissions}, siie-{import,atividades-import},
│            #   pdf-generator (+ pdf-config + assets/images/*), document-utils, ano-escutista
└── auth/    # @qtscout/auth — getSessionFromToken(jwt) + bearerFromHeader(); hydrates Profile
```

Internal packages ship **raw TypeScript** (no build step): consumed by Next via
`transpilePackages` and by the API via `tsx`. Subpath exports (`@qtscout/core/x`,
`@qtscout/types/x`) keep heavy deps (Puppeteer, xlsx, Prisma) out of the web
client bundle — web depends only on `@qtscout/types` + `@qtscout/core` (and only
client-safe modules like `ano-escutista`).

## Domain model

```
Profile (Supabase Auth ↔ profiles)
  │   role: ADMIN | LEADER | MEMBER             # coarse system permission
  │   roles: string[]                           # human-readable functions
  │   section: OrdemSection?                    # only meaningful with section-level roles
  │   signature: string?                        # base64 PNG data URL
  ├──< Meeting (createdBy)
  ├──< Document (createdBy)
  ├──< Document (signedBy)
  ├──< OrdemItem (createdBy)
  └──< Scout (profileId, optional 1:1)

Scout (scouts)                                   # member, may or may not be a leader
  │   numeroAssociado: string? @unique          # NIN, SIIE upsert key
  │   firstName/lastName, dateOfBirth, joinedAt
  │   section: OrdemSection?                    # null = leader / unassigned
  │   profileId?                                # set when this scout is also a leader
  ├──< ScoutLeader (responsible leaders — UI not yet built)
  └──< ScoutNightsBadge                         # milestone per scout (25/50/75/100/200)
         count, awardedAt                       # @@unique(scoutId, count)

Meeting (meetings)
  │   type: CA | RD                             # via MeetingType
  │   identifier: "{TYPE}-YYYYMMDD"
  │   agenda: Json                              # items, attendees, chefe, secretário
  │   contentTsvector                           # GIN-indexed pt full-text search
  └──< MeetingAttendee (profileId)

Document (documents)
  │   type: OFICIO | CIRCULAR | ORDEM_SERVICO
  │   number: Int                               # via DocumentSequence (year=0 sentinel for OS)
  │   year: Int?                                # null for OS (continuous global sequence)
  │   content: string                           # HTML for OF/CI, JSON snapshot for OS
  │   signedBy: Profile?, signedAt
  └──< OrdemItem (sourceItems via includedInOsId)

OrdemItem (ordem_items)
      externalId?: string @unique               # SIIE atividades upsert key
      category: string                          # see ORDEM_CATEGORIES catalog
      section: OrdemSection?
      date: DateTime                            # used for OS date-range filter
      data: Json                                # shape determined by category.shape
      includedInOsId?: Document.id              # set on OS generation; locks the item
```

## Auth flow

Single identity (Supabase Auth), two transports — cookies for the web shell,
Bearer tokens for the API. This makes the API usable by any client.

1. User signs in via Supabase Auth (email/password). The `@supabase/ssr`
   browser client stores the session in cookies; `apps/web/src/middleware.ts`
   (`updateSession`) refreshes it on navigation.
2. **Web → API.** `apps/web/src/lib/api-client.ts` `apiFetch()` reads the
   access token via `supabase.auth.getSession()` and sends it as
   `Authorization: Bearer <jwt>` to `NEXT_PUBLIC_API_URL`. The browser
   `useAuth()` provider calls `apiFetch('/api/auth/profile')` to hydrate the user.
3. **API auth.** `apps/api` `requireAuth` middleware (`@qtscout/auth`):
   - `bearerFromHeader()` extracts the token.
   - `getSessionFromToken()` validates it with `supabase.auth.getUser(token)`,
     then joins the `Profile` row (Prisma) by Supabase user id.
   - Produces the same `Session` shape the old cookie `getSession()` did, so
     ported handlers are unchanged. `requireAdmin` gates ADMIN-only routes.
4. **Other clients** authenticate against Supabase (e.g. password grant) and
   send the resulting `access_token` as Bearer — identical server path.

There is still **no per-route middleware for authZ** beyond `requireAuth` /
`requireAdmin`; handlers check `c.get('session').user.role` directly. Two
endpoints stay in the web app because they are bound to Supabase's cookie /
email-redirect recovery flow: `POST /api/auth/{forgot,reset}-password`.

## Ordem de Serviço pipeline

The OS feature has the most moving parts. There are two phases.

### Phase 1: logging items

Leaders log individual `OrdemItem`s via `/ordem-servico` as events happen
(an activity took place, a scout was nominated, etc.).

```
User picks category (filtered by permissions)
  └─> ItemForm renders inputs based on category.shape
        ├─ STRING / TEXT     : single input
        ├─ ATIVIDADE         : nome + datas + local
        ├─ NOMEACAO          : nome + cargo
        ├─ NOITES            : count
        ├─ MEMBER_REF        : scout picker (filtered by section)
        ├─ NOITES_REF        : count + multi-select scout checklist
        ├─ PROFILE_REF       : leader picker + cargo
        └─ SCOUT_OR_PROFILE  : toggle scout/leader + picker + cargo
  └─> POST /api/ordem-items
        ├─ validateItemData(shape, data)
        ├─ canManageItem(profile, category, section)
        ├─ validateRefs(scoutId / profileId exists; scout.section matches)
        └─ INSERT
```

Permissions matrix:

| Category scope | ADMIN | Group-level role | Section-level role (for their section) |
|---|---|---|---|
| GROUP | yes | yes | no |
| SECTION | yes | no | yes |
| BOTH (with section=null) | yes | yes | no |
| BOTH (with section set) | yes | yes (any section) | yes (only their own) |

Group-level roles: Chefe de Agrupamento (+ Adjunto), Secretário, Tesoureiro,
Assistente. Section-level roles: Chefe de Unidade (+ Adjunto), Instrutor —
all of which require `Profile.section` to be set.

### Phase 2: assembly into a Document

`POST /api/ordens-servico/generate { from, to }` (ADMIN only):

```
1. Load OrdemItems where date in [from, to] AND includedInOsId IS NULL
2. Load Scouts where joinedAt in [from, to] AND section IS NOT NULL
3. Load ScoutNightsBadge where awardedAt in [from, to] AND scout.section IS NOT NULL
4. resolveRefs(items)  ─────►  one query for scouts, one for profiles
5. assembleOrdemServico(items, periodo, refs)
     │  fold each item into the matching OrdemServicoData bucket
     │  (see ordem-item.ts comment header for the full mapping)
     └─ snapshot is plain strings (resolved names), not refs
6. Auto-include admissions:
     for each admitted scout in [from, to]:
       data.efetivo.admissao[section].push(scoutLabel(scout))
7. Auto-include noites de campo:
     group badges by (section, count)
     for each group:
       data.noitesCampo[section].push({ count, membros: [names] })
8. Transaction:
     a) DocumentSequence.upsert       (next OS number, type=ORDEM_SERVICO year=0)
     b) Document.create               (content = JSON.stringify(assembled))
     c) OrdemItem.updateMany          (includedInOsId = doc.id) — locks them
9. Return { id, identifier, itemCount, autoAdmissions, autoNightsBadges }
```

The snapshot is immutable from then on. Items already `includedInOsId`
return 409 from PATCH/DELETE — preserves the OS document's historical
accuracy. The OS PDF renderer reads only `Document.content`; the original
items are not consulted at render time.

## PDF rendering

Runs in **`apps/api`** (the only PDF generator now), via
`@qtscout/core/pdf-generator`. Single browser launch per request, ~5–8 s cold:

- Local dev: `puppeteer` (full bundle).
- Production: `puppeteer-core` + `@sparticuz/chromium-min`
  (Chromium binary fetched from GitHub release at startup).
- These deps live in `@qtscout/core`, not in the web app.

Header logos ship inside the package at `packages/core/assets/images/` and are
resolved relative to the module (`import.meta.url`), with a `process.cwd()/public`
fallback; they are base64-embedded into the HTML. The API returns the PDF as a
binary body via `apps/api/src/lib/pdf-response.ts`.

Meeting and Document each have a dedicated HTML generator
(`generateMeetingHTML`, `generateDocumentHTML`). Fonts come from
`fonts.googleapis.com` (Lato + Caveat — Caveat is the handwritten fallback
when a signer hasn't uploaded a signature image). Header logos are
base64-embedded.

Signature block: "Saudações Escutistas," → signature image (or Caveat
name) → "Name (Role 1, Role 2)". Centered.

## SIIE imports

Two endpoints, same shape:

```
ADMIN uploads xlsx
  └─> POST /api/scouts/import           (members)
  └─> POST /api/ordem-items/import-activities

For each: parse → validate → batch upsert
  1. xlsx.read + sheet_to_json
  2. mapRow / mapActivityRow per row (pure functions in lib/siie-*.ts)
     - field mapping
     - section derived from CNE category letter / Sigla Seccao
     - date parsing handles DD/MM/YYYY and Excel serial
  3. ONE pre-fetch query for existing rows (by NIN or externalId)
     + scouts also pre-fetches all profile emails for leader linking
  4. Promise.all of per-row prisma.X.upsert (single statement)
     try/catch per row → granular error reporting in the summary
  5. Activities: rows with includedInOsId are skipped (immutable)
     Scouts: profile link applied only on create (preserves manual edits)
```

Section mapping (members): last character of `Categoria` →
`L→ALCATEIA, E→EXPEDICAO, P→COMUNIDADE, C→CLA`, else null (leaders).

Section mapping (activities): only a single-letter `Sigla Seccao` →
its section; multi-letter or empty → null (Agrupamento-level).

## Database workflow

The `_prisma_migrations` table has a historical rolled-back row that makes
`prisma migrate dev` refuse to run. The workaround is documented in
`CLAUDE.md`. In short:

1. Edit `packages/db/prisma/schema.prisma`.
2. Author `packages/db/prisma/migrations/<ts>_<name>/migration.sql` manually.
3. Execute via Supabase MCP + insert into `_prisma_migrations` in the
   same statement.
4. `npm run db:generate` (runs `prisma generate` in `@qtscout/db`).
5. **Restart the dev server.** Turbopack caches `@prisma/client`.

Prisma config (`packages/db/prisma.config.ts`) loads env from
`apps/web/.env.local` (single source of truth during the monorepo transition).

The schema is the source of truth, the migrations are the audit trail —
they're applied in the same transaction so the two stay in sync, but the
canonical "what fields exist" answer comes from the schema file.

## Feature flags

Three booleans via `@flags-sdk/vercel`, default `true`:

- `oficio-enabled`
- `circular-enabled`
- `ordem-servico-enabled`

Read server-side in `apps/web/src/app/(app)/layout.tsx` and passed down to the
sidebar + documents list as `enabledDocTypes`. The OS flag also controls
visibility of the `/ordem-servico` nav entry. `apps/web/src/middleware.ts`
gates the `/documents` page by type. The Vercel Flags dashboard owns the
overrides. Flags currently live **only in `apps/web`** (UI visibility +
page gating); the API does not yet enforce them on create/generate — adding
that is a follow-up if document-type gating must hold for non-browser clients.

## Deployment

Two Vercel projects from one repo:

- **web** → root directory `apps/web` (Next.js, auto-detected). Env:
  `NEXT_PUBLIC_*` + `NEXT_PUBLIC_API_URL` (the API's public origin) + the
  Supabase/flags vars its server side still needs.
- **api** → root directory `apps/api` (Hono). Env: `DATABASE_URL`,
  `DIRECT_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`,
  `SUPABASE_SECRET_KEY`, `MISTRAL_API_KEY`, `WEB_ORIGIN` (CORS allow-list).
  The PDF route needs elevated `maxDuration`/memory (was the only entry in the
  old root `vercel.json`).

CORS: `apps/api/src/index.ts` allows `WEB_ORIGIN` (defaults to
`http://localhost:3000`) and the `Authorization` header.

## Commands

Run from the repo root (Turborepo fans out to workspaces):

- `npm run dev` — starts web (:3000) **and** api (:3001) in parallel.
- `npm run build` / `npm run typecheck` / `npm run lint`.
- `npm run db:generate | db:migrate | db:seed` — proxy to `@qtscout/db`.
- `npm run docs:sync | docs:check` — regenerate/verify `ordem-categories.md`.
- `npm run test:e2e` — Playwright; its `webServer` runs `npm run dev` (both).

## Conventions

- pt-PT user-facing strings everywhere. Code/identifiers in English.
- No emojis in code or UI unless asked.
- Server routes: handle dynamic params as
  `{ params }: { params: Promise<{ id: string }> }`.
- Prefer `prisma.X.upsert` over find + create/update — one query.
- For batches: parallel upserts with per-row `try/catch`, not transaction
  arrays (so a single P2002 doesn't roll back the whole import).
- Don't add comments that restate what the code does. Comments should
  explain a non-obvious *why* (invariant, gotcha, link to incident).
- API routes are admin-gated by `session.user.role !== 'ADMIN'` checks at
  the top — never trust the client.

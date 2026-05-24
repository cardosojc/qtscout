# Architecture

Deeper notes for QTScout. Pair this with `CLAUDE.md` (operating notes / quick
reference). When something here drifts from the code, the code wins — update
this file or delete the stale section.

## Top-level layout

```
src/
├── app/
│   ├── (app)/                    # Authenticated, sidebar-shell pages
│   │   ├── meetings/             # CA / RD minutes
│   │   ├── documents/            # Ofício / Circular / OS (read + create non-OS)
│   │   ├── ordem-servico/        # Item logging + OS generation
│   │   ├── membros/              # Scout CRUD + SIIE member import
│   │   ├── profile/              # Per-user signature, roles, section
│   │   ├── settings/             # Numbering, users (ADMIN-only)
│   │   └── search/               # Full-text meeting search
│   ├── api/                      # Route handlers, mirrors the (app) tree
│   ├── auth/                     # Sign-in / sign-up
│   ├── .well-known/              # Vercel flags discovery
│   └── layout.tsx                # Fonts (Lato, Caveat), providers
├── components/
│   ├── ordem-servico/            # ItemForm with per-shape renderers
│   ├── membros/                  # ScoutForm
│   ├── documents/                # OrdemServicoView (legacy + new shape)
│   ├── editor/                   # TipTap wrapper
│   ├── providers/                # AuthProvider
│   └── ui/                       # Sidebar, breadcrumbs, toast, loading
├── lib/
│   ├── auth-helpers.ts           # getSession() (cached, server-side)
│   ├── prisma.ts                 # Prisma singleton
│   ├── pdf-generator.ts          # Puppeteer headless: meetings + documents
│   ├── ordem-permissions.ts      # canManageItem(), allowedCategoriesFor()
│   ├── ordem-assembler.ts        # OrdemItem[] → OrdemServicoData snapshot
│   ├── ordem-resolver.ts         # Batch resolve scout/profile refs
│   ├── siie-import.ts            # SIIE scouts xlsx → ScoutImportPayload
│   ├── siie-atividades-import.ts # SIIE activities xlsx → ActivityPayload
│   └── supabase/                 # client.ts, server.ts, middleware.ts
└── types/                        # Domain types
```

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
  └──< ScoutLeader (responsible leaders — UI not yet built)

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

1. User signs in via Supabase Auth (email/password). Session cookies are
   set by `@supabase/ssr` (no Next middleware doing this).
2. Server pages/routes call `getSession()` which:
   - Reads the user from Supabase (cached via `cache()` per request).
   - Joins to the `Profile` row (Prisma) by Supabase user id.
   - Returns `{ user: { id, email, name, username, role } }` or `null`.
3. Client uses `useAuth()` which calls `/api/auth/profile`.

There is **no per-route middleware**. Each route checks `session` and
`session.user.role` directly. This is intentional — keeps things explicit
and avoids hidden behavior.

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
3. resolveRefs(items)  ─────►  one query for scouts, one for profiles
4. assembleOrdemServico(items, periodo, refs)
     │  fold each item into the matching OrdemServicoData bucket
     │  (see ordem-item.ts comment header for the full mapping)
     └─ snapshot is plain strings (resolved names), not refs
5. Auto-include admissions:
     for each admitted scout in [from, to]:
       data.efetivo.admissao[section].push(scoutLabel(scout))
6. Transaction:
     a) DocumentSequence.upsert       (next OS number, type=ORDEM_SERVICO year=0)
     b) Document.create               (content = JSON.stringify(assembled))
     c) OrdemItem.updateMany          (includedInOsId = doc.id) — locks them
7. Return { id, identifier, itemCount, autoAdmissions }
```

The snapshot is immutable from then on. Items already `includedInOsId`
return 409 from PATCH/DELETE — preserves the OS document's historical
accuracy. The OS PDF renderer reads only `Document.content`; the original
items are not consulted at render time.

## PDF rendering

Single browser launch per request, ~5–8 s cold on Vercel:

- Local dev: `puppeteer` (full bundle).
- Production (Vercel): `puppeteer-core` + `@sparticuz/chromium-min`
  (Chromium binary fetched from GitHub release at startup).

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

1. Edit `prisma/schema.prisma`.
2. Author `prisma/migrations/<ts>_<name>/migration.sql` manually.
3. Execute via Supabase MCP + insert into `_prisma_migrations` in the
   same statement.
4. `npx prisma generate`.
5. **Restart the dev server.** Turbopack caches `@prisma/client`.

The schema is the source of truth, the migrations are the audit trail —
they're applied in the same transaction so the two stay in sync, but the
canonical "what fields exist" answer comes from the schema file.

## Feature flags

Three booleans via `@flags-sdk/vercel`, default `true`:

- `oficio-enabled`
- `circular-enabled`
- `ordem-servico-enabled`

Read server-side in `(app)/layout.tsx` and passed down to the sidebar +
documents list as `enabledDocTypes`. The OS flag also controls visibility
of the `/ordem-servico` nav entry. The Vercel Flags dashboard owns the
overrides.

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

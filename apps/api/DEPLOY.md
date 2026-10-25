# QTScout — deploy runbook (Cloudflare)

Everything runs on Cloudflare, on one hostname behind Cloudflare Access:

| Piece | What | Config |
|-------|------|--------|
| `qtscout-web` | Next.js (OpenNext) Worker on `qtscout.cardosojcs.org` | `apps/web/wrangler.jsonc` |
| `qtscout-api` | FastAPI Python Worker, no public route | `apps/api/wrangler.jsonc` |
| `qtscout` | D1 database (binding `DB` on the API) | `apps/api/d1/migrations/` |
| Access app `qtscout` | One-time PIN login for the hostname; group `qtscout-users` | Zero Trust dashboard / API |

The web Worker forwards `/api/*` to the API over the `API` service binding
(`apps/web/worker.ts`). The API also uses Browser Run (`BROWSER`, PDFs) and
Workers AI (`AI`).

## API Worker

From `apps/api/` (wrangler comes from the repo root's `node_modules`; log in
once with `npx wrangler login`):

```bash
# Schema changes first (new files in d1/migrations/):
npx wrangler d1 migrations apply qtscout --remote

# Secret (once, or when the token rotates). Needs Access: Organizations,
# Identity Providers, and Groups (Edit) — used for user create/delete.
npx wrangler secret put CF_API_TOKEN

uv run pywrangler deploy
```

Non-secret settings (`AUTH_MODE`, `ACCESS_*`, `CF_ACCOUNT_ID`,
`ACCESS_GROUP_ID`) are `vars` in `wrangler.jsonc`. The Worker refuses requests
if `AUTH_MODE=access` lacks `ACCESS_TEAM_DOMAIN`/`ACCESS_AUD`.

Deploy the API before a web change that depends on it: the web's service
binding needs `qtscout-api` to exist.

## Web Worker

Deployed by Workers Builds on push to `main` (`npm run deploy:cf` in
`apps/web` does the same by hand). No build-time env is needed for the API: it
is reached over the service binding.

## Data

D1 is the database. Backups: D1 Time Travel restores to any minute in the last
30 days (`npx wrangler d1 time-travel restore qtscout --timestamp …`); for an
off-platform copy, `npx wrangler d1 export qtscout --remote --output qtscout.sql`.

`scripts/pg_to_d1.py` is the one-off copy from the old Supabase Postgres (kept
for the record; see its docstring).

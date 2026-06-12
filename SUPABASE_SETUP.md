# Supabase Setup

QTScout uses one Supabase project for both Postgres and Auth, shared by the web
app (`apps/web`) and the FastAPI backend (`apps/api`). This covers provisioning
the project and wiring credentials. For running the app see the root
[`README.md`](README.md); for the backend/DB see
[`apps/api/README.md`](apps/api/README.md) and [`apps/api/DEPLOY.md`](apps/api/DEPLOY.md).

## 1. Create a Supabase Project

1. Go to [supabase.com](https://supabase.com) and create a new project.
2. Choose a region close to your users **and to where the API is deployed**
   (e.g. EU West / `eu-west-1` for Portugal). The API ↔ DB round-trip dominates
   request latency, so co-locating them matters.
3. Set a secure database password.
4. Wait for the project to finish provisioning (~2 minutes).

## 2. Get Your Credentials

From the Supabase Dashboard:

- **Project Settings > API > Project URL** → `SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_URL`
- **Project Settings > API > Publishable API Key** → `SUPABASE_PUBLISHABLE_KEY` / `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- **Project Settings > API > Secret API Key** → `SUPABASE_SECRET_KEY`
- **Database > Connection string > Transaction pooler (port 6543)** → `DATABASE_URL` (append `?pgbouncer=true`)
- **Database > Connection string > Direct (port 5432)** → `DIRECT_URL` (Alembic only)

## 3. Configure environment files

Credentials live in two places (no single root `.env` anymore):

- **Web** — `apps/web/.env.local`: `NEXT_PUBLIC_SUPABASE_URL`,
  `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`, and
  `NEXT_PUBLIC_API_URL` (the FastAPI base URL).
- **API** — `apps/api/.env`: `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`,
  `SUPABASE_SECRET_KEY`, `DATABASE_URL`, `DIRECT_URL`, `WEB_ORIGIN`. Start from
  [`apps/api/.env.example`](apps/api/.env.example).

## 4. Database schema & migrations

The schema is managed by **Alembic** in `apps/api/migrations/` (it was originally
created by Prisma and is now baseline-stamped — no DDL runs on the existing
tables). To apply new model changes:

```bash
cd apps/api
uv run alembic revision --autogenerate -m "…"   # against DIRECT_URL
uv run alembic upgrade head
```

Meeting types (`CA`, `RD`) and the e2e test user are provisioned by the e2e setup
(`e2e/global.setup.ts`); there is no standalone seed script.

## 5. Configure Auth Settings

In the Supabase Dashboard under **Authentication > Providers**:

- Ensure the **Email** provider is enabled.
- Optionally disable "Confirm email" for development (Authentication > Settings).

To customise the Portuguese email templates (Authentication > Email Templates):

- **Confirm signup**: "Confirme o seu email"
- **Reset password**: "Redefinir a sua palavra-passe"

## 6. Run the app

See [`README.md`](README.md) — start the FastAPI service (`apps/api`) and the web
app (`apps/web`) together, with the web's `NEXT_PUBLIC_API_URL` pointing at the API.

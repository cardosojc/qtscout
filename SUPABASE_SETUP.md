# Supabase Setup

## 1. Create a Supabase Project

1. Go to [supabase.com](https://supabase.com) and create a new project
2. Choose a region close to you (e.g., EU West for Portugal)
3. Set a secure database password
4. Wait for the project to finish provisioning (~2 minutes)

## 2. Get Your Credentials

From the Supabase Dashboard:

- **Project Settings > API > Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
- **Project Settings > API > Publishable API Key** → `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- **Project Settings > API > Secret API Key** → `SUPABASE_SECRET_KEY`
- **Project Settings > Database > Connection string > URI (Transaction/Session pooler)** → `DATABASE_URL` (append `?pgbouncer=true`)
- **Project Settings > Database > Connection string > URI (Direct)** → `DIRECT_URL`

## 3. Configure `.env`

Edit `.env` with your credentials:

```env
NEXT_PUBLIC_SUPABASE_URL="https://xxxxx.supabase.co"
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY="sb_publishable_..."
SUPABASE_SECRET_KEY="sb_secret_..."

DATABASE_URL="postgresql://postgres.xxxxx:PASSWORD@aws-0-eu-west-1.pooler.supabase.com:6543/postgres?pgbouncer=true"
DIRECT_URL="postgresql://postgres.xxxxx:PASSWORD@aws-0-eu-west-1.pooler.supabase.com:5432/postgres"
```

## 4. Push the Database Schema

```bash
npx prisma generate
npx prisma db push
```

## 5. Seed Meeting Types

```bash
npm run db:seed
```

## 6. Configure Auth Settings (Optional)

In the Supabase Dashboard under **Authentication > Providers**:

- Ensure **Email** provider is enabled
- Optionally disable "Confirm email" for development (Authentication > Settings > Email Auth)

To customize email templates in Portuguese, go to **Authentication > Email Templates**:

- **Confirm signup**: "Confirme o seu email"
- **Reset password**: "Redefinir a sua palavra-passe"

## 7. Start the App

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and register a new user.

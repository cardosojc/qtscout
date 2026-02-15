# QTScout

Meeting minutes management system for Agrupamento 61 - Santa Maria dos Olivais (CNE).

## Prerequisites

- [Node.js](https://nodejs.org/) (v18+)
- A [Supabase](https://supabase.com/) project (free tier works)

## Quick Start

1. Create a Supabase project at [supabase.com](https://supabase.com/)
2. Copy your credentials:

```bash
cp .env.example .env
# Edit .env with your Supabase URL, anon key, service role key, and database URLs
```

3. Run the app:

```bash
./start-dev.sh
```

To also seed the database with meeting types:

```bash
./start-dev.sh --seed
```

The app will be available at [http://localhost:3000](http://localhost:3000).

## Manual Setup

```bash
# 1. Create your environment file
cp .env.example .env
# Edit .env with Supabase credentials

# 2. Install dependencies
npm install

# 3. Generate Prisma client and push schema
npx prisma generate
npx prisma db push

# 4. (Optional) Seed the database
npm run db:seed

# 5. Start the dev server
npm run dev
```

## Available Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start development server (Turbopack) |
| `npm run build` | Production build |
| `npm run start` | Start production server |
| `npm run lint` | Run ESLint |
| `npm run db:push` | Push Prisma schema to database |
| `npm run db:seed` | Seed database with initial data |
| `npm run db:migrate` | Run Prisma migrations |

## Environment Variables

Copy `.env.example` to `.env` and configure:

| Variable | Description |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase publishable key (client-side) |
| `SUPABASE_SECRET_KEY` | Supabase secret key (server-side only) |
| `DATABASE_URL` | Supabase PostgreSQL pooler connection string |
| `DIRECT_URL` | Supabase PostgreSQL direct connection string (for migrations) |

## Tech Stack

- **Framework:** Next.js 15 with React 19
- **Language:** TypeScript 5
- **Database:** Supabase PostgreSQL with Prisma ORM
- **Auth:** Supabase Auth (@supabase/ssr)
- **Styling:** Tailwind CSS 4
- **Editor:** TipTap rich text editor
- **PDF:** Puppeteer

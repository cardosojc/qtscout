#!/usr/bin/env bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

info()  { echo -e "${GREEN}[INFO]${NC} $1"; }
warn()  { echo -e "${YELLOW}[WARN]${NC} $1"; }
error() { echo -e "${RED}[ERROR]${NC} $1"; exit 1; }

command -v npm >/dev/null 2>&1 || error "npm is not installed. Please install Node.js first."

# Setup .env if missing
if [ ! -f .env ]; then
  warn ".env file not found. Creating from .env.example..."
  cp .env.example .env
  info "Created .env file. Edit it with your Supabase credentials before continuing."
  exit 0
fi

# Install dependencies if needed
if [ ! -d node_modules ]; then
  info "Installing dependencies..."
  npm install
else
  info "Dependencies already installed. Skipping npm install."
fi

# Generate Prisma client and push schema
info "Generating Prisma client..."
npx prisma generate

info "Pushing database schema to Supabase..."
npx prisma db push

# Seed database (only if --seed flag is passed)
if [ "$1" = "--seed" ]; then
  info "Seeding database..."
  npm run db:seed
fi

# Start dev server
info "Starting Next.js dev server..."
npm run dev

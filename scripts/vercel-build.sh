#!/usr/bin/env bash
# Vercel / CI build for GarmentLoop ERP.
# Migrates when DATABASE_URL is present; always generates Prisma Client and builds Next.js.
set -euo pipefail

if [ -n "${DATABASE_URL:-}" ]; then
  echo "DATABASE_URL detected — running prisma migrate deploy"
  npx prisma migrate deploy
else
  echo "WARNING: DATABASE_URL is not set — skipping migrate deploy"
  echo "Add DATABASE_URL in Vercel project settings to enable Neon/Postgres."
fi

npx prisma generate
npx next build

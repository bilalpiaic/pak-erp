#!/usr/bin/env bash
# Vercel / CI build for GarmentLoop ERP.
# Migrates when DATABASE_URL is present; always generates Prisma Client and builds Next.js.
set -euo pipefail

# Neon pooled URLs (…-pooler…) do not support Postgres advisory locks used by
# `prisma migrate deploy`. Prefer DIRECT_URL, otherwise strip `-pooler` from the host.
migrate_database_url() {
  local url="${DIRECT_URL:-${DATABASE_URL:-}}"
  if [ -z "$url" ]; then
    echo ""
    return
  fi
  if [[ "$url" == *"-pooler."* ]]; then
    url="${url//-pooler./.}"
  fi
  echo "$url"
}

if [ -n "${DATABASE_URL:-}" ]; then
  MIGRATE_URL="$(migrate_database_url)"
  echo "DATABASE_URL detected — running prisma migrate deploy"
  if [ -n "${DIRECT_URL:-}" ]; then
    echo "Using DIRECT_URL for migrations"
  elif [[ "${DATABASE_URL}" == *"-pooler."* ]]; then
    echo "Using non-pooler host derived from DATABASE_URL for migrations"
  fi
  DATABASE_URL="$MIGRATE_URL" npx prisma migrate deploy
else
  echo "WARNING: DATABASE_URL is not set — skipping migrate deploy"
  echo "Add DATABASE_URL in Vercel project settings to enable Neon/Postgres."
fi

npx prisma generate
npx next build

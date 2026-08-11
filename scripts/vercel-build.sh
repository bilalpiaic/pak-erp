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

  set +e
  MIGRATE_OUT="$(DATABASE_URL="$MIGRATE_URL" npx prisma migrate deploy 2>&1)"
  MIGRATE_CODE=$?
  set -e
  echo "$MIGRATE_OUT"

  if [ "$MIGRATE_CODE" -ne 0 ]; then
    echo "migrate deploy failed (exit $MIGRATE_CODE) — checking whether schema is already up to date"
    set +e
    STATUS_OUT="$(DATABASE_URL="$MIGRATE_URL" npx prisma migrate status 2>&1)"
    STATUS_CODE=$?
    set -e
    echo "$STATUS_OUT"
    if echo "$STATUS_OUT" | grep -qiE 'Database schema is up to date|No pending migrations'; then
      echo "No pending migrations — continuing build"
    elif echo "$MIGRATE_OUT" | grep -qi 'P1002' && echo "$STATUS_OUT" | grep -qiE 'Following migration.*have not yet been applied'; then
      echo "ERROR: Pending migrations could not acquire advisory lock (P1002)."
      exit "$MIGRATE_CODE"
    elif echo "$MIGRATE_OUT" | grep -qi 'P1002'; then
      # Lock timeout with no clear pending list — continue so deploys are not blocked
      # when the migration history is already applied (common on Neon after parallel builds).
      echo "WARNING: Advisory lock timeout (P1002). Continuing build; verify migrations manually if schema changed."
    else
      exit "$MIGRATE_CODE"
    fi
  fi
else
  echo "WARNING: DATABASE_URL is not set — skipping migrate deploy"
  echo "Add DATABASE_URL in Vercel project settings to enable Neon/Postgres."
fi

npx prisma generate
npx next build

#!/usr/bin/env bash
# Idempotent repository bootstrap for the GarmentLoop ERP Cloud Agent environment.
# Provisions a user-owned PostgreSQL cluster, installs Node dependencies, generates
# the Prisma client, and syncs the schema. Safe to run repeatedly.
#
# The environment base image must provide the PostgreSQL server package
# (postgresql / postgresql-contrib) and Node 22; this script initializes and
# manages a per-user cluster on top of it.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

# Locate the PostgreSQL binaries (version-agnostic across images).
PGBIN="$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | sort -V | tail -n1)"
export PATH="$PGBIN:$PATH"
export PGDATA="$HOME/pgdata"
DB_USER="$(id -un)"
DB_NAME="garmentloop"

# Initialize a local cluster once. Trust auth is fine for an isolated dev VM.
if [ ! -f "$PGDATA/PG_VERSION" ]; then
  initdb -U "$DB_USER" -A trust --auth-host=trust --auth-local=trust >/dev/null
  {
    echo "listen_addresses = 'localhost'"
    echo "port = 5432"
    echo "unix_socket_directories = '/tmp'"
  } >> "$PGDATA/postgresql.conf"
fi

# Start PostgreSQL if it is not already running (data dir persists across boots).
if ! pg_ctl -D "$PGDATA" status >/dev/null 2>&1; then
  pg_ctl -D "$PGDATA" -l "$HOME/pg.log" -w start
fi

# Create the application database if it does not exist yet.
if ! psql -h /tmp -U "$DB_USER" -d postgres -tAc \
    "SELECT 1 FROM pg_database WHERE datname='$DB_NAME'" | grep -q 1; then
  createdb -h /tmp -U "$DB_USER" "$DB_NAME"
fi

# Generate / refresh local .env so DATABASE_URL matches this user-owned cluster.
EXPECTED_DATABASE_URL="postgresql://$DB_USER@localhost:5432/$DB_NAME?schema=public"
if [ ! -f .env ] || ! grep -q "DATABASE_URL=\"$EXPECTED_DATABASE_URL\"" .env; then
  cat > .env <<EOF
DATABASE_URL="$EXPECTED_DATABASE_URL"
AUTH_SECRET="dev-secret-not-for-production-change-me"
NEXT_PUBLIC_APP_NAME="GarmentLoop ERP"
NEXT_PUBLIC_CURRENCY="PKR"
EOF
fi

# Install dependencies (runs `prisma generate` via postinstall), migrate, and seed.
npm ci
npx prisma migrate deploy
npx prisma db seed

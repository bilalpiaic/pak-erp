#!/usr/bin/env bash
# Per-boot startup for the GarmentLoop ERP Cloud Agent environment.
# Ensures the local PostgreSQL server is running, then returns. Idempotent.
set -euo pipefail

PGBIN="$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | sort -V | tail -n1)"
export PATH="$PGBIN:$PATH"
export PGDATA="$HOME/pgdata"

if ! pg_ctl -D "$PGDATA" status >/dev/null 2>&1; then
  pg_ctl -D "$PGDATA" -l "$HOME/pg.log" -w start
fi

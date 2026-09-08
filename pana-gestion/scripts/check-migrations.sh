#!/usr/bin/env bash
#
# Aplica las migraciones sobre una base PostgreSQL limpia y corre las pruebas
# del modelo y de RLS.
#
# Con Docker instalado, `supabase db reset` es la forma fiel de probar contra
# el mismo PostgreSQL que usa Supabase. Este script existe para los entornos
# sin Docker (CI incluido): levanta un PostgreSQL propio, simula lo poco que
# aporta Supabase (schema auth, auth.uid(), los tres roles) y verifica que las
# reglas de seguridad realmente bloquean lo que dicen bloquear.
#
#   ./scripts/check-migrations.sh                 # levanta y apaga su propio PostgreSQL
#   DATABASE_URL=postgres://... ./scripts/...     # usa una base existente
#
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

PORT="${PGPORT:-54329}"
OWN_SERVER=0
CLUSTER="${PANA_PGDATA:-/var/lib/postgresql/pana-check}"
PGBIN="$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | sort -V | tail -1 || true)"

cleanup() {
  if [ "$OWN_SERVER" = "1" ]; then
    su postgres -c "PATH=$PGBIN:\$PATH pg_ctl -D $CLUSTER stop -m immediate" >/dev/null 2>&1 || true
  fi
}
trap cleanup EXIT

if [ -z "${DATABASE_URL:-}" ]; then
  if [ -z "$PGBIN" ]; then
    echo "No encontré PostgreSQL. Instalá postgresql o pasá DATABASE_URL." >&2
    exit 2
  fi
  rm -rf "$CLUSTER"
  mkdir -p "$CLUSTER"
  chown postgres:postgres "$CLUSTER"
  chmod 700 "$CLUSTER"
  su postgres -c "PATH=$PGBIN:\$PATH initdb -D $CLUSTER -U postgres --auth=trust" >/dev/null
  su postgres -c "PATH=$PGBIN:\$PATH pg_ctl -D $CLUSTER -o '-p $PORT -k /tmp' -l $CLUSTER/server.log start -w" >/dev/null
  OWN_SERVER=1
  export PGHOST=/tmp PGPORT="$PORT" PGUSER=postgres
  psql -q -c "drop database if exists pana_check" postgres
  psql -q -c "create database pana_check" postgres
  DATABASE_URL="postgres://postgres@/pana_check?host=/tmp&port=$PORT"
fi

run() { psql -q -v ON_ERROR_STOP=1 -d "$DATABASE_URL" -f "$1" >/dev/null; }

echo "→ arnés"
run tests/db/00_harness.sql

echo "→ migraciones"
for file in supabase/migrations/*.sql; do
  # El cron necesita pg_cron y pg_net, que solo existen en Supabase.
  case "$file" in *_cron.sql) echo "   omitida $(basename "$file") (requiere pg_cron)"; continue;; esac
  echo "   $(basename "$file")"
  run "$file"
done

echo "→ datos de prueba"
run tests/db/10_fixtures.sql

echo "→ pruebas del modelo"
run tests/db/20_model.sql

echo "→ pruebas de seguridad (RLS)"
run tests/db/30_rls.sql

echo
psql -d "$DATABASE_URL" -P pager=off -c \
  "select case when passed then '  ok  ' else ' FALLA' end as estado, name as prueba, detail as detalle
     from t.results order by id;"

FAILED=$(psql -tA -d "$DATABASE_URL" -c "select count(*) from t.results where not passed")
TOTAL=$(psql -tA -d "$DATABASE_URL" -c "select count(*) from t.results")

if [ "$FAILED" != "0" ]; then
  echo "✗ $FAILED de $TOTAL pruebas fallaron"
  exit 1
fi

echo "✓ $TOTAL pruebas de base de datos en verde"

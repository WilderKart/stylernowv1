#!/usr/bin/env bash
# Corre todas las suites tests/sql/*.sql sobre la base `limpia` (sin datos) del Docker local de pruebas. Cada suite termina en ROLLBACK.
# Salida: TSV  resultado<TAB>suite<TAB>última línea relevante.   Uso: bash scripts/entorno-local/sql-tests.sh [salida.tsv]
# El resultado se decide SOLO por el código de salida de psql (ON_ERROR_STOP): 0 = OK. Nunca por el texto, porque un error de
# conexión o de sintaxis podría no coincidir con el filtro y pasar por OK.
set -uo pipefail
cd "$(dirname "$0")/../.."
C=supabase_db_stylernow-cierre; DB="${DB:-limpia}"; OUT="${1:-/dev/stdout}"; : > "$OUT"
TMP=$(mktemp)
docker exec "$C" psql -U postgres -d "$DB" -Atc "select 1" > /dev/null 2>&1 || { echo "ABORTA: la base $DB no existe" >&2; exit 2; }

correr() { # lee SQL por stdin; deja la salida en $TMP y devuelve el código de psql
  docker exec -i "$C" psql -U postgres -d "$DB" -v ON_ERROR_STOP=1 -q > "$TMP" 2>&1
}

for f in tests/sql/*.sql; do
  n=$(basename "$f" .sql)
  case "$n" in hotfix_staff_nulo_previo|hotfix_staff_nulo_posterior) continue;; esac
  tr -d '\r' < "$f" | correr; rc=$?
  o=$(grep -E "ERROR|FALLA|PASARON|OK " "$TMP" | tail -1 | cut -c1-160)
  if [ $rc -eq 0 ]; then r=OK; else r=FALLA; fi
  printf "%s\t%s\t%s\n" "$r" "$n" "$o" >> "$OUT"
done

cat tests/sql/hotfix_staff_nulo_previo.sql supabase/scripts/hotfix_2026_11_12_autorizacion_staff_nulo.sql tests/sql/hotfix_staff_nulo_posterior.sql | tr -d '\r' | correr; rc=$?
o=$(grep -E "ERROR|NOTICE" "$TMP" | tail -1 | cut -c1-160)
if [ $rc -eq 0 ]; then r=OK; else r=FALLA; fi
printf "%s\t%s\t%s\n" "$r" hotfix_staff_nulo_orquestado "$o" >> "$OUT"
rm -f "$TMP"

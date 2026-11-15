#!/usr/bin/env bash
# Aplica TODAS las migraciones del repositorio, en orden, a la base LOCAL de pruebas (solo Docker local).
# Por qué no `supabase db reset`:
#  1) En Windows Git extrae los .sql con CRLF (core.autocrlf=true; en el repositorio están en LF). El cuerpo de las
#     funciones queda con CR y la migración 114 falla ("No se pudo parchear crear_plan_membresia"). Aquí se quita el CR.
#  2) La CLI omite 091b_*.sql (no cumple "<timestamp>_nombre.sql"), que producción SÍ tiene aplicada.
set -euo pipefail
CONTENEDOR="${CONTENEDOR:-supabase_db_stylernow-cierre}"
DIR="${1:-supabase/migrations}"
case "$CONTENEDOR" in *cierre*) ;; *) echo "RECHAZADO: el contenedor debe ser el de pruebas (*cierre*)"; exit 2;; esac
host=$(docker port "$CONTENEDOR" 5432 | head -1)
case "$host" in *55322*) ;; *) echo "RECHAZADO: la base no es la local de pruebas (puerto 55322)"; exit 2;; esac
ok=0
for f in $(ls "$DIR"/*.sql | LC_ALL=C sort); do
  if ! docker exec -i "$CONTENEDOR" psql -U postgres -v ON_ERROR_STOP=1 -q -o /dev/null -f - < <(tr -d '\r' < "$f") 2> /tmp/mig_err.txt; then
    echo "FALLA: $f"; head -5 /tmp/mig_err.txt; exit 1
  fi
  ok=$((ok+1))
done
echo "migraciones aplicadas: $ok"

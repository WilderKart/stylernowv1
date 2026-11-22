#!/bin/bash
# Corre las suites SQL y los scripts .sh de tests/sql SECUENCIALMENTE (nunca en paralelo) contra la base LOCAL y comprueba que
# NINGUNA deje residuos en la configuración compartida (planes, precios, características, configuración de plataforma, adicionales,
# ciclo/suscripción, países, textos legales, etc.). Toma una foto (hash por tabla) antes y después de cada suite y al total.
#   bash tests/run-sql-suites.sh                      # SQL + scripts que no necesitan cuentas
#   CUENTAS=<archivo correo=contraseña> ANON_DESDE=<archivo con NEXT_PUBLIC_SUPABASE_ANON_KEY="..."> bash tests/run-sql-suites.sh
#      (con ambas variables también corre los scripts HTTP; nunca se imprimen claves ni tokens)
# Salida: tabla suite | resultado | residuo. Código de salida: 1 si ALGUNA suite cambió la configuración compartida (o si STRICT=1 y alguna suite falla).
# Las suites rojas ya conocidas (migraciones de otras ramas sin aplicar, SuperSU único) se reportan como FALLA, no se ocultan.
set -u
cd "$(dirname "$0")/.."
DB="docker exec -i supabase_db_stylernow psql -U postgres -d postgres -v ON_ERROR_STOP=1 -q"
SQLT="docker exec -i supabase_db_stylernow psql -U postgres -d postgres -At"
LOGS=${LOGS:-/tmp/run-sql-suites}; mkdir -p "$LOGS"
TABLAS="addon_precio adicional_config adicional_estado_def adicional_precio_plan adicional_transicion ai_modelo_config configuracion_plataforma pais plan plan_caracteristica plan_funcion_ia plan_precio referido_config texto_legal whatsapp_config"

foto() {  # hash por tabla de configuración compartida (incluye updated_at: un cambio restaurado a mano igual deja huella)
  local t sal=""
  for t in $TABLAS; do
    h=$($SQLT -c "select coalesce(md5(string_agg(x::text, '|' order by x::text)), 'vacia') from public.$t x" 2>/dev/null || echo "sin_tabla")
    sal+="$t=$h"$'\n'
  done
  printf '%s' "$sal"
}
diff_fotos() { diff <(printf '%s' "$1") <(printf '%s' "$2") | grep '^[<>]' | sed 's/=.*//' | sort -u | tr -d '<> ' | tr '\n' ',' ; }

TOTAL_ANTES=$(foto)
FILAS=(); RESIDUOS=0; FALLAS=0

correr() {  # correr <nombre> <comando...>
  local nombre=$1; shift
  local a d res resid
  a=$(foto)
  if "$@" > "$LOGS/$nombre.log" 2>&1; then res="PASA"; else res="FALLA"; FALLAS=$((FALLAS+1)); fi
  d=$(foto)
  if [ "$a" == "$d" ]; then resid="no"; else resid="SI: $(diff_fotos "$a" "$d")"; RESIDUOS=$((RESIDUOS+1)); fi
  FILAS+=("$(printf '%-44s %-6s %s' "$nombre" "$res" "$resid")")
  echo "${FILAS[-1]}"
}

echo "suite                                        result residuo"
for f in tests/sql/*.sql; do
  n=$(basename "$f" .sql)
  case "$n" in hotfix_staff_nulo_previo|hotfix_staff_nulo_posterior) continue;; esac   # se corren con su .sh
  case "$n" in roles_163_normalizacion) continue;; esac                              # necesita su .sh (inyecta la migración)
  correr "$n" bash -c "$DB < '$f'"
done
correr roles_163_normalizacion bash tests/sql/roles_163_normalizacion.sh
correr hotfix_staff_nulo_verificacion bash tests/sql/hotfix_staff_nulo_verificacion.sh
correr f1b_compat_control_negativo bash tests/sql/f1b_compat_control_negativo.sh
correr roles_151_concurrencia bash tests/sql/roles_158_concurrencia.sh
[ -f tests/sql/adicionales_169_concurrencia.sh ] && correr adicionales_170_concurrencia bash tests/sql/adicionales_169_concurrencia.sh
if [ -n "${CUENTAS:-}" ] && [ -n "${ANON_DESDE:-}" ]; then
  for s in roles_http adicionales_http restringida_http; do [ -f "tests/sql/$s.sh" ] && correr "$s" bash "tests/sql/$s.sh"; done
else
  echo "(scripts HTTP omitidos: faltan CUENTAS y ANON_DESDE)"
fi

TOTAL_DESPUES=$(foto)
echo "----"
if [ "$TOTAL_ANTES" == "$TOTAL_DESPUES" ]; then echo "CONFIGURACIÓN COMPARTIDA: idéntica antes y después de TODAS las suites"
else echo "CONFIGURACIÓN COMPARTIDA CAMBIÓ: $(diff_fotos "$TOTAL_ANTES" "$TOTAL_DESPUES")"; RESIDUOS=$((RESIDUOS+1)); fi
echo "suites con falla: $FALLAS · suites con residuo: $RESIDUOS · logs en $LOGS"
[ "$RESIDUOS" -eq 0 ] || exit 1
[ "${STRICT:-0}" = 1 ] && [ "$FALLAS" -gt 0 ] && exit 1
exit 0

#!/bin/bash
# Control negativo de f1b_compat_codigo_vs_base.sql (solo base LOCAL, todo dentro de la transacción de la suite, que termina en ROLLBACK):
# se inyecta, tras su `begin;`, la eliminación de funciones que el código usa; la suite DEBE fallar en cada caso.
cd "$(dirname "$0")/../.." || exit 2
DB="docker exec -i supabase_db_stylernow psql -U postgres -d postgres -v ON_ERROR_STOP=1 -q"
SUITE=tests/sql/f1b_compat_codigo_vs_base.sql
mal=0
caso() {  # caso <etiqueta> <sql a inyectar> <texto esperado en el error>
  salida=$(sed "0,/^begin;\$/s||begin; $2|" $SUITE | $DB 2>&1); rc=$?
  if [ $rc -ne 0 ] && [[ "$salida" == *"$3"* ]]; then echo "  ok   $1: la suite FALLÓ como debía"
  else echo "  FALLA $1: la suite NO detectó el cambio (rc=$rc)"; mal=1; fi
}
echo "== Control negativo =="
caso "función de la matriz eliminada (crear_grupo_familiar)" "drop function public.crear_grupo_familiar;" "contrato matriz"
caso "RPC del código eliminada (aceptar_invitacion_staff)" "drop function public.aceptar_invitacion_staff;" "aceptar_invitacion_staff: la función NO existe"
caso "firma sin el argumento que envía el código (cambiar_rol_equipo)" "drop function public.cambiar_rol_equipo(uuid, text); create function public.cambiar_rol_equipo(p_otro uuid) returns void language sql as 'select';" "cambiar_rol_equipo"
caso "permiso retirado a todos (cupo_plan_negocio)" "revoke all on function public.cupo_plan_negocio(uuid) from public, anon, authenticated, service_role;" "cupo_plan_negocio: ningún rol"
echo "== Suite sin alteraciones (debe pasar) =="
$DB < $SUITE > /dev/null 2>&1 && echo "  ok   la suite pasa" || { echo "  FALLA la suite sin alteraciones no pasa"; mal=1; }
[ $mal -eq 0 ] && echo "OK: control negativo" || echo "FALLA: control negativo"
exit $mal

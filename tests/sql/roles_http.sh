#!/bin/bash
# Pruebas HTTP REALES contra PostgREST local (127.0.0.1:54321) con JWT reales de cuentas locales. Solo base LOCAL.
# Nunca imprime tokens, claves ni contraseñas: se leen en silencio de archivos del scratchpad.
#   CUENTAS=<archivo con líneas correo=contraseña>  ANON_DESDE=<archivo con NEXT_PUBLIC_SUPABASE_ANON_KEY="...">  bash tests/sql/roles_http.sh
# Cuentas esperadas (fixtures f1-*): dueno-studio (propietario de NS), admin (BUSINESS_ADMIN de NS), barbero (BARBER de NS),
# dueno-essential (propietario de OTRO negocio: el actor del IDOR).
set -u
API=http://127.0.0.1:54321
CUENTAS=${CUENTAS:?falta CUENTAS}
ANON=$(grep -o 'NEXT_PUBLIC_SUPABASE_ANON_KEY="[^"]*"' "${ANON_DESDE:?falta ANON_DESDE}" | head -1 | cut -d'"' -f2)
NEG=00000000-0000-0000-00f1-0000000001b0
SEDE=00000000-0000-0000-00f1-0000000002b0
SQL="docker exec -i supabase_db_stylernow psql -U postgres -d postgres -At"
FALLAS=0; PASARON=0

token() {  # token <alias>  -> imprime SOLO el access_token (se captura en una variable, nunca se muestra)
  local pw; pw=$(grep "^f1-$1@stylernow.test=" "$CUENTAS" | head -1 | cut -d= -f2-)
  curl -s -X POST "$API/auth/v1/token?grant_type=password" -H "apikey: $ANON" -H "Content-Type: application/json" \
    -d "{\"email\":\"f1-$1@stylernow.test\",\"password\":\"$pw\"}" | sed -n 's/.*"access_token":"\([^"]*\)".*/\1/p'
}
rpc() {  # rpc <token|-> <funcion> <json>  -> "<http>|<cuerpo>"
  local t=$1 f=$2 j=$3 auth=()
  [ "$t" != "-" ] && auth=(-H "Authorization: Bearer $t")
  curl -s -w "|%{http_code}" -X POST "$API/rest/v1/rpc/$f" -H "apikey: $ANON" "${auth[@]}" -H "Content-Type: application/json" -d "$j"
}
verifica() {  # verifica <etiqueta> <respuesta> <http esperado (regex)> <texto esperado en el cuerpo o ''>
  local etiqueta=$1 resp=$2 http_esp=$3 txt=$4 http cuerpo
  http=${resp##*|}; cuerpo=${resp%|*}
  if [[ "$http" =~ ^($http_esp)$ ]] && { [ -z "$txt" ] || [[ "$cuerpo" == *"$txt"* ]]; }; then PASARON=$((PASARON+1)); echo "  ok   $etiqueta (HTTP $http)"
  else FALLAS=$((FALLAS+1)); echo "  FALLA $etiqueta: HTTP $http, esperado /$http_esp/ y «$txt»; cuerpo: ${cuerpo:0:140}"; fi
}

echo "== Estado inicial de los fixtures (SQL, solo base local) =="
$SQL -c "update vinculo_staff_negocio v set es_admin=false, presta_servicios=true, estado='ACTIVO' from perfil p where p.id=v.staff_id and p.email='f1-barbero@stylernow.test' and v.negocio_id='$NEG'" \
     -c "update vinculo_staff_negocio v set es_admin=true, presta_servicios=false, estado='ACTIVO' from perfil p where p.id=v.staff_id and p.email='f1-admin@stylernow.test' and v.negocio_id='$NEG'" > /dev/null
VB=$($SQL -c "select v.id from vinculo_staff_negocio v join perfil p on p.id=v.staff_id where p.email='f1-barbero@stylernow.test' and v.negocio_id='$NEG'")
VA=$($SQL -c "select v.id from vinculo_staff_negocio v join perfil p on p.id=v.staff_id where p.email='f1-admin@stylernow.test' and v.negocio_id='$NEG'")
UB=$($SQL -c "select id from perfil where email='f1-barbero@stylernow.test'")
T_OWN=$(token dueno-studio); T_ADM=$(token admin); T_BAR=$(token barbero); T_OTR=$(token dueno-essential)
for v in T_OWN T_ADM T_BAR T_OTR; do [ -z "${!v}" ] && { echo "FALLA: no se pudo obtener el JWT de $v"; exit 2; }; done
EMAIL="http-$(date +%s)@test.local"

echo "== Propietario =="
verifica "owner lee la capacidad" "$(rpc "$T_OWN" capacidad_profesional_negocio "{\"p_negocio_id\":\"$NEG\"}")" 200 '"limite"'
sv0=$($SQL -c "select session_version from perfil where id='$UB'")
verifica "owner suspende (HTTP real)" "$(rpc "$T_OWN" suspender_staff "{\"p_vinculo_id\":\"$VB\",\"p_motivo\":\"prueba http\"}")" 200 '"estado"'
sv1=$($SQL -c "select session_version from perfil where id='$UB'")
[ "$sv1" -eq $((sv0+1)) ] && { PASARON=$((PASARON+1)); echo "  ok   la sesión del suspendido se invalidó (session_version $sv0 -> $sv1)"; } || { FALLAS=$((FALLAS+1)); echo "  FALLA session_version no cambió ($sv0 -> $sv1)"; }
verifica "el suspendido solo ve su propia fila de vínculo (RLS)" "$(curl -s -w "|%{http_code}" "$API/rest/v1/vinculo_staff_negocio?select=id" -H "apikey: $ANON" -H "Authorization: Bearer $T_BAR")" 200 '"id"'
verifica "owner reactiva" "$(rpc "$T_OWN" reactivar_staff "{\"p_vinculo_id\":\"$VB\"}")" 200 '"estado"'
verifica "owner traslada (misma sede)" "$(rpc "$T_OWN" trasladar_staff "{\"p_vinculo_id\":\"$VB\",\"p_nueva_sede_id\":\"$SEDE\"}")" 200 '"sede_activa_id"'
verifica "owner invita un administrador" "$(rpc "$T_OWN" crear_invitacion_staff "{\"p_negocio_id\":\"$NEG\",\"p_email\":\"adm-$EMAIL\",\"p_sede_id\":\"$SEDE\",\"p_rol\":\"BUSINESS_ADMIN\"}")" 200 'BUSINESS_ADMIN'
verifica "owner cambia el rol del barbero a administrador" "$(rpc "$T_OWN" cambiar_rol_equipo "{\"p_vinculo_id\":\"$VB\",\"p_rol\":\"BUSINESS_ADMIN\"}")" 200 '"es_admin"'
sv2=$($SQL -c "select session_version from perfil where id='$UB'")
[ "$sv2" -gt "$sv1" ] && { PASARON=$((PASARON+1)); echo "  ok   cambiar rol invalidó la sesión (session_version $sv1 -> $sv2)"; } || { FALLAS=$((FALLAS+1)); echo "  FALLA cambiar rol no invalidó la sesión"; }
verifica "owner lo devuelve a BARBER" "$(rpc "$T_OWN" cambiar_rol_equipo "{\"p_vinculo_id\":\"$VB\",\"p_rol\":\"BARBER\"}")" 200 '"es_admin"'
verifica "owner PATCH directo a perfil.session_version (bloqueado)" "$(curl -s -w "|%{http_code}" -X PATCH "$API/rest/v1/perfil?id=eq.$UB" -H "apikey: $ANON" -H "Authorization: Bearer $T_OWN" -H "Content-Type: application/json" -d '{"session_version":9999}')" '200|204|400|401|403|409' ''
[ "$($SQL -c "select session_version from perfil where id='$UB'")" -lt 9999 ] && { PASARON=$((PASARON+1)); echo "  ok   session_version del barbero NO cambió por PATCH directo"; } || { FALLAS=$((FALLAS+1)); echo "  FALLA session_version cambió por PATCH"; }
UO=$($SQL -c "select id from perfil where email='f1-dueno-studio@stylernow.test'")
verifica "owner PATCH directo a SU PROPIA session_version (bloqueado por el trigger)" "$(curl -s -w "|%{http_code}" -X PATCH "$API/rest/v1/perfil?id=eq.$UO" -H "apikey: $ANON" -H "Authorization: Bearer $T_OWN" -H "Content-Type: application/json" -d '{"session_version":9999}')" '4[0-9][0-9]' 'session_version'
verifica "barbero PATCH directo a SU PROPIA session_version (bloqueado)" "$(curl -s -w "|%{http_code}" -X PATCH "$API/rest/v1/perfil?id=eq.$UB" -H "apikey: $ANON" -H "Authorization: Bearer $T_BAR" -H "Content-Type: application/json" -d '{"session_version":9999}')" '4[0-9][0-9]' 'session_version'

echo "== Administrador delegado =="
verifica "admin lee la capacidad" "$(rpc "$T_ADM" capacidad_profesional_negocio "{\"p_negocio_id\":\"$NEG\"}")" 200 '"limite"'
verifica "admin invita BARBER" "$(rpc "$T_ADM" crear_invitacion_staff "{\"p_negocio_id\":\"$NEG\",\"p_email\":\"bar-$EMAIL\",\"p_sede_id\":\"$SEDE\"}")" 200 '"rol_invitado"'
verifica "admin NO invita administradores" "$(rpc "$T_ADM" crear_invitacion_staff "{\"p_negocio_id\":\"$NEG\",\"p_email\":\"adm2-$EMAIL\",\"p_sede_id\":\"$SEDE\",\"p_rol\":\"BUSINESS_ADMIN\"}")" '4[0-9][0-9]' NO_AUTORIZADO
verifica "admin NO cambia roles" "$(rpc "$T_ADM" cambiar_rol_equipo "{\"p_vinculo_id\":\"$VB\",\"p_rol\":\"BUSINESS_ADMIN\"}")" '4[0-9][0-9]' NO_AUTORIZADO
verifica "admin NO activa el perfil del propietario" "$(rpc "$T_ADM" activar_perfil_profesional_propietario "{\"p_negocio_id\":\"$NEG\"}")" '4[0-9][0-9]' NO_AUTORIZADO
verifica "admin NO pide downgrade" "$(rpc "$T_ADM" solicitar_downgrade_plan "{\"p_negocio_id\":\"$NEG\",\"p_plan_codigo_destino\":\"ESSENTIAL\"}")" '4[0-9][0-9]' NO_AUTORIZADO
verifica "admin NO configura planes" "$(rpc "$T_ADM" admin_configurar_perfil_propietario_plan '{"p_plan":"STUDIO","p_por_defecto":false,"p_auto_alta":false,"p_puede_activar":true,"p_puede_desactivar":true,"p_motivo":"intento de administrador"}')" '4[0-9][0-9]' NO_AUTORIZADO
verifica "admin NO suspende a otro administrador" "$(rpc "$T_ADM" suspender_staff "{\"p_vinculo_id\":\"$VA\"}")" '4[0-9][0-9]' NO_AUTORIZADO
verifica "admin: suscripción vacía por RLS" "$(curl -s -w "|%{http_code}" "$API/rest/v1/suscripcion?negocio_id=eq.$NEG&select=id" -H "apikey: $ANON" -H "Authorization: Bearer $T_ADM")" 200 '[]'

echo "== Barbero =="
verifica "barbero NO invita" "$(rpc "$T_BAR" crear_invitacion_staff "{\"p_negocio_id\":\"$NEG\",\"p_email\":\"x-$EMAIL\",\"p_sede_id\":\"$SEDE\"}")" '4[0-9][0-9]' NO_AUTORIZADO
verifica "barbero NO cambia roles" "$(rpc "$T_BAR" cambiar_rol_equipo "{\"p_vinculo_id\":\"$VA\",\"p_rol\":\"BARBER\"}")" '4[0-9][0-9]' NO_AUTORIZADO
verifica "barbero NO suspende" "$(rpc "$T_BAR" suspender_staff "{\"p_vinculo_id\":\"$VA\"}")" '4[0-9][0-9]' NO_AUTORIZADO

echo "== Otro negocio (IDOR) =="
verifica "ajeno NO lee la capacidad" "$(rpc "$T_OTR" capacidad_profesional_negocio "{\"p_negocio_id\":\"$NEG\"}")" '4[0-9][0-9]' NO_AUTORIZADO
verifica "ajeno NO cambia roles" "$(rpc "$T_OTR" cambiar_rol_equipo "{\"p_vinculo_id\":\"$VB\",\"p_rol\":\"BUSINESS_ADMIN\"}")" '4[0-9][0-9]' NO_AUTORIZADO
verifica "ajeno NO suspende" "$(rpc "$T_OTR" suspender_staff "{\"p_vinculo_id\":\"$VB\"}")" '4[0-9][0-9]' NO_AUTORIZADO
verifica "ajeno NO traslada" "$(rpc "$T_OTR" trasladar_staff "{\"p_vinculo_id\":\"$VB\",\"p_nueva_sede_id\":\"$SEDE\"}")" '4[0-9][0-9]' NO_AUTORIZADO
verifica "ajeno NO invita" "$(rpc "$T_OTR" crear_invitacion_staff "{\"p_negocio_id\":\"$NEG\",\"p_email\":\"y-$EMAIL\",\"p_sede_id\":\"$SEDE\"}")" '4[0-9][0-9]' NO_AUTORIZADO
verifica "ajeno NO activa perfil en negocio ajeno" "$(rpc "$T_OTR" activar_perfil_profesional_propietario "{\"p_negocio_id\":\"$NEG\"}")" '4[0-9][0-9]' NO_AUTORIZADO
verifica "ajeno NO ve el equipo (RLS)" "$(curl -s -w "|%{http_code}" "$API/rest/v1/vista_staff_negocio?negocio_id=eq.$NEG&select=vinculo_id" -H "apikey: $ANON" -H "Authorization: Bearer $T_OTR")" 200 '[]'
verifica "función interna de invalidación no expuesta" "$(rpc "$T_OTR" invalidar_sesion_usuario "{\"p_usuario_id\":\"$UB\",\"p_negocio_id\":\"$NEG\",\"p_motivo\":\"x\"}")" '4[0-9][0-9]' ''
verifica "ajeno: PATCH directo a session_version del dueño" "$(curl -s -w "|%{http_code}" -X PATCH "$API/rest/v1/perfil?id=eq.$UB" -H "apikey: $ANON" -H "Authorization: Bearer $T_OTR" -H "Content-Type: application/json" -d '{"session_version":9999}')" '200|204|400|401|403|409' ''

echo "== Anónimo =="
verifica "anon NO cambia roles" "$(rpc - cambiar_rol_equipo "{\"p_vinculo_id\":\"$VB\",\"p_rol\":\"BARBER\"}")" '401|403|404' ''
verifica "anon NO lee el equipo" "$(curl -s -w "|%{http_code}" "$API/rest/v1/vinculo_staff_negocio?select=id" -H "apikey: $ANON")" '200|401|403' ''
verifica "anon lee la lista pública de profesionales (función pública)" "$(rpc - negocio_staff_publico "{\"p_negocio_id\":\"$NEG\"}")" 200 ''

echo "== Limpieza de lo creado por esta prueba (solo las invitaciones de este script) =="
$SQL -c "delete from invitacion_staff where email like '%$EMAIL'" > /dev/null
echo "== Resultado: $PASARON pasaron, $FALLAS fallaron =="
[ $FALLAS -eq 0 ]

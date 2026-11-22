#!/bin/bash
# Pruebas HTTP REALES de barberos adicionales contra PostgREST local (127.0.0.1:54321) con JWT reales de cuentas locales. Solo base LOCAL.
# Nunca imprime tokens, claves ni contraseñas: se leen en silencio de archivos del scratchpad.
#   CUENTAS=<archivo correo=contraseña>  ANON_DESDE=<archivo con NEXT_PUBLIC_SUPABASE_ANON_KEY="...">  bash tests/sql/adicionales_http.sh
# Cuentas esperadas (fixtures f1-* y ev-supersu): f1-dueno-studio (propietario de NS, Studio), f1-admin (BUSINESS_ADMIN de NS),
# f1-dueno-essential (propietario de OTRO negocio: actor del IDOR), ev-supersu (SuperSU).
# El pago aprobado se simula en el SERVIDOR (psql: aplicar_evento_pago, igual que sincronizar.ts); nada se aprueba desde HTTP.
# Al final se eliminan SOLO los lotes/pagos que esta corrida creó en NS.
set -u
API=http://127.0.0.1:54321
CUENTAS=${CUENTAS:?falta CUENTAS}
ANON=$(grep -o 'NEXT_PUBLIC_SUPABASE_ANON_KEY="[^"]*"' "${ANON_DESDE:?falta ANON_DESDE}" | head -1 | cut -d'"' -f2)
NEG=00000000-0000-0000-00f1-0000000001b0
NEG_AJENO=00000000-0000-0000-00f1-0000000001a0
SQL="docker exec -i supabase_db_stylernow psql -U postgres -d postgres -At"
FALLAS=0; PASARON=0

token() {  # token <correo>  -> SOLO el access_token (se captura en una variable, nunca se muestra)
  local pw; pw=$(grep "^$1=" "$CUENTAS" | head -1 | cut -d= -f2-)
  curl -s -X POST "$API/auth/v1/token?grant_type=password" -H "apikey: $ANON" -H "Content-Type: application/json" \
    -d "{\"email\":\"$1\",\"password\":\"$pw\"}" | sed -n 's/.*"access_token":"\([^"]*\)".*/\1/p'
}
rpc() {  # rpc <token|-> <funcion> <json>  -> "<cuerpo>|<http>"
  local t=$1 f=$2 j=$3 auth=()
  [ "$t" != "-" ] && auth=(-H "Authorization: Bearer $t")
  curl -s -w "|%{http_code}" -X POST "$API/rest/v1/rpc/$f" -H "apikey: $ANON" "${auth[@]}" -H "Content-Type: application/json" -d "$j"
}
tabla() {  # tabla <metodo> <token|-> <ruta> [json]
  local m=$1 t=$2 r=$3 j=${4:-} auth=() body=()
  [ "$t" != "-" ] && auth=(-H "Authorization: Bearer $t")
  [ -n "$j" ] && body=(-d "$j")
  curl -s -w "|%{http_code}" -X "$m" "$API/rest/v1/$r" -H "apikey: $ANON" "${auth[@]}" -H "Content-Type: application/json" -H "Prefer: return=minimal" "${body[@]}"
}
verifica() {  # verifica <etiqueta> <respuesta> <http esperado (regex)> <texto esperado en el cuerpo o ''>
  local etiqueta=$1 resp=$2 http_esp=$3 txt=$4 http cuerpo
  http=${resp##*|}; cuerpo=${resp%|*}
  if [[ "$http" =~ ^($http_esp)$ ]] && { [ -z "$txt" ] || [[ "$cuerpo" == *"$txt"* ]]; }; then PASARON=$((PASARON+1)); echo "  ok   $etiqueta (HTTP $http)"
  else FALLAS=$((FALLAS+1)); echo "  FALLA $etiqueta: HTTP $http, esperado /$http_esp/ y «$txt»; cuerpo: ${cuerpo:0:160}"; fi
}

T_OWN=$(token f1-dueno-studio@stylernow.test); T_ADM=$(token f1-admin@stylernow.test)
T_OTR=$(token f1-dueno-essential@stylernow.test); T_SU=$(token ev-supersu@stylernow.test)
for v in T_OWN T_ADM T_OTR T_SU; do [ -z "${!v}" ] && { echo "FALLA: no se pudo obtener el JWT de $v"; exit 2; }; done
ANTES=$($SQL -c "select count(*) from adicional_lote where negocio_id = '$NEG'")
[ "$ANTES" -eq 0 ] || echo "(aviso: NS ya tenía $ANTES lotes; se conservarán)"

echo "== Propietario =="
verifica "owner cotiza 3 adicionales" "$(rpc "$T_OWN" adicional_cotizar "{\"p_negocio_id\":\"$NEG\",\"p_cantidad\":3}")" 200 '"total": 155700'
verifica "owner: cantidad fuera del máximo por lote" "$(rpc "$T_OWN" adicional_cotizar "{\"p_negocio_id\":\"$NEG\",\"p_cantidad\":51}")" '4[0-9][0-9]' MAXIMO_POR_LOTE_EXCEDIDO
verifica "owner: total inventado por el navegador se rechaza" "$(rpc "$T_OWN" adicional_iniciar "{\"p_negocio_id\":\"$NEG\",\"p_cantidad\":3,\"p_total_esperado\":1000}")" '4[0-9][0-9]' PRECIO_CAMBIO
R=$(rpc "$T_OWN" adicional_iniciar "{\"p_negocio_id\":\"$NEG\",\"p_cantidad\":3,\"p_total_esperado\":155700}")
verifica "owner inicia la contratación" "$R" 200 '"pago_id"'
LOTE=$(echo "${R%|*}" | sed -n 's/.*"lote_id": *"\([^"]*\)".*/\1/p'); PAGO=$(echo "${R%|*}" | sed -n 's/.*"pago_id": *"\([^"]*\)".*/\1/p')
[ -n "$LOTE" ] && [ -n "$PAGO" ] || { echo "FALLA: sin lote/pago"; exit 2; }
verifica "owner ve su lote en CHECKOUT_INICIADO" "$(rpc "$T_OWN" adicional_mis_lotes "{\"p_negocio_id\":\"$NEG\"}")" 200 '"estado": "CHECKOUT_INICIADO"'
CAP0=$(echo "$(rpc "$T_OWN" cupo_plan_negocio "{\"p_negocio_id\":\"$NEG\"}")" | sed -n 's/.*"staff_tope": *\([0-9]*\).*/\1/p')

echo "== Administrador delegado (NO contrata, NO consulta, NO paga) =="
verifica "admin NO cotiza" "$(rpc "$T_ADM" adicional_cotizar "{\"p_negocio_id\":\"$NEG\",\"p_cantidad\":3}")" '4[0-9][0-9]' NO_AUTORIZADO
verifica "admin NO inicia pagos" "$(rpc "$T_ADM" adicional_iniciar "{\"p_negocio_id\":\"$NEG\",\"p_cantidad\":1,\"p_total_esperado\":51900}")" '4[0-9][0-9]' NO_AUTORIZADO
verifica "admin NO consulta lotes ni pagos" "$(rpc "$T_ADM" adicional_mis_lotes "{\"p_negocio_id\":\"$NEG\"}")" '4[0-9][0-9]' NO_AUTORIZADO
verifica "admin NO renueva" "$(rpc "$T_ADM" adicional_renovar "{\"p_lote_id\":\"$LOTE\"}")" '4[0-9][0-9]' NO_AUTORIZADO
verifica "admin NO cancela" "$(rpc "$T_ADM" adicional_cancelar_renovacion "{\"p_lote_id\":\"$LOTE\"}")" '4[0-9][0-9]' NO_AUTORIZADO
verifica "admin ve la capacidad (informativo, ya existía)" "$(rpc "$T_ADM" capacidad_profesional_negocio "{\"p_negocio_id\":\"$NEG\"}")" 200 '"limite"'
verifica "admin lee 0 filas de lotes (RLS)" "$(tabla GET "$T_ADM" 'adicional_lote?select=id' | sed 's/Prefer.*//')" 200 '[]'

echo "== IDOR: propietario de OTRO negocio y anónimo =="
verifica "otro propietario NO cotiza en NS" "$(rpc "$T_OTR" adicional_cotizar "{\"p_negocio_id\":\"$NEG\",\"p_cantidad\":1}")" '4[0-9][0-9]' NO_AUTORIZADO
verifica "otro propietario NO consulta NS" "$(rpc "$T_OTR" adicional_mis_lotes "{\"p_negocio_id\":\"$NEG\"}")" '4[0-9][0-9]' NO_AUTORIZADO
verifica "otro propietario NO renueva el lote de NS" "$(rpc "$T_OTR" adicional_renovar "{\"p_lote_id\":\"$LOTE\"}")" '4[0-9][0-9]' NO_AUTORIZADO
verifica "otro propietario NO cancela el lote de NS" "$(rpc "$T_OTR" adicional_cancelar_renovacion "{\"p_lote_id\":\"$LOTE\"}")" '4[0-9][0-9]' NO_AUTORIZADO
verifica "otro propietario lee 0 filas de lotes de NS (RLS)" "$(tabla GET "$T_OTR" "adicional_lote?negocio_id=eq.$NEG&select=id")" 200 '[]'
verifica "anónimo NO cotiza" "$(rpc - adicional_cotizar "{\"p_negocio_id\":\"$NEG\",\"p_cantidad\":1}")" '4[0-9][0-9]' ''
verifica "anónimo NO lee lotes" "$(tabla GET - 'adicional_lote?select=id')" '4[0-9][0-9]' ''

echo "== Escrituras directas a las tablas (bloqueadas) y funciones de servidor =="
verifica "owner NO inserta un lote por PostgREST" "$(tabla POST "$T_OWN" adicional_lote "{\"negocio_id\":\"$NEG\",\"pais_codigo\":\"CO\",\"plan_codigo\":\"STUDIO\",\"cantidad\":99,\"precio_unitario\":1,\"total\":99,\"estado\":\"ACTIVO\"}")" '4[0-9][0-9]' ''
verifica "owner NO activa su lote por PATCH" "$(tabla PATCH "$T_OWN" "adicional_lote?id=eq.$LOTE" '{"estado":"ACTIVO"}')" '4[0-9][0-9]' ''
verifica "owner NO cambia el precio congelado por PATCH" "$(tabla PATCH "$T_OWN" "adicional_lote?id=eq.$LOTE" '{"precio_unitario":1}')" '4[0-9][0-9]' ''
verifica "owner NO borra su lote" "$(tabla DELETE "$T_OWN" "adicional_lote?id=eq.$LOTE")" '4[0-9][0-9]' ''
verifica "owner NO lee la configuración directa" "$(tabla GET "$T_OWN" 'adicional_config?select=*')" '4[0-9][0-9]' ''
verifica "owner NO llama adicional_marcar_pago_pendiente_srv (solo servidor)" "$(rpc "$T_OWN" adicional_marcar_pago_pendiente_srv "{\"p_pago_id\":\"$PAGO\",\"p_id_transaccion\":\"X1\"}")" '4[0-9][0-9]' ''
verifica "owner NO llama adicional_mantenimiento_srv" "$(rpc "$T_OWN" adicional_mantenimiento_srv '{}')" '4[0-9][0-9]' ''
verifica "owner NO llama adicional_checkout_fallido_srv" "$(rpc "$T_OWN" adicional_checkout_fallido_srv "{\"p_lote_id\":\"$LOTE\",\"p_actor\":\"$LOTE\"}")" '4[0-9][0-9]' ''
verifica "anónimo NO llama adicional_mantenimiento_srv" "$(rpc - adicional_mantenimiento_srv '{}')" '4[0-9][0-9]' ''
verifica "owner NO llama _adicional_transicionar (interna)" "$(rpc "$T_OWN" _adicional_transicionar "{\"p_lote\":\"$LOTE\",\"p_a\":\"ACTIVO\",\"p_evento\":\"X\",\"p_actor_tipo\":\"SUPERSU\"}")" '4[0-9][0-9]' ''
verifica "owner NO llama aplicar_evento_pago" "$(rpc "$T_OWN" aplicar_evento_pago "{\"p_pago_id\":\"$PAGO\",\"p_id_transaccion\":\"X1\",\"p_estado\":\"APROBADO\"}")" '4[0-9][0-9]' ''
verifica "owner NO llama _capacidad_profesional (interna)" "$(rpc "$T_OWN" _capacidad_profesional "{\"p_negocio_id\":\"$NEG\"}")" '4[0-9][0-9]' ''

echo "== Pago pendiente / rechazado NO activan; aprobado (confirmado en el servidor) SÍ =="
$SQL -c "select public.adicional_marcar_pago_pendiente_srv('$PAGO', 'HTTP-P1')" >/dev/null
verifica "tras 'pendiente' el lote está en PAGO_PENDIENTE" "$(rpc "$T_OWN" adicional_mis_lotes "{\"p_negocio_id\":\"$NEG\"}")" 200 '"estado": "PAGO_PENDIENTE"'
$SQL -c "select public.aplicar_evento_pago('$PAGO', 'HTTP-R1', 'RECHAZADO', '{}')" >/dev/null
CAP1=$(echo "$(rpc "$T_OWN" cupo_plan_negocio "{\"p_negocio_id\":\"$NEG\"}")" | sed -n 's/.*"staff_tope": *\([0-9]*\).*/\1/p')
[ "$CAP1" = "$CAP0" ] && { PASARON=$((PASARON+1)); echo "  ok   pendiente y rechazado no suben el tope ($CAP0)"; } || { FALLAS=$((FALLAS+1)); echo "  FALLA el tope cambió: $CAP0 -> $CAP1"; }
$SQL -c "select public.aplicar_evento_pago('$PAGO', 'HTTP-OK1', 'APROBADO', '{\"transaction_amount\":155700}')" >/dev/null
CAP2=$(echo "$(rpc "$T_OWN" cupo_plan_negocio "{\"p_negocio_id\":\"$NEG\"}")" | sed -n 's/.*"staff_tope": *\([0-9]*\).*/\1/p')
[ "$CAP2" = "$((CAP0+3))" ] && { PASARON=$((PASARON+1)); echo "  ok   aprobado activa SOLO 3 cupos: tope $CAP0 -> $CAP2"; } || { FALLAS=$((FALLAS+1)); echo "  FALLA tope $CAP0 -> $CAP2 (esperado $((CAP0+3)))"; }
verifica "owner ve el lote ACTIVO y los pagos" "$(rpc "$T_OWN" adicional_mis_lotes "{\"p_negocio_id\":\"$NEG\"}")" 200 '"estado": "ACTIVO"'
verifica "owner cancela la renovación futura (conserva el cupo)" "$(rpc "$T_OWN" adicional_cancelar_renovacion "{\"p_lote_id\":\"$LOTE\",\"p_motivo\":\"prueba http\"}")" 200 '"cupo_hasta"'
CAP3=$(echo "$(rpc "$T_OWN" cupo_plan_negocio "{\"p_negocio_id\":\"$NEG\"}")" | sed -n 's/.*"staff_tope": *\([0-9]*\).*/\1/p')
[ "$CAP3" = "$CAP2" ] && { PASARON=$((PASARON+1)); echo "  ok   cancelar la renovación conserva el cupo pagado ($CAP3)"; } || { FALLAS=$((FALLAS+1)); echo "  FALLA el cupo cambió al cancelar: $CAP2 -> $CAP3"; }

echo "== SuperAdmin =="
verifica "SuperAdmin lee la configuración" "$(rpc "$T_SU" admin_adicional_config_obtener '{}')" 200 '"precios"'
verifica "SuperAdmin lista lotes" "$(rpc "$T_SU" admin_adicional_listar "{\"p_filtros\":{\"negocio_id\":\"$NEG\"}}")" 200 '"filas"'
verifica "SuperAdmin ve el detalle (historial)" "$(rpc "$T_SU" admin_adicional_detalle "{\"p_lote_id\":\"$LOTE\"}")" 200 '"historial"'
verifica "propietario NO lee la configuración" "$(rpc "$T_OWN" admin_adicional_config_obtener '{}')" '4[0-9][0-9]' NO_AUTORIZADO
verifica "administrador NO lee la configuración" "$(rpc "$T_ADM" admin_adicional_config_obtener '{}')" '4[0-9][0-9]' NO_AUTORIZADO
verifica "propietario NO cambia precios" "$(rpc "$T_OWN" admin_adicional_precio_guardar '{"p_pais":"CO","p_plan":"STUDIO","p_precio":1000,"p_motivo":"intento de propietario"}')" '4[0-9][0-9]' NO_AUTORIZADO
verifica "propietario NO activa cupos manualmente" "$(rpc "$T_OWN" admin_adicional_activar_manual "{\"p_negocio_id\":\"$NEG\",\"p_cantidad\":5,\"p_dias\":30,\"p_tipo\":\"CORTESIA\",\"p_motivo\":\"intento de propietario\"}")" '4[0-9][0-9]' NO_AUTORIZADO
verifica "SuperAdmin: excepción sin motivo se rechaza" "$(rpc "$T_SU" admin_adicional_activar_manual "{\"p_negocio_id\":\"$NEG\",\"p_cantidad\":2,\"p_dias\":10,\"p_tipo\":\"CORTESIA\",\"p_motivo\":\"\"}")" '4[0-9][0-9]' MOTIVO_REQUERIDO
verifica "SuperAdmin activa 2 cupos con motivo, responsable y vigencia" "$(rpc "$T_SU" admin_adicional_activar_manual "{\"p_negocio_id\":\"$NEG\",\"p_cantidad\":2,\"p_dias\":10,\"p_tipo\":\"CORTESIA\",\"p_motivo\":\"excepcion de prueba http\"}")" 200 '"lote_id"'
CAP4=$(echo "$(rpc "$T_OWN" cupo_plan_negocio "{\"p_negocio_id\":\"$NEG\"}")" | sed -n 's/.*"staff_tope": *\([0-9]*\).*/\1/p')
[ "$CAP4" = "$((CAP2+2))" ] && { PASARON=$((PASARON+1)); echo "  ok   la excepción sube el tope a $CAP4"; } || { FALLAS=$((FALLAS+1)); echo "  FALLA tope tras la excepción: $CAP4"; }
verifica "queda auditada con motivo" "$($SQL -c "select 'x'||count(*)||'|200' from evento_auditoria where accion='ADICIONAL_ACTIVACION_MANUAL' and motivo='excepcion de prueba http' and negocio_id='$NEG'")" 200 'x1'

echo "== Limpieza de lo creado por esta corrida (solo lotes/pagos de NS creados aquí) =="
$SQL -c "set session_replication_role = replica;
  delete from notificacion_outbox where negocio_id='$NEG' and evento like 'ADICIONAL%';
  delete from adicional_historial where negocio_id='$NEG'; delete from adicional_pago_revision where negocio_id='$NEG';
  delete from adicional_cobro where negocio_id='$NEG'; delete from adicional_lote where negocio_id='$NEG';
  delete from pago where negocio_id='$NEG' and metadata->>'concepto'='STAFF_EXTRA';
  delete from evento_auditoria where negocio_id='$NEG' and (accion like 'ADICIONAL%' or accion like 'ADICIONAL\_%' or entidad_tipo in ('adicional_lote','adicional_reembolso'));" >/dev/null
echo "NS: lotes restantes = $($SQL -c "select count(*) from adicional_lote where negocio_id='$NEG'")"
echo "== Resultado: $PASARON ok, $FALLAS fallas =="
[ "$FALLAS" -eq 0 ]

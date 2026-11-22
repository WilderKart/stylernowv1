#!/bin/bash
# FASE 2B: pruebas HTTP REALES contra PostgREST local (127.0.0.1:54321) con JWT reales de cuentas locales. Solo base LOCAL.
# Nunca imprime tokens, claves ni contraseñas: se leen en silencio de archivos del scratchpad.
#   CUENTAS=<archivo correo=contraseña>  ANON_DESDE=<archivo con NEXT_PUBLIC_SUPABASE_ANON_KEY="...">  bash tests/sql/restringida_http.sh
# Usa los fixtures f1-*: dueno-studio (propietario de NS, el negocio que se restringe temporalmente), barbero (de NS) y dueno-essential
# (propietario de OTRO negocio: actor del IDOR y «cliente» de NS). La suscripción de NS se guarda y se RESTAURA al terminar (trap).
set -u
API=http://127.0.0.1:54321
CUENTAS=${CUENTAS:?falta CUENTAS}
ANON=$(grep -o 'NEXT_PUBLIC_SUPABASE_ANON_KEY="[^"]*"' "${ANON_DESDE:?falta ANON_DESDE}" | head -1 | cut -d'"' -f2)
NEG=00000000-0000-0000-00f1-0000000001b0
SEDE=00000000-0000-0000-00f1-0000000002b0
SQL="docker exec -i supabase_db_stylernow psql -U postgres -d postgres -At"
FALLAS=0; PASARON=0

token() {
  local pw; pw=$(grep "^f1-$1@stylernow.test=" "$CUENTAS" | head -1 | cut -d= -f2-)
  curl -s -X POST "$API/auth/v1/token?grant_type=password" -H "apikey: $ANON" -H "Content-Type: application/json" \
    -d "{\"email\":\"f1-$1@stylernow.test\",\"password\":\"$pw\"}" | sed -n 's/.*"access_token":"\([^"]*\)".*/\1/p'
}
rpc() { local t=$1 f=$2 j=$3 auth=(); [ "$t" != "-" ] && auth=(-H "Authorization: Bearer $t")
  curl -s -w "|%{http_code}" -X POST "$API/rest/v1/rpc/$f" -H "apikey: $ANON" "${auth[@]}" -H "Content-Type: application/json" -d "$j"; }
rest() { local t=$1 metodo=$2 ruta=$3 j=${4:-} auth=(); [ "$t" != "-" ] && auth=(-H "Authorization: Bearer $t")
  curl -s -w "|%{http_code}" -X "$metodo" "$API/rest/v1/$ruta" -H "apikey: $ANON" "${auth[@]}" -H "Content-Type: application/json" -H "Prefer: ${PREFER:-return=representation}" ${j:+-d "$j"}; }
verifica() { local etiqueta=$1 resp=$2 http_esp=$3 txt=$4 http cuerpo
  http=${resp##*|}; cuerpo=${resp%|*}
  if [[ "$http" =~ ^($http_esp)$ ]] && { [ -z "$txt" ] || [[ "$cuerpo" == *"$txt"* ]]; }; then PASARON=$((PASARON+1)); echo "  ok   $etiqueta (HTTP $http)"
  else FALLAS=$((FALLAS+1)); echo "  FALLA $etiqueta: HTTP $http, esperado /$http_esp/ y «$txt»; cuerpo: ${cuerpo:0:160}"; fi; }
no_contiene() { local etiqueta=$1 resp=$2 prohibido=$3
  if [[ "$resp" != *"$prohibido"* ]]; then PASARON=$((PASARON+1)); echo "  ok   $etiqueta"; else FALLAS=$((FALLAS+1)); echo "  FALLA $etiqueta: contiene «$prohibido»"; fi; }

# ── Guardar y restaurar la suscripción del negocio de prueba ──
ORIG=$($SQL -c "select row_to_json(s) from (select estado, plan_codigo, fecha_inicio_ciclo, fecha_proximo_cobro, prueba_inicio, prueba_fin, activacion_manual, manual_tipo, manual_hasta, manual_referencia, gracia_fin, suspendido_causa from suscripcion where negocio_id='$NEG') s")
CREADO_PRECIO=0
restaurar() {
  $SQL -c "update suscripcion set estado=(j->>'estado')::suscripcion_estado, plan_codigo=(j->>'plan_codigo')::plan_codigo, fecha_inicio_ciclo=(j->>'fecha_inicio_ciclo')::timestamptz, fecha_proximo_cobro=(j->>'fecha_proximo_cobro')::timestamptz, prueba_inicio=(j->>'prueba_inicio')::timestamptz, prueba_fin=(j->>'prueba_fin')::timestamptz, activacion_manual=(j->>'activacion_manual')::boolean, manual_tipo=j->>'manual_tipo', manual_hasta=(j->>'manual_hasta')::timestamptz, manual_referencia=j->>'manual_referencia', gracia_fin=(j->>'gracia_fin')::timestamptz, suspendido_causa=j->>'suspendido_causa' from (select '$ORIG'::jsonb j) x where negocio_id='$NEG'" > /dev/null
  $SQL -c "delete from servicio where negocio_id='$NEG' and nombre like 'HTTP restringida%'" > /dev/null 2>&1
  [ "$CREADO_PRECIO" = 1 ] && $SQL -c "delete from plan_precio where plan_codigo='STUDIO' and pais_codigo='CO' and precio_mensual=139900" > /dev/null 2>&1
  echo "(suscripción de NS restaurada)"
}
trap restaurar EXIT

dia_pagado() { $SQL -c "update suscripcion set estado='ACTIVA', fecha_inicio_ciclo=now()-make_interval(days=>$1-1), fecha_proximo_cobro=suscripcion_fecha_limite(now()-make_interval(days=>$1-1),30), prueba_inicio=null, prueba_fin=null, activacion_manual=false, manual_hasta=null, gracia_fin=null, suspendido_causa=null where negocio_id='$NEG'" > /dev/null; }
dia_prueba()  { $SQL -c "update suscripcion set estado='TRIAL', fecha_inicio_ciclo=now()-make_interval(days=>$1-1), prueba_inicio=now()-make_interval(days=>$1-1), prueba_fin=suscripcion_fecha_limite(now()-make_interval(days=>$1-1),14), fecha_proximo_cobro=suscripcion_fecha_limite(now()-make_interval(days=>$1-1),14), activacion_manual=false, manual_hasta=null, gracia_fin=null, suspendido_causa=null where negocio_id='$NEG'" > /dev/null; }

T_OWN=$(token dueno-studio); T_OTR=$(token dueno-essential); T_BAR=$(token barbero)
for v in T_OWN T_OTR T_BAR; do [ -z "${!v}" ] && { echo "FALLA: no se pudo obtener el JWT de $v"; exit 2; }; done
SERV=$($SQL -c "select id from servicio where negocio_id='$NEG' limit 1")

echo "== Negocio OPERATIVO (periodo pagado, día 30): el dueño opera con su JWT =="
dia_pagado 30
R=$(rest "$T_OWN" POST servicio "{\"negocio_id\":\"$NEG\",\"nombre\":\"HTTP restringida 1\",\"duracion_minutos\":30,\"precio_base\":15000}")
verifica "día 30: el dueño crea un servicio" "$R" 201 '"nombre":"HTTP restringida 1"'
verifica "día 30: estado operativo (dueño)" "$(rpc "$T_OWN" negocio_estado_operativo "{\"p_negocio_id\":\"$NEG\"}")" 200 '"estado": "PAGADO"'

echo "== Día 31 (gracia): sigue operando con aviso =="
dia_pagado 31
verifica "día 31: fase GRACIA" "$(rpc "$T_OWN" negocio_estado_operativo "{\"p_negocio_id\":\"$NEG\"}")" 200 '"estado": "GRACIA"'
verifica "día 31: aún crea servicios" "$(rest "$T_OWN" POST servicio "{\"negocio_id\":\"$NEG\",\"nombre\":\"HTTP restringida 2\",\"duracion_minutos\":30,\"precio_base\":15000}")" 201 ''

echo "== Día 32 (RESTRINGIDO): bloqueos por HTTP real =="
dia_pagado 32
verifica "estado operativo: restringido (dueño ve el motivo)" "$(rpc "$T_OWN" negocio_estado_operativo "{\"p_negocio_id\":\"$NEG\"}")" 200 'PERIODO_VENCIDO'
verifica "crear servicio bloqueado" "$(rest "$T_OWN" POST servicio "{\"negocio_id\":\"$NEG\",\"nombre\":\"HTTP restringida 3\",\"duracion_minutos\":30,\"precio_base\":15000}")" '400|403|409' SUSCRIPCION_RESTRINGIDA
[ -n "$SERV" ] && verifica "modificar PRECIO bloqueado" "$(rest "$T_OWN" PATCH "servicio?id=eq.$SERV" '{"precio_base":1}')" '400|403|409' SUSCRIPCION_RESTRINGIDA
[ -n "$SERV" ] && verifica "borrar servicio bloqueado" "$(rest "$T_OWN" DELETE "servicio?id=eq.$SERV")" '400|403|409' SUSCRIPCION_RESTRINGIDA
verifica "modificar datos del negocio bloqueado" "$(PREFER=return=minimal rest "$T_OWN" PATCH "negocio?id=eq.$NEG" '{"nombre":"Renombrado por el bloqueo"}')" '400|403|409' SUSCRIPCION_RESTRINGIDA
verifica "crear disponibilidad bloqueado" "$(rest "$T_OWN" POST disponibilidad "{\"vinculo_id\":\"$($SQL -c "select id from vinculo_staff_negocio where negocio_id='$NEG' and estado='ACTIVO' limit 1")\",\"sede_id\":\"$SEDE\",\"dia_semana\":1,\"hora_inicio\":\"06:00\",\"hora_fin\":\"06:30\"}")" '400|403|409' SUSCRIPCION_RESTRINGIDA
verifica "invitar profesional (RPC) bloqueado" "$(rpc "$T_OWN" crear_invitacion_staff "{\"p_negocio_id\":\"$NEG\",\"p_email\":\"http-restr-$(date +%s)@test.local\",\"p_sede_id\":\"$SEDE\",\"p_rol\":\"BARBER\"}")" '400|403|409' SUSCRIPCION_RESTRINGIDA
verifica "crear sede (RPC) bloqueado" "$(rpc "$T_OWN" crear_sede "{\"p_negocio_id\":\"$NEG\",\"p_nombre\":\"S2\",\"p_direccion\":\"Cra 2\",\"p_ciudad\":\"Cali\",\"p_horario_base\":{},\"p_latitud\":null,\"p_longitud\":null}")" '400|403|409' SUSCRIPCION_RESTRINGIDA
verifica "configurar anticipo (RPC) bloqueado" "$(rpc "$T_OWN" configurar_anticipo "{\"p_negocio_id\":\"$NEG\",\"p_modo\":\"PORCENTAJE\",\"p_pct\":10,\"p_monto_fijo\":null,\"p_minimo\":null,\"p_maximo\":null,\"p_pago_completo\":false,\"p_motivo\":\"prueba http restringida\"}")" '400|403|409' SUSCRIPCION_RESTRINGIDA
verifica "crear regalo/gift card (RPC comercial) bloqueado" "$(rpc "$T_OWN" crear_gift_card "{\"p_negocio_id\":\"$NEG\",\"p_monto\":50000,\"p_pin\":\"1234\"}")" '400|403|409' SUSCRIPCION_RESTRINGIDA
verifica "cita manual (RPC) bloqueada" "$(rpc "$T_OWN" crear_reserva_manual "{\"p_sede_id\":\"$SEDE\",\"p_servicio_ids\":[\"${SERV:-00000000-0000-0000-0000-000000000000}\"],\"p_hora_inicio\":\"2099-01-05T15:00:00-05:00\",\"p_cliente_id\":\"$($SQL -c "select id from perfil where email='f1-dueno-essential@stylernow.test'")\"}")" '400|403|409' SUSCRIPCION_RESTRINGIDA
echo "-- un CLIENTE (otro usuario autenticado) llamando RPC directo de reserva (marketplace) --"
verifica "reserva de cliente (crear_reserva_autorizada) bloqueada" "$(rpc "$T_OTR" crear_reserva_autorizada "{\"p_sede_id\":\"$SEDE\",\"p_servicio_ids\":[\"${SERV:-00000000-0000-0000-0000-000000000000}\"],\"p_hora_inicio\":\"2099-01-05T15:00:00-05:00\",\"p_autoriza_datos\":true}")" '400|403|409' SUSCRIPCION_RESTRINGIDA
verifica "crear_reserva directo (cerrada desde 144)" "$(rpc "$T_OTR" crear_reserva "{\"p_sede_id\":\"$SEDE\",\"p_servicio_ids\":[\"${SERV:-00000000-0000-0000-0000-000000000000}\"],\"p_hora_inicio\":\"2099-01-05T15:00:00-05:00\"}")" '401|403|404' ''
verifica "slots del negocio restringido: lista vacía" "$(rpc "$T_OTR" slots_disponibles "{\"p_sede_id\":\"$SEDE\",\"p_servicio_ids\":[\"${SERV:-00000000-0000-0000-0000-000000000000}\"],\"p_fecha\":\"$(date -d '+4 days' +%F)\"}")" 200 '[]'

echo "== Permitido con el negocio restringido =="
verifica "dueño consulta su histórico (reservas)" "$(rest "$T_OWN" GET "reserva?negocio_id=eq.$NEG&select=id&limit=1")" 200 ''
verifica "dueño consulta su suscripción (pantalla de suscripción)" "$(rest "$T_OWN" GET "suscripcion?negocio_id=eq.$NEG&select=estado")" 200 'estado'
verifica "profesional del negocio ve el estado" "$(rpc "$T_BAR" negocio_estado_operativo "{\"p_negocio_id\":\"$NEG\"}")" 200 'PERIODO_VENCIDO'
echo "-- pagar: la solicitud de pago NO la bloquea el estado restringido --"
HAY=$($SQL -c "select count(*) from plan_precio where plan_codigo='STUDIO' and pais_codigo='CO'")
if [ "$HAY" = 0 ]; then $SQL -c "insert into plan_precio (plan_codigo, pais_codigo, precio_mensual, es_desde, activo) values ('STUDIO','CO',139900,false,true)" > /dev/null; CREADO_PRECIO=1; fi
$SQL -c "delete from pago where negocio_id='$NEG' and tipo='SUSCRIPCION' and estado='PENDIENTE' and metadata->>'concepto'='PLAN' and created_at > now() - interval '5 minutes'" > /dev/null
R=$(rpc "$T_OWN" solicitar_pago_plan "{\"p_negocio_id\":\"$NEG\",\"p_plan_codigo\":\"STUDIO\",\"p_ciclo\":\"MENSUAL\"}")
no_contiene "solicitar_pago_plan no devuelve SUSCRIPCION_RESTRINGIDA" "$R" SUSCRIPCION_RESTRINGIDA
verifica "solicitar_pago_plan responde 200 (cobro del plan creado)" "$R" 200 'PLAN'
$SQL -c "delete from pago where negocio_id='$NEG' and tipo='SUSCRIPCION' and estado='PENDIENTE' and metadata->>'concepto'='PLAN' and created_at > now() - interval '5 minutes'" > /dev/null

echo "== IDOR y privacidad del estado =="
R=$(rpc "$T_OTR" negocio_estado_operativo "{\"p_negocio_id\":\"$NEG\"}")
verifica "otro negocio: solo ve operativo/estado" "$R" 200 'RESTRINGIDO'
no_contiene "otro negocio: NO ve el motivo" "$R" PERIODO_VENCIDO
no_contiene "otro negocio: NO ve fechas" "$R" limite_servicio
verifica "anónimo: ¿acepta reservas? (página pública)" "$(rpc - negocio_acepta_reservas "{\"p_negocio_id\":\"$NEG\"}")" 200 'false'
verifica "anónimo: no llama el detalle" "$(rpc - negocio_estado_operativo "{\"p_negocio_id\":\"$NEG\"}")" '401|403' ''
verifica "anónimo: no llama la función interna" "$(rpc - _estado_operativo_en "{\"p_negocio\":\"$NEG\",\"p_ahora\":\"2026-01-01T00:00:00Z\"}")" '401|403|404' ''
verifica "autenticado: no llama la función interna" "$(rpc "$T_OWN" _estado_operativo_en "{\"p_negocio\":\"$NEG\",\"p_ahora\":\"2026-01-01T00:00:00Z\"}")" '401|403|404' ''
verifica "autenticado: no llama la guardia" "$(rpc "$T_OWN" _exigir_operativo "{\"p_negocio_id\":\"$NEG\"}")" '401|403|404' ''
verifica "dueño no cambia la configuración de SuperAdmin" "$(rpc "$T_OWN" admin_set_config_suscripcion '{"p_periodo_dias":30,"p_prueba_gracia_dias":0,"p_gracia_permite_operar":true,"p_motivo":"intento del duenio"}')" '400|403' 'NO_AUTORIZADO'
verifica "dueño ajeno no puede crear servicios en NS (RLS)" "$(rest "$T_OTR" POST servicio "{\"negocio_id\":\"$NEG\",\"nombre\":\"HTTP restringida hack\",\"duracion_minutos\":30,\"precio_base\":1}")" '400|401|403' ''

echo "== Renovación: el pago confirmado restaura (se simula el pago confirmado por SQL como service_role) =="
$SQL -c "begin; select set_config('request.jwt.claims','{\"role\":\"service_role\"}',true); insert into pago (id, negocio_id, tipo, monto, estado, pasarela, metadata) values ('00000000-0000-0000-00f1-0000000009ff','$NEG','SUSCRIPCION',139900,'PENDIENTE','MERCADOPAGO','{\"concepto\":\"PLAN\",\"plan_codigo_nuevo\":\"STUDIO\",\"ciclo\":\"MENSUAL\"}'::jsonb); select aplicar_evento_pago('00000000-0000-0000-00f1-0000000009ff','http-restr-1','APROBADO','{}'::jsonb); commit;" > /dev/null 2>&1
verifica "tras el pago: estado PAGADO" "$(rpc "$T_OWN" negocio_estado_operativo "{\"p_negocio_id\":\"$NEG\"}")" 200 '"estado": "PAGADO"'
verifica "tras el pago: el dueño vuelve a crear servicios" "$(rest "$T_OWN" POST servicio "{\"negocio_id\":\"$NEG\",\"nombre\":\"HTTP restringida 4\",\"duracion_minutos\":30,\"precio_base\":15000}")" 201 ''
$SQL -c "delete from pago where id='00000000-0000-0000-00f1-0000000009ff'" > /dev/null 2>&1

echo; echo "RESULTADO: $PASARON pasaron, $FALLAS fallaron"
[ "$FALLAS" -eq 0 ]

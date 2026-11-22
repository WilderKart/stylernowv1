#!/bin/bash
# Concurrencia REAL de los barberos adicionales (migraciones 169-177). Solo contra la base LOCAL (supabase_db_stylernow).
# Crea fixtures CONFIRMADOS propios (prefijo 00f3-), los usa y los elimina al final; no toca datos de otros negocios. Uso:
#   bash tests/sql/adicionales_170_concurrencia.sh
# Escenarios (varias sesiones psql a la vez, cada una reteniendo su transacción 2 s para forzar el solapamiento):
#   A. Cupo con adicionales: Essential (límite 1) con un lote ACTIVO de 2 (tope 3) y 6 invitaciones simultáneas → exactamente 3 se crean y 3 reciben PLAN_LIMIT_EXCEEDED.
#   B. Webhook duplicado simultáneo: 5 sesiones aplican el MISMO pago aprobado → exactamente 1 activa, 4 son YA_PROCESADO; periodo_n = 1, tope = 1 + cantidad.
#   C. Contrataciones simultáneas: 5 sesiones llaman adicional_iniciar con la misma cantidad → un solo lote y un solo pago pendiente.
set -u
DB="docker exec -i supabase_db_stylernow psql -U postgres -d postgres -v ON_ERROR_STOP=1 -q"
DBT="docker exec -i supabase_db_stylernow psql -U postgres -d postgres -At"
OWNER='00000000-0000-0000-00f3-0000000000a1'
NEG='00000000-0000-0000-00f3-0000000001a0'
SEDE='00000000-0000-0000-00f3-0000000002a0'
FIN=0

limpiar() {
  $DB <<SQL
set session_replication_role = replica;
delete from public.notificacion_outbox where negocio_id = '$NEG';
delete from public.adicional_pago_revision where negocio_id = '$NEG';
delete from public.adicional_historial where negocio_id = '$NEG';
delete from public.adicional_cobro where negocio_id = '$NEG';
delete from public.adicional_lote where negocio_id = '$NEG';
delete from public.pago where negocio_id = '$NEG';
delete from public.invitacion_staff where negocio_id = '$NEG';
delete from public.evento_auditoria where negocio_id = '$NEG';
delete from public.suscripcion where negocio_id = '$NEG';
delete from public.wallet where negocio_id = '$NEG';
delete from public.sede where negocio_id = '$NEG';
delete from public.negocio where id = '$NEG';
delete from public.perfil where id = '$OWNER';
delete from auth.users where id = '$OWNER';
SQL
}

preparar() {
  limpiar >/dev/null 2>&1
  $DB <<SQL
insert into auth.users (id, email, aud, role, email_confirmed_at) values ('$OWNER', 'f3conc-owner@test.local', 'authenticated', 'authenticated', now()) on conflict (id) do nothing;
insert into public.perfil (id, nombre, email) values ('$OWNER', 'F3 conc owner', 'f3conc-owner@test.local') on conflict (id) do update set email = excluded.email;
insert into public.negocio (id, owner_user_id, nombre, slug, ciudad, pais_codigo, estado) values ('$NEG', '$OWNER', 'F3CONC', 'f3conc', 'Cali', 'CO', 'ACTIVO') on conflict (id) do nothing;
update public.negocio set plan_codigo = 'ESSENTIAL' where id = '$NEG';
delete from public.suscripcion where negocio_id = '$NEG';
insert into public.suscripcion (negocio_id, plan_codigo, estado, fecha_proximo_cobro, pais_codigo) values ('$NEG', 'ESSENTIAL', 'ACTIVA', now() + interval '20 days', 'CO');
insert into public.sede (id, negocio_id, nombre, direccion, ciudad, es_principal) values ('$SEDE', '$NEG', 'Sede C', 'Cra 1', 'Cali', true) on conflict (id) do nothing;
SQL
}

echo "== Escenario A: cupo con adicionales (Essential 1 + lote ACTIVO de 2 = 3), 6 invitaciones simultáneas =="
preparar || { echo "FALLA preparando"; exit 2; }
$DB -c "insert into public.adicional_lote (negocio_id, pais_codigo, plan_codigo, cantidad, precio_unitario, total, estado, origen, inicio_periodo_at, vigente_hasta, manual_tipo, manual_motivo, manual_por)
        values ('$NEG', 'CO', 'ESSENTIAL', 2, 0, 0, 'ACTIVO', 'MANUAL_SUPERADMIN', now(), now() + interval '30 days', 'CORTESIA', 'prueba de concurrencia', null)"
dir=$(mktemp -d)
for i in 1 2 3 4 5 6; do
  ( $DBT > "$dir/s$i.out" 2>&1 <<SQL
begin;
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', '$OWNER', 'role', 'authenticated')::text, true);
select 'CREADA' from public.crear_invitacion_staff('$NEG', 'f3conc$i@test.local', '$SEDE');
select pg_sleep(2);
commit;
SQL
  ) &
done
wait
CREADAS=$(cat "$dir"/s*.out | grep -c '^CREADA'); RECHAZADAS=$(cat "$dir"/s*.out | grep -c 'PLAN_LIMIT_EXCEEDED'); rm -rf "$dir"
echo "creadas=$CREADAS rechazadas_por_cupo=$RECHAZADAS (esperado 3 y 3)"
[ "$CREADAS" -eq 3 ] && [ "$RECHAZADAS" -eq 3 ] || FIN=1
OCUP=$($DBT -c "select (public._capacidad_profesional('$NEG') ->> 'ocupados')::int")
echo "ocupados al final=$OCUP (esperado 3, nunca más que el tope)"
[ "$OCUP" -eq 3 ] || FIN=1

echo "== Escenario B: webhook duplicado simultáneo (5 sesiones, mismo pago aprobado) =="
preparar || { echo "FALLA preparando"; exit 2; }
$DB <<SQL
begin;
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', '$OWNER', 'role', 'authenticated')::text, true);
select public.adicional_iniciar('$NEG', 3, 155700);
commit;
SQL
PAGO=$($DBT -c "select pago_id from public.adicional_cobro where negocio_id = '$NEG' and estado = 'PENDIENTE'")
dir=$(mktemp -d)
for i in 1 2 3 4 5; do
  ( $DBT > "$dir/s$i.out" 2>&1 <<SQL
begin;
select 'RES:' || coalesce(r ->> 'adicional', r ->> 'motivo') from (select public.aplicar_evento_pago('$PAGO'::uuid, 'MP-CONC-1', 'APROBADO', '{"transaction_amount":155700}'::jsonb) as r) x;
select pg_sleep(1);
commit;
SQL
  ) &
done
wait
ACTIV=$(cat "$dir"/s*.out | grep -c 'RES:ACTIVADO'); YA=$(cat "$dir"/s*.out | grep -c 'RES:YA_PROCESADO'); rm -rf "$dir"
PER=$($DBT -c "select periodo_n from public.adicional_lote where negocio_id = '$NEG'")
LIM=$($DBT -c "select (public._capacidad_profesional('$NEG') ->> 'limite')::int")
HIST=$($DBT -c "select count(*) from public.adicional_historial where negocio_id = '$NEG' and evento = 'ACTIVADO'")
echo "activaciones=$ACTIV ya_procesados=$YA periodo_n=$PER tope=$LIM historial_ACTIVADO=$HIST (esperado: 1 activación, periodo 1, tope 4, 1 fila de historial)"
[ "$ACTIV" -eq 1 ] && [ "$PER" -eq 1 ] && [ "$LIM" -eq 4 ] && [ "$HIST" -eq 1 ] || FIN=1

echo "== Escenario C: 5 contrataciones simultáneas con la misma cantidad =="
preparar || { echo "FALLA preparando"; exit 2; }
dir=$(mktemp -d)
for i in 1 2 3 4 5; do
  ( $DBT > "$dir/s$i.out" 2>&1 <<SQL
begin;
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', '$OWNER', 'role', 'authenticated')::text, true);
select 'INI:' || (public.adicional_iniciar('$NEG', 2, 103800) ->> 'reutilizado');
select pg_sleep(1);
commit;
SQL
  ) &
done
wait
NUEVOS=$(cat "$dir"/s*.out | grep -c 'INI:false'); REUT=$(cat "$dir"/s*.out | grep -c 'INI:true'); rm -rf "$dir"
LOTES=$($DBT -c "select count(*) from public.adicional_lote where negocio_id = '$NEG' and estado = 'CHECKOUT_INICIADO'")
PAGOS=$($DBT -c "select count(*) from public.pago where negocio_id = '$NEG' and estado = 'PENDIENTE'")
echo "nuevos=$NUEVOS reutilizados=$REUT lotes_abiertos=$LOTES pagos_pendientes=$PAGOS (esperado: 1 nuevo, 4 reutilizados, 1 lote, 1 pago)"
[ "$NUEVOS" -eq 1 ] && [ "$LOTES" -eq 1 ] && [ "$PAGOS" -eq 1 ] || FIN=1

echo "== Limpieza de fixtures propios =="
limpiar && echo "limpio"
if [ "$FIN" -eq 0 ]; then echo "CONCURRENCIA ADICIONALES: TODO OK"; else echo "CONCURRENCIA ADICIONALES: FALLA"; fi
exit $FIN

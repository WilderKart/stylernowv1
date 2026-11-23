#!/bin/bash
set -u
DB="docker exec -i supabase_db_stylernow psql -U postgres -d postgres -v ON_ERROR_STOP=1 -q"
DBT="docker exec -i supabase_db_stylernow psql -U postgres -d postgres -At"
OWNER='00000000-0000-0000-000c-0000000000a1'
STAFF='00000000-0000-0000-000c-0000000000b1'
NEG='00000000-0000-0000-000c-0000000001a0'
SEDE='00000000-0000-0000-000c-0000000002a0'
VINCULO='00000000-0000-0000-000c-0000000003a1'
SERVICIO='00000000-0000-0000-000c-0000000004a1'
KEY="race-fase3-$$-$(date +%s)"
FIN=0

preparar() {
  $DB <<SQL
insert into auth.users (id, email, aud, role, email_confirmed_at) values
  ('$OWNER', 'f3-owner@test.local', 'authenticated', 'authenticated', now()),
  ('$STAFF', 'f3-staff@test.local', 'authenticated', 'authenticated', now())
  on conflict (id) do nothing;
insert into public.perfil (id, nombre, email) values ('$OWNER', 'F3 owner', 'f3-owner@test.local')
  on conflict (id) do update set email = excluded.email, nombre = excluded.nombre;
insert into public.negocio (id, owner_user_id, nombre, slug, ciudad, pais_codigo, estado, plan_codigo) values ('$NEG', '$OWNER', 'F3 NE', 'f3-ne', 'Cali', 'CO', 'ACTIVO', 'ESSENTIAL')
  on conflict (id) do nothing;
insert into public.sede (id, negocio_id, nombre, direccion, ciudad, es_principal) values ('$SEDE', '$NEG', 'Sede F3', 'Cra 1', 'Cali', true)
  on conflict (id) do nothing;
insert into public.suscripcion (negocio_id, plan_codigo, estado, fecha_proximo_cobro, pais_codigo) values ('$NEG', 'ESSENTIAL', 'TRIAL', now() + interval '14 days', 'CO')
  on conflict (negocio_id) do nothing;
insert into public.staff (usuario_id, nombre) values ('$STAFF', 'F3 barbero') on conflict (usuario_id) do nothing;
insert into public.vinculo_staff_negocio (id, staff_id, negocio_id, sede_activa_id, estado, es_guardian, comision_pct, fecha_ingreso, presta_servicios) values
  ('$VINCULO', '$STAFF', '$NEG', '$SEDE', 'ACTIVO', false, 30, now(), true)
  on conflict (id) do nothing;
insert into public.servicio (id, negocio_id, nombre, duracion_minutos, precio_base, estado) values
  ('$SERVICIO', '$NEG', 'Corte F3', 30, 30000, 'ACTIVO')
  on conflict (id) do nothing;
insert into public.staff_servicio (staff_id, servicio_id) values ('$STAFF', '$SERVICIO')
  on conflict do nothing;
update public.staff set foto_url = 'https://example.test/f3-staff.jpg' where usuario_id = '$STAFF';
begin;
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', '$STAFF', 'role', 'authenticated')::text, true);
select public.autorizar_staff('AUTORIZACION_STAFF_TRATAMIENTO', 'perfil');
select public.autorizar_staff('AUTORIZACION_STAFF_PUBLICACION', 'perfil');
reset role;
commit;
insert into public.disponibilidad (vinculo_id, sede_id, dia_semana, hora_inicio, hora_fin)
select '$VINCULO', '$SEDE', d, '08:00', '20:00' from generate_series(0, 6) d;
SQL
}

correr() {
  local n=$1 dir; dir=$(mktemp -d)
  for i in $(seq 1 "$n"); do
    ( $DBT > "$dir/s$i.out" 2>&1 <<SQL
begin;
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', '$OWNER', 'role', 'authenticated')::text, true);
select 'RESERVA:' || id::text from public.crear_reserva_autorizada('$SEDE', array['$SERVICIO']::uuid[], '$HORA'::timestamptz, '$STAFF'::uuid, '$KEY', true);
select pg_sleep(2);
commit;
SQL
    ) &
  done
  wait
  OKS=$(cat "$dir"/s*.out | grep -c '^RESERVA:' || true)
  IDS=$(cat "$dir"/s*.out | grep '^RESERVA:' | sed 's/^RESERVA://' | sort -u | wc -l)
  ERRORES=$(cat "$dir"/s*.out | grep -c 'ERROR:' || true)
  if [ "$ERRORES" -gt 0 ]; then cat "$dir"/s*.out | grep 'ERROR:' | sort -u; fi
  rm -rf "$dir"
}

limpiar() {
  $DB <<SQL
set session_replication_role = replica;
delete from public.evidencia_legal where usuario_id in ('$OWNER', '$STAFF');
delete from public.wallet where negocio_id = '$NEG';
delete from public.autorizacion_datos_reserva where reserva_id in (select id from public.reserva where cliente_id = '$OWNER');
delete from public.reserva_servicio where reserva_id in (select id from public.reserva where cliente_id = '$OWNER');
delete from public.pago where reserva_id in (select id from public.reserva where cliente_id = '$OWNER');
delete from public.reserva where cliente_id = '$OWNER';
delete from public.evento_auditoria where negocio_id = '$NEG';
delete from public.disponibilidad where sede_id = '$SEDE';
delete from public.staff_servicio where staff_id = '$STAFF';
delete from public.servicio where id = '$SERVICIO';
delete from public.vinculo_staff_negocio where id = '$VINCULO';
delete from public.staff where usuario_id = '$STAFF';
delete from public.sede where id = '$SEDE';
delete from public.suscripcion where negocio_id = '$NEG';
delete from public.negocio where id = '$NEG';
delete from public.perfil where id = '$OWNER';
delete from auth.users where id in ('$OWNER', '$STAFF');
SQL
}

echo "== Fase 3: 6 sesiones simultaneas, mismo slot y misma Idempotency-Key =="
preparar || { echo "FALLA preparando"; exit 2; }
HORA=$($DBT -c "select hora_inicio from public.slots_disponibles('$SEDE', array['$SERVICIO']::uuid[], (current_date + 1), '$STAFF'::uuid) where disponible order by hora_inicio limit 1")
if [ -z "$HORA" ]; then
  echo "FALLA: slots_disponibles no devolvio ningun hueco"
  limpiar
  exit 2
fi
correr 6
echo "respuestas=$OKS ids_distintos=$IDS errores=$ERRORES (esperado 6, 1, 0)"
[ "$OKS" -eq 6 ] && [ "$IDS" -eq 1 ] && [ "$ERRORES" -eq 0 ] || FIN=1
TOTAL=$($DBT -c "select count(*) from public.reserva where cliente_id = '$OWNER' and idempotency_key = '$KEY'")
AUT=$($DBT -c "select count(*) from public.autorizacion_datos_reserva a join public.reserva r on r.id = a.reserva_id where r.cliente_id = '$OWNER' and r.idempotency_key = '$KEY'")
echo "reservas_en_bd=$TOTAL autorizaciones=$AUT (esperado 1, 1)"
[ "$TOTAL" -eq 1 ] && [ "$AUT" -eq 1 ] || FIN=1
limpiar && echo "limpio" || { echo "AVISO: no se pudo limpiar"; FIN=1; }
[ $FIN -eq 0 ] && echo "OK: reservas_concurrencia" || echo "FALLA: reservas_concurrencia"
exit $FIN

#!/usr/bin/env bash
# Concurrencia real (dos sesiones) de reserva_recuperar: dos clientes con el bloqueo vencido intentan recuperar el MISMO turno a la vez.
# Debe ganar exactamente UNO; el otro recibe NO_DISPONIBLE (lo decide la restricción EXCLUDE, no una consulta previa).
#   bash tests/sql/recuperar_reserva_concurrencia.sh
# Usa un negocio de PRUEBA fijo (prefijo a6/b6…, slug conc-rec-test) que queda en la base local; al final solo se borran sus reservas.
set -euo pipefail
PSQL="docker exec -i supabase_db_stylernow psql -U postgres -v ON_ERROR_STOP=1 -tA"
NEG='b6000001-0000-4000-8000-00000000000a'; SEDE='c6000001-0000-4000-8000-000000000001'; SERV='e6000001-0000-4000-8000-000000000001'
STAFF='a6000001-0000-4000-8000-000000000002'; C1='a6000001-0000-4000-8000-000000000003'; C2='a6000001-0000-4000-8000-000000000004'
limpiar() {
  $PSQL >/dev/null <<SQL || true
delete from public.autorizacion_datos_reserva where reserva_id in (select id from public.reserva where negocio_id = '$NEG');
delete from public.reserva_servicio where reserva_id in (select id from public.reserva where negocio_id = '$NEG');
delete from public.reserva where negocio_id = '$NEG';
SQL
}
trap limpiar EXIT
limpiar

$PSQL >/dev/null <<SQL
insert into auth.users (id, email, aud, role) select * from (values
  ('a6000001-0000-4000-8000-000000000001'::uuid, 'k_dueno@t.l', 'authenticated', 'authenticated'),
  ('$STAFF', 'k_staff@t.l', 'authenticated', 'authenticated'), ('$C1', 'k_c1@t.l', 'authenticated', 'authenticated'), ('$C2', 'k_c2@t.l', 'authenticated', 'authenticated')) v(id, email, aud, role) where not exists (select 1 from auth.users u where u.id = v.id::uuid);
insert into public.perfil (id, nombre) values ('a6000001-0000-4000-8000-000000000001', 'D'), ('$STAFF', 'P'), ('$C1', 'C1'), ('$C2', 'C2') on conflict (id) do nothing;
insert into public.staff (usuario_id, nombre) values ('$STAFF', 'P') on conflict do nothing;
insert into public.negocio (id, owner_user_id, nombre, slug, ciudad, pais_codigo, plan_codigo, estado) values ('$NEG', 'a6000001-0000-4000-8000-000000000001', 'Conc', 'conc-rec-test', 'Cali', 'CO', 'PRESTIGE', 'ACTIVO') on conflict (id) do nothing;
insert into public.suscripcion (negocio_id, plan_codigo, estado, fecha_proximo_cobro, pais_codigo) values ('$NEG', 'PRESTIGE', 'ACTIVA', now() + interval '30 days', 'CO') on conflict (negocio_id) do update set estado = 'ACTIVA';
insert into public.sede (id, negocio_id, nombre, direccion, ciudad, horario_base, es_principal) values ('$SEDE', '$NEG', 'S', 'Calle 1', 'Cali', '{}'::jsonb, true) on conflict (id) do nothing;
update public.configuracion_plataforma set staff_transicion_inicio = now() - interval '1 day', staff_transicion_fin = now() + interval '1 year';
insert into public.vinculo_staff_negocio (id, staff_id, negocio_id, sede_activa_id, estado, presta_servicios, created_at) values ('d6000001-0000-4000-8000-000000000001', '$STAFF', '$NEG', '$SEDE', 'ACTIVO', true, now() - interval '10 days') on conflict (id) do update set estado = 'ACTIVO';
delete from public.disponibilidad where sede_id = '$SEDE';
insert into public.disponibilidad (vinculo_id, sede_id, dia_semana, hora_inicio, hora_fin) select 'd6000001-0000-4000-8000-000000000001', '$SEDE', d, '08:00', '20:00' from generate_series(0, 6) d;
insert into public.servicio (id, negocio_id, nombre, duracion_minutos, precio_base, estado) values ('$SERV', '$NEG', 'Corte', 30, 30000, 'ACTIVO') on conflict (id) do update set estado = 'ACTIVO';
insert into public.staff_servicio (staff_id, servicio_id) values ('$STAFF', '$SERV') on conflict do nothing;
insert into public.negocio_medio_pago_directo (negocio_id, activo, nequi) values ('$NEG', true, '3001112233') on conflict (negocio_id) do update set activo = true;   -- sin cómo cobrar, el anticipo sería 0 y no habría bloqueo
SQL

HORA="((current_date + 2)::text || ' 10:00:00-05')::timestamptz"
crear() {  # $1 = cliente, $2 = clave idempotente
  $PSQL <<SQL
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"$1","role":"authenticated"}', false);
select (public.crear_reserva_autorizada('$SEDE', array['$SERV']::uuid[], $HORA, '$STAFF', '$2', true)).id;
SQL
}
R1=$(crear "$C1" k1 | tail -1)
$PSQL >/dev/null -c "update public.reserva set expira_at = now() - interval '1 minute' where id = '$R1'; select public.expirar_reservas_vencidas();"
R2=$(crear "$C2" k2 | tail -1)
$PSQL >/dev/null -c "update public.reserva set expira_at = now() - interval '1 minute' where id = '$R2'; select public.expirar_reservas_vencidas();"
echo "Reservas con bloqueo vencido: $R1 (C1) y $R2 (C2), mismo turno."

# Sesión A: recupera y MANTIENE la transacción abierta 5 s; sesión B intenta lo mismo mientras tanto.
( $PSQL > /tmp/conc_a.out <<SQL
begin;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"$C1","role":"authenticated"}', true);
select public.reserva_recuperar('$R1') ->> 'resultado';
select pg_sleep(5);
commit;
SQL
) &
PID_A=$!
sleep 1.5
INICIO=$(date +%s)
$PSQL > /tmp/conc_b.out <<SQL
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"$C2","role":"authenticated"}', false);
select public.reserva_recuperar('$R2') ->> 'resultado';
SQL
FIN=$(date +%s)
wait $PID_A

RES_A=$(grep -E "RECUPERADA|NO_DISPONIBLE|VIGENTE" /tmp/conc_a.out | head -1)
RES_B=$(grep -E "RECUPERADA|NO_DISPONIBLE|VIGENTE" /tmp/conc_b.out | head -1)
echo "Sesión A (C1): $RES_A"; echo "Sesión B (C2): $RES_B  (esperó $((FIN - INICIO)) s al candado)"
ESTADOS=$($PSQL -c "select string_agg(id::text || '=' || estado, ',' order by id::text) from public.reserva where negocio_id = '$NEG'")
ACTIVAS=$($PSQL -c "select count(*) from public.reserva where negocio_id = '$NEG' and estado in ('PENDIENTE_PAGO','CONFIRMADA')")
[ "$RES_A" = "RECUPERADA" ] || { echo "FALLA: A debía recuperar"; exit 1; }
[ "$RES_B" = "NO_DISPONIBLE" ] || { echo "FALLA: B debía recibir NO_DISPONIBLE (recibió $RES_B)"; exit 1; }
[ "$ACTIVAS" = "1" ] || { echo "FALLA: debe haber exactamente 1 reserva activa en el turno (hay $ACTIVAS)"; exit 1; }
[ $((FIN - INICIO)) -ge 2 ] || { echo "FALLA: B no esperó al candado de A (no hubo carrera real)"; exit 1; }
echo "OK recuperar_reserva_concurrencia"

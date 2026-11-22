#!/bin/bash
# Concurrencia REAL del cupo (migración 159): N sesiones simultáneas intentan usar los cupos libres de un negocio Studio (límite 5).
# Solo contra la base LOCAL (contenedor supabase_db_stylernow). Crea fixtures confirmados (prefijo 000b-), los usa y los elimina al final;
# NO toca datos de otros negocios. Uso:  bash tests/sql/roles_158_concurrencia.sh
# Resultado esperado: con el candado, exactamente 2 invitaciones se crean y 4 reciben PLAN_LIMIT_EXCEEDED.
# Control negativo: sustituye temporalmente _cupo_bloquear por una función vacía y demuestra que SIN el candado se sobrepasa el cupo.
set -u
DB="docker exec -i supabase_db_stylernow psql -U postgres -d postgres -v ON_ERROR_STOP=1 -q"
DBT="docker exec -i supabase_db_stylernow psql -U postgres -d postgres -At"
OWNER='00000000-0000-0000-000b-0000000000a1'
NEG='00000000-0000-0000-000b-0000000001a0'
SEDE='00000000-0000-0000-000b-0000000002a0'
FIN=0

preparar() {
  $DB <<SQL
insert into auth.users (id, email, aud, role, email_confirmed_at) values ('$OWNER', 'r151c-owner@test.local', 'authenticated', 'authenticated', now())
  on conflict (id) do nothing;
insert into public.perfil (id, nombre, email) values ('$OWNER', 'R151C owner', 'r151c-owner@test.local')
  on conflict (id) do update set email = excluded.email;
insert into public.negocio (id, owner_user_id, nombre, slug, ciudad, pais_codigo, estado) values ('$NEG', '$OWNER', 'R151C', 'r151c', 'Cali', 'CO', 'ACTIVO')
  on conflict (id) do nothing;
update public.negocio set plan_codigo = 'STUDIO' where id = '$NEG';
insert into public.sede (id, negocio_id, nombre, direccion, ciudad, es_principal) values ('$SEDE', '$NEG', 'Sede C', 'Cra 1', 'Cali', true)
  on conflict (id) do nothing;
delete from public.invitacion_staff where negocio_id = '$NEG';
-- 3 invitaciones vigentes ya ocupan cupo: quedan 2 libres de 5.
insert into public.invitacion_staff (negocio_id, email, sede_id, invitado_por) values
  ('$NEG', 'pre1@test.local', '$SEDE', '$OWNER'), ('$NEG', 'pre2@test.local', '$SEDE', '$OWNER'), ('$NEG', 'pre3@test.local', '$SEDE', '$OWNER');
SQL
}

# Lanza N sesiones simultáneas; cada una invita a un correo distinto y retiene su transacción 2 s para forzar el solapamiento.
correr() {
  local n=$1 dir; dir=$(mktemp -d)
  for i in $(seq 1 "$n"); do
    ( $DBT > "$dir/s$i.out" 2>&1 <<SQL
begin;
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', '$OWNER', 'role', 'authenticated')::text, true);
select 'CREADA' from public.crear_invitacion_staff('$NEG', 'conc$i@test.local', '$SEDE');
select pg_sleep(2);
commit;
SQL
    ) &
  done
  wait
  CREADAS=$(cat "$dir"/s*.out | grep -c '^CREADA')
  RECHAZADAS=$(cat "$dir"/s*.out | grep -c 'PLAN_LIMIT_EXCEEDED')
  rm -rf "$dir"
}

limpiar() {
  $DB <<SQL
set session_replication_role = replica;
delete from public.invitacion_staff where negocio_id = '$NEG';
delete from public.evento_auditoria where negocio_id = '$NEG';
delete from public.wallet where negocio_id = '$NEG';
delete from public.sede where negocio_id = '$NEG';
delete from public.negocio where id = '$NEG';
delete from public.perfil where id = '$OWNER';
delete from auth.users where id = '$OWNER';
SQL
}

echo "== Preparando fixtures (Studio: límite 5, 3 invitaciones ya vigentes) =="
preparar || { echo "FALLA preparando"; exit 2; }

echo "== CON candado (migración 159): 6 sesiones simultáneas, 2 cupos libres =="
correr 6
echo "creadas=$CREADAS rechazadas_por_cupo=$RECHAZADAS (esperado 2 y 4)"
[ "$CREADAS" -eq 2 ] && [ "$RECHAZADAS" -eq 4 ] || FIN=1
TOTAL=$($DBT -c "select (public._capacidad_profesional('$NEG') ->> 'ocupados')::int")
echo "ocupados al final=$TOTAL (esperado 5, nunca más que el límite)"
[ "$TOTAL" -eq 5 ] || FIN=1

echo "== CONTROL NEGATIVO sin candado: se vacía _cupo_bloquear (solo en esta prueba) =="
preparar
$DB -c "create or replace function public._cupo_bloquear(p_negocio_id uuid) returns void language sql security definer set search_path = public as 'select 1'"
correr 6
echo "creadas=$CREADAS (sin candado se espera MÁS de 2: el cupo se sobrepasa)"
SIN=$CREADAS
TOTAL2=$($DBT -c "select (public._capacidad_profesional('$NEG') ->> 'ocupados')::int")
echo "ocupados al final sin candado=$TOTAL2 (límite 5)"
# Se restaura la función REAL (la definición oficial vive en la migración 159).
$DB -c "create or replace function public._cupo_bloquear(p_negocio_id uuid) returns void language sql security definer set search_path = public as \$\$ select pg_advisory_xact_lock(hashtextextended('cupo_profesional:' || p_negocio_id::text, 0)); \$\$"
$DB -c "revoke all on function public._cupo_bloquear(uuid) from public, anon, authenticated"
[ "$SIN" -gt 2 ] || { echo "AVISO: el control negativo no sobrepasó el cupo; la prueba no demuestra nada"; FIN=1; }

echo "== Limpiando SOLO los fixtures propios (prefijo 000b-) =="
limpiar && echo "limpio" || { echo "AVISO: no se pudo limpiar; revisar negocio $NEG"; FIN=1; }
[ $FIN -eq 0 ] && echo "OK: roles_151_concurrencia" || echo "FALLA: roles_151_concurrencia"
exit $FIN

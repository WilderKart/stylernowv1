-- Pruebas de comportamiento de la migración 123 (auditoría completa de los paneles).
--
-- Se corren contra la base LOCAL (supabase start), nunca contra producción:
--   docker exec -i supabase_db_stylernow psql -U postgres -d postgres -v ON_ERROR_STOP=1 < tests/sql/auditoria_123.sql
-- Todo ocurre dentro de una transacción que termina en ROLLBACK: no deja datos.
-- Cada bloque lanza 'FALLA: …' si el comportamiento no es el esperado; ON_ERROR_STOP corta en el primero.

begin;

-- Paridad con producción: allí service_role tiene todos los privilegios de tabla y
-- authenticated lee y escribe con RLS (default privileges de Supabase). La CLI local nueva no
-- los otorga, así que se emulan aquí. Con esto, la inmutabilidad se prueba contra los TRIGGERS
-- (última barrera) y el aislamiento contra la RLS y las funciones, no solo contra la falta de permisos.
grant select, insert, update, delete on all tables in schema public to service_role;
grant usage, select on all sequences in schema public to service_role;
grant select on all tables in schema public to authenticated;
grant insert, update, delete on public.servicio to authenticated;
-- La 117 y la 123 revocan TRUNCATE; se re-otorga para probar que el TRIGGER también lo frena.
grant truncate on public.evento_auditoria to service_role;

-- ── Datos de prueba (como postgres) ─────────────────────────────────────────
insert into auth.users (id, email, aud, role) values
  ('00000000-0000-0000-0000-0000001230a1', 'dueno-a@test.local', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000001230a2', 'dueno-b@test.local', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000001230a3', 'intruso@test.local', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000001230a4', 'su@test.local', 'authenticated', 'authenticated');

insert into public.perfil (id, nombre) values
  ('00000000-0000-0000-0000-0000001230a1', 'Dueña A'), ('00000000-0000-0000-0000-0000001230a2', 'Dueño B'),
  ('00000000-0000-0000-0000-0000001230a3', 'Intruso'), ('00000000-0000-0000-0000-0000001230a4', 'SuperSU')
on conflict (id) do nothing;
update public.perfil set es_supersu = true where id = '00000000-0000-0000-0000-0000001230a4';

do $$ begin
  if not exists (select 1 from public.evento_auditoria
                  where entidad_tipo = 'perfil' and entidad_id = '00000000-0000-0000-0000-0000001230a4'
                    and accion = 'PERFIL_ACTUALIZADO'
                    and payload_antes ->> 'es_supersu' = 'false' and payload_despues ->> 'es_supersu' = 'true'
                    and origen = 'SQL') then
    raise exception 'FALLA 123: dar SuperSU a un perfil no quedó auditado con antes/después y origen SQL';
  end if;
  raise notice 'OK 123: escalamiento a SuperSU auditado (antes/después, origen SQL)';
end $$;

insert into public.negocio (id, owner_user_id, nombre, slug, ciudad, pais_codigo) values
  ('00000000-0000-0000-0000-0000001230b1', '00000000-0000-0000-0000-0000001230a1', 'Negocio A', 'negocio-a-aud123', 'Cali', 'CO'),
  ('00000000-0000-0000-0000-0000001230b2', '00000000-0000-0000-0000-0000001230a2', 'Negocio B', 'negocio-b-aud123', 'Cali', 'CO');

insert into public.sede (id, negocio_id, nombre, direccion, ciudad) values
  ('00000000-0000-0000-0000-0000001230c1', '00000000-0000-0000-0000-0000001230b1', 'Sede A', 'Cra 1', 'Cali'),
  ('00000000-0000-0000-0000-0000001230c2', '00000000-0000-0000-0000-0000001230b2', 'Sede B', 'Cra 2', 'Cali');

insert into public.servicio (id, negocio_id, nombre, duracion_minutos, precio_base) values
  ('00000000-0000-0000-0000-0000001230f1', '00000000-0000-0000-0000-0000001230b1', 'Corte A', 30, 30000),
  ('00000000-0000-0000-0000-0000001230f2', '00000000-0000-0000-0000-0000001230b2', 'Corte B', 30, 30000);

insert into public.suscripcion (negocio_id, plan_codigo, estado, fecha_proximo_cobro)
select n.id, 'STUDIO', 'REQUIERE_PLAN', now() + interval '30 days' from public.negocio n
 where n.id in ('00000000-0000-0000-0000-0000001230b1', '00000000-0000-0000-0000-0000001230b2')
   and not exists (select 1 from public.suscripcion s where s.negocio_id = n.id);
update public.suscripcion set estado = 'ACTIVA'
 where negocio_id in ('00000000-0000-0000-0000-0000001230b1', '00000000-0000-0000-0000-0000001230b2');

do $$ begin
  if not exists (select 1 from public.evento_auditoria where entidad_tipo = 'negocio'
                  and entidad_id = '00000000-0000-0000-0000-0000001230b1' and accion = 'NEGOCIO_CREADO'
                  and negocio_id = '00000000-0000-0000-0000-0000001230b1' and payload_despues ? 'comision_plataforma_pct') then
    raise exception 'FALLA 123: la creación del negocio no quedó auditada';
  end if;
  if not exists (select 1 from public.evento_auditoria where entidad_tipo = 'suscripcion'
                  and negocio_id = '00000000-0000-0000-0000-0000001230b1' and accion = 'SUSCRIPCION_ESTADO_ACTIVA'
                  and payload_despues ->> 'estado' = 'ACTIVA' and payload_antes ? 'estado') then
    raise exception 'FALLA 123: el cambio de estado de la suscripción no quedó auditado con antes/después';
  end if;
  raise notice 'OK 123: negocio y estado de suscripción auditados';
end $$;

-- ── 1. RPC antigua de SuperSU (admin_set_pais): antes/después, motivo, origen y request_id ──
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000001230a4","role":"authenticated"}', true);
select set_config('request.headers',
  json_build_object('x-request-id', 'abc', 'x-auditoria-motivo', encode(convert_to('Corrección de cupos fundador', 'UTF8'), 'base64'))::text,
  true);
do $$
declare
  v_antes public.pais;
  e public.evento_auditoria;
begin
  select * into v_antes from public.pais where codigo = 'CO';
  perform public.admin_set_pais('CO', v_antes.activo, v_antes.pasarela, v_antes.cobro_recurrente_habilitado,
    v_antes.fundador_descuento_pct, v_antes.fundador_cupos + 7, v_antes.fundador_meses, v_antes.impuesto_pct, v_antes.precio_mas_impuesto);

  select * into e from public.evento_auditoria
   where entidad_tipo = 'pais' and accion = 'PAIS_ACTUALIZADO' order by created_at desc limit 1;
  if e.id is null then raise exception 'FALLA 123: admin_set_pais no dejó fila con antes/después'; end if;
  if (e.payload_antes ->> 'fundador_cupos')::int <> v_antes.fundador_cupos
     or (e.payload_despues ->> 'fundador_cupos')::int <> v_antes.fundador_cupos + 7
     or e.payload_despues ->> 'codigo' <> 'CO' then
    raise exception 'FALLA 123: antes/después incorrectos: % → %', e.payload_antes, e.payload_despues;
  end if;
  if e.payload_despues ? 'updated_at' or e.payload_despues ? 'updated_by' then
    raise exception 'FALLA 123: el payload incluye columnas de ruido (updated_at/updated_by)';
  end if;
  if e.request_id is distinct from 'abc' then raise exception 'FALLA 123: request_id no capturado (%)', e.request_id; end if;
  if e.origen is distinct from 'PANEL' then raise exception 'FALLA 123: origen esperado PANEL, fue %', e.origen; end if;
  if e.motivo is distinct from 'Corrección de cupos fundador' then raise exception 'FALLA 123: motivo no capturado (%)', e.motivo; end if;
  if e.actor_tipo <> 'SUPERSU' or e.actor_id is distinct from '00000000-0000-0000-0000-0000001230a4' then
    raise exception 'FALLA 123: actor incorrecto (% / %)', e.actor_tipo, e.actor_id;
  end if;

  -- La fila antigua de la propia RPC (solo nombre de acción) también se completa.
  select * into e from public.evento_auditoria
   where entidad_tipo = 'pais' and accion = 'PAIS_ACTUALIZADO_CO' order by created_at desc limit 1;
  if e.request_id is distinct from 'abc' or e.motivo is distinct from 'Corrección de cupos fundador' or e.origen <> 'PANEL' then
    raise exception 'FALLA 123: la fila antigua de la RPC no se completó con origen/request_id/motivo';
  end if;
  raise notice 'OK 123: admin_set_pais con antes/después, motivo, origen PANEL y request_id';
end $$;

-- admin_set_plan_precio (CO pasa por plan → plan_precio) y admin_set_plan_caracteristica
do $$
declare
  v_precio numeric;
  n int;
begin
  select precio_mensual into v_precio from public.plan where codigo = 'STUDIO';
  perform public.admin_set_plan_precio('STUDIO', 'CO', v_precio + 1000, false, 20000, null, true);
  if not exists (select 1 from public.evento_auditoria where entidad_tipo = 'plan' and accion = 'PLAN_ACTUALIZADO'
                  and (payload_antes ->> 'precio_mensual')::numeric = v_precio
                  and (payload_despues ->> 'precio_mensual')::numeric = v_precio + 1000
                  and request_id = 'abc') then
    raise exception 'FALLA 123: el cambio de precio del plan no quedó con antes/después';
  end if;

  perform public.admin_set_plan_caracteristica('STUDIO', 'prueba_aud_123', true, 'x');
  select count(*) into n from public.evento_auditoria where entidad_tipo = 'plan_caracteristica'
     and payload_despues ->> 'clave' = 'prueba_aud_123' and payload_antes is null;
  if n <> 1 then raise exception 'FALLA 123: la característica nueva no quedó auditada (o se perdió la columna "clave")'; end if;
  raise notice 'OK 123: precios y características de plan con antes/después';
end $$;

-- Sin el x-request-id del servidor, una llamada con sesión cuenta como API directa.
select set_config('request.headers', '{}', true);
do $$
declare e public.evento_auditoria;
begin
  perform public.admin_set_addon_precio('MI_MARCA', 'CO', 12345);
  select * into e from public.evento_auditoria where entidad_tipo = 'addon_precio' and accion like 'ADDON_PRECIO_%'
   order by created_at desc limit 1;
  if e.origen is distinct from 'API' or e.request_id is not null or e.motivo is not null then
    raise exception 'FALLA 123: origen esperado API sin request_id ni motivo; llegó % / % / %', e.origen, e.request_id, e.motivo;
  end if;
  raise notice 'OK 123: origen API cuando falta el id de petición del servidor';
end $$;

-- Un tercero no puede tocar configuración ni leer auditoría global.
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000001230a3","role":"authenticated"}', true);
do $$ begin
  begin
    perform public.admin_set_pais('CO', true, 'MERCADOPAGO', false, 30, 1, 6, null, false);
    raise exception 'FALLA 123: un no-SuperSU cambió un país';
  exception when others then
    if sqlerrm not like '%NO_AUTORIZADO%' then raise; end if;
  end;
  begin
    perform * from public.auditoria_listar(null, null, null, null, null, 50, 0);
    raise exception 'FALLA 123: un no-SuperSU listó la auditoría global';
  exception when others then
    if sqlerrm not like '%NO_AUTORIZADO%' then raise; end if;
  end;
  raise notice 'OK 123: sin SuperSU no hay cambios de configuración ni lectura global';
end $$;
reset role;

-- ── 2. Escritura directa (sin RPC) sobre feature_flag: origen SQL, actor SISTEMA ──
select set_config('request.jwt.claims', '', true);
select set_config('request.headers', '', true);
insert into public.feature_flag (id, clave, alcance, activo)
values ('00000000-0000-0000-0000-0000001230e1', 'flag_aud_123', 'GLOBAL', false);
update public.feature_flag set activo = true where id = '00000000-0000-0000-0000-0000001230e1';
do $$
declare e public.evento_auditoria;
begin
  select * into e from public.evento_auditoria where entidad_tipo = 'feature_flag'
     and entidad_id = '00000000-0000-0000-0000-0000001230e1' and accion = 'FEATURE_FLAG_ACTUALIZADO';
  if e.id is null or e.payload_antes ->> 'activo' <> 'false' or e.payload_despues ->> 'activo' <> 'true' then
    raise exception 'FALLA 123: la escritura directa en feature_flag no quedó con antes/después';
  end if;
  if e.origen <> 'SQL' or e.actor_tipo <> 'SISTEMA' or e.actor_id is not null then
    raise exception 'FALLA 123: escritura por SQL mal atribuida (% / %)', e.origen, e.actor_tipo;
  end if;
  raise notice 'OK 123: escrituras directas a configuración auditadas (origen SQL, actor SISTEMA)';
end $$;

-- Un UPDATE que solo toca updated_at no genera ruido.
do $$
declare n0 int; n1 int;
begin
  select count(*) into n0 from public.evento_auditoria where entidad_tipo = 'feature_flag';
  update public.feature_flag set updated_at = now() where id = '00000000-0000-0000-0000-0000001230e1';
  select count(*) into n1 from public.evento_auditoria where entidad_tipo = 'feature_flag';
  if n1 <> n0 then raise exception 'FALLA 123: un UPDATE sin cambios reales generó auditoría'; end if;
  raise notice 'OK 123: sin cambios reales no hay fila de auditoría';
end $$;

-- ── 3. Secretos fuera de los payloads ──────────────────────────────────────
-- (a) Inserción directa del servidor (service_role conserva INSERT): el trigger limpia de forma recursiva.
set local role service_role;
insert into public.evento_auditoria (id, entidad_tipo, accion, actor_tipo, negocio_id, payload_antes, payload_despues)
values ('00000000-0000-0000-0000-0000001230d9', 'prueba', 'PRUEBA_SECRETOS', 'SISTEMA', '00000000-0000-0000-0000-0000001230b1',
  '{"password":"p","nombre":"ok"}',
  '{"access_token":"t","refresh_token_cifrado":"r","pin_hash":"h","api_key":"k","clave":"conservar","cpc_pin_cop":5,
    "anidado":{"client_secret":"s","lista":[{"password":"x","valor":1}],"pin":"1234"}}');
reset role;
do $$
declare e public.evento_auditoria;
begin
  select * into e from public.evento_auditoria where id = '00000000-0000-0000-0000-0000001230d9';
  if e.payload_antes ? 'password' or e.payload_despues ? 'access_token' or e.payload_despues ? 'refresh_token_cifrado'
     or e.payload_despues ? 'pin_hash' or e.payload_despues ? 'api_key'
     or e.payload_despues -> 'anidado' ? 'client_secret' or e.payload_despues -> 'anidado' ? 'pin'
     or e.payload_despues -> 'anidado' -> 'lista' -> 0 ? 'password' then
    raise exception 'FALLA 123: quedaron secretos en el payload: % / %', e.payload_antes, e.payload_despues;
  end if;
  if e.payload_despues ->> 'clave' <> 'conservar' or (e.payload_despues ->> 'cpc_pin_cop')::int <> 5
     or (e.payload_despues -> 'anidado' -> 'lista' -> 0 ->> 'valor')::int <> 1 or e.payload_antes ->> 'nombre' <> 'ok' then
    raise exception 'FALLA 123: se borraron claves legítimas: %', e.payload_despues;
  end if;
  if e.origen <> 'SQL' then raise exception 'FALLA 123: origen esperado SQL, fue %', e.origen; end if;
  raise notice 'OK 123: secretos eliminados de forma recursiva; claves legítimas conservadas';
end $$;

-- (b) Trigger sobre una tabla con tokens: la conexión de cobro del negocio.
insert into public.conexion_pago_negocio (negocio_id, estado, entorno, cuenta_externa_id, access_token_cifrado, refresh_token_cifrado, token_expira_at, conectada_at)
values ('00000000-0000-0000-0000-0000001230b1', 'CONECTADA', 'SANDBOX', '555', 'v1.iv.tag.secreto', 'v1.iv.tag.refresh', now() + interval '180 days', now());
do $$ begin
  if not exists (select 1 from public.evento_auditoria where entidad_tipo = 'conexion_pago_negocio'
                  and negocio_id = '00000000-0000-0000-0000-0000001230b1' and payload_despues ->> 'estado' = 'CONECTADA') then
    raise exception 'FALLA 123: la conexión de cobro no quedó auditada';
  end if;
  if exists (select 1 from public.evento_auditoria where entidad_tipo = 'conexion_pago_negocio'
              and (payload_despues::text like '%v1.iv.tag%' or payload_antes::text like '%v1.iv.tag%')) then
    raise exception 'FALLA 123: un token cifrado quedó en la auditoría';
  end if;
  raise notice 'OK 123: tokens de la conexión de cobro fuera de la auditoría';
end $$;

-- ── 4. Reservas: el cambio de ESTADO se audita, la creación no ─────────────
insert into public.reserva (id, cliente_id, negocio_id, sede_id, hora_inicio, hora_fin, estado, monto_total, monto_sena)
values ('00000000-0000-0000-0000-0000001230d1', '00000000-0000-0000-0000-0000001230a3', '00000000-0000-0000-0000-0000001230b1',
        '00000000-0000-0000-0000-0000001230c1', now() + interval '3 days', now() + interval '3 days 1 hour', 'CONFIRMADA', 30000, 0);
do $$ begin
  if exists (select 1 from public.evento_auditoria where entidad_tipo = 'reserva' and entidad_id = '00000000-0000-0000-0000-0000001230d1') then
    raise exception 'FALLA 123: la creación de una reserva generó auditoría fila a fila';
  end if;
end $$;
update public.reserva set monto_total = 31000 where id = '00000000-0000-0000-0000-0000001230d1';
update public.reserva set estado = 'CANCELADA', cancelado_por = 'NEGOCIO', cancelado_motivo = 'cierre'
 where id = '00000000-0000-0000-0000-0000001230d1';
do $$
declare n int;
begin
  select count(*) into n from public.evento_auditoria where entidad_tipo = 'reserva' and entidad_id = '00000000-0000-0000-0000-0000001230d1';
  if n <> 1 then raise exception 'FALLA 123: se esperaba 1 fila (cambio de estado) para la reserva, hubo %', n; end if;
  if not exists (select 1 from public.evento_auditoria where entidad_tipo = 'reserva' and entidad_id = '00000000-0000-0000-0000-0000001230d1'
                  and accion = 'RESERVA_ESTADO_CANCELADA' and payload_antes ->> 'estado' = 'CONFIRMADA'
                  and negocio_id = '00000000-0000-0000-0000-0000001230b1') then
    raise exception 'FALLA 123: el cambio de estado de la reserva no tiene antes/después';
  end if;
  raise notice 'OK 123: reservas: solo cambios de estado, sin auditoría por creación';
end $$;

-- ── 5. Edición del dueño desde el panel (escritura directa con RLS) ────────
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000001230a1","role":"authenticated"}', true);
select set_config('request.headers', '{"x-request-id":"req-panel-1"}', true);
update public.servicio set precio_base = 35000 where id = '00000000-0000-0000-0000-0000001230f1';
-- Intento sobre el servicio de otro negocio: la RLS lo filtra (0 filas) y no hay auditoría.
update public.servicio set precio_base = 1 where id = '00000000-0000-0000-0000-0000001230f2';
reset role;
do $$
declare e public.evento_auditoria;
begin
  select * into e from public.evento_auditoria where entidad_tipo = 'servicio' and entidad_id = '00000000-0000-0000-0000-0000001230f1'
     and accion = 'SERVICIO_ACTUALIZADO';
  if e.id is null or (e.payload_antes ->> 'precio_base')::numeric <> 30000 or (e.payload_despues ->> 'precio_base')::numeric <> 35000 then
    raise exception 'FALLA 123: la edición del servicio no quedó con antes/después';
  end if;
  if e.actor_tipo <> 'BARBERIA' or e.actor_id <> '00000000-0000-0000-0000-0000001230a1' or e.origen <> 'PANEL' or e.request_id <> 'req-panel-1' then
    raise exception 'FALLA 123: actor/origen de la edición del panel incorrectos (% % % %)', e.actor_tipo, e.actor_id, e.origen, e.request_id;
  end if;
  if exists (select 1 from public.evento_auditoria where entidad_tipo = 'servicio' and entidad_id = '00000000-0000-0000-0000-0000001230f2'
              and accion = 'SERVICIO_ACTUALIZADO') then
    raise exception 'FALLA 123: el intento bloqueado sobre otro negocio dejó auditoría o modificó el servicio';
  end if;
  raise notice 'OK 123: edición del dueño auditada con actor BARBERIA, origen PANEL y request_id';
end $$;

-- ── 6. Aislamiento de lectura entre negocios ───────────────────────────────
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000001230a1","role":"authenticated"}', true);
do $$
declare n_propias int; n_ajenas int; n_globales int; n_rpc int; n_rpc_ajenas int;
begin
  select count(*) into n_propias from public.evento_auditoria where negocio_id = '00000000-0000-0000-0000-0000001230b1';
  select count(*) into n_ajenas from public.evento_auditoria where negocio_id = '00000000-0000-0000-0000-0000001230b2';
  select count(*) into n_globales from public.evento_auditoria where entidad_tipo in ('pais', 'plan', 'feature_flag');
  if n_propias = 0 then raise exception 'FALLA 123: el dueño no ve la auditoría de su negocio'; end if;
  if n_ajenas <> 0 then raise exception 'FALLA 123: el dueño A ve % filas del negocio B', n_ajenas; end if;
  if n_globales <> 0 then raise exception 'FALLA 123: el dueño ve configuración global de plataforma'; end if;

  select count(*), count(*) filter (where negocio_id is distinct from '00000000-0000-0000-0000-0000001230b1')
    into n_rpc, n_rpc_ajenas from public.auditoria_listar('00000000-0000-0000-0000-0000001230b1', null, null, null, null, 100, 0);
  if n_rpc = 0 or n_rpc_ajenas <> 0 then raise exception 'FALLA 123: auditoria_listar del dueño devolvió filas ajenas (% de %)', n_rpc_ajenas, n_rpc; end if;

  -- Filtro por entidad y por acción (con comodines escapados).
  if (select count(*) from public.auditoria_listar('00000000-0000-0000-0000-0000001230b1', 'servicio', 'servicio_actual', null, null, 100, 0)) <> 1 then
    raise exception 'FALLA 123: los filtros de auditoria_listar no funcionan';
  end if;
  if (select count(*) from public.auditoria_listar('00000000-0000-0000-0000-0000001230b1', null, '%', null, null, 100, 0)) <> 0 then
    raise exception 'FALLA 123: el filtro de acción no escapa el comodín %%';
  end if;

  begin
    perform * from public.auditoria_listar('00000000-0000-0000-0000-0000001230b2', null, null, null, null, 50, 0);
    raise exception 'FALLA 123: el dueño A listó la auditoría del negocio B';
  exception when others then
    if sqlerrm not like '%NO_AUTORIZADO%' then raise; end if;
  end;
  begin
    perform * from public.auditoria_entidades(null);
    raise exception 'FALLA 123: el dueño listó entidades globales';
  exception when others then
    if sqlerrm not like '%NO_AUTORIZADO%' then raise; end if;
  end;
  raise notice 'OK 123: el dueño A ve solo su negocio (RLS y auditoria_listar)';
end $$;

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000001230a2","role":"authenticated"}', true);
do $$
declare n int;
begin
  select count(*) into n from public.evento_auditoria where negocio_id = '00000000-0000-0000-0000-0000001230b1';
  if n <> 0 then raise exception 'FALLA 123: el dueño B ve % filas del negocio A', n; end if;
  begin
    perform * from public.auditoria_listar('00000000-0000-0000-0000-0000001230b1', null, null, null, null, 50, 0);
    raise exception 'FALLA 123: el dueño B listó la auditoría del negocio A';
  exception when others then
    if sqlerrm not like '%NO_AUTORIZADO%' then raise; end if;
  end;
  raise notice 'OK 123: otro dueño no ve ninguna fila del negocio A';
end $$;

-- SuperSU ve todo, con request_id; el dueño no recibe request_id ni el nombre del SuperSU.
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000001230a4","role":"authenticated"}', true);
do $$ begin
  if not exists (select 1 from public.auditoria_listar(null, 'pais', null, now() - interval '1 hour', now() + interval '1 hour', 50, 0)
                  where request_id = 'abc' and actor_tipo = 'SUPERSU') then
    raise exception 'FALLA 123: SuperSU no ve la auditoría global con request_id';
  end if;
  if not exists (select 1 from public.auditoria_listar('00000000-0000-0000-0000-0000001230b2', null, null, null, null, 50, 0)) then
    raise exception 'FALLA 123: SuperSU no ve la auditoría de un negocio';
  end if;
  raise notice 'OK 123: SuperSU ve toda la auditoría con filtros';
end $$;
reset role;

-- anon no ejecuta nada de auditoría; nadie de la API ejecuta el helper interno.
set local role anon;
do $$ begin
  begin
    perform * from public.auditoria_listar(null, null, null, null, null, 50, 0);
    raise exception 'FALLA 123: anon ejecutó auditoria_listar';
  exception when insufficient_privilege then null;
  end;
  raise notice 'OK 123: anon sin acceso a la auditoría';
end $$;
reset role;
-- En producción la migración corre DESPUÉS de los default privileges que emula el bloque de paridad:
-- se repiten aquí sus dos revocaciones de tabla para comprobar que dejan cerrados los cuatro roles.
revoke insert, update, delete, truncate on public.evento_auditoria from public, anon, authenticated;
revoke update, delete, truncate on public.evento_auditoria from service_role;
do $$
declare r text;
begin
  foreach r in array array['anon', 'authenticated', 'service_role'] loop
    if has_function_privilege(r, 'public._auditar(text, uuid, text, uuid, jsonb, jsonb, text)', 'execute') then
      raise exception 'FALLA 123: % puede ejecutar _auditar', r;
    end if;
    if has_function_privilege(r, 'public._auditoria_limpiar(jsonb)', 'execute') then
      raise exception 'FALLA 123: % puede ejecutar _auditoria_limpiar', r;
    end if;
    if has_table_privilege(r, 'public.evento_auditoria', 'update') or has_table_privilege(r, 'public.evento_auditoria', 'delete') then
      raise exception 'FALLA 123: % tiene UPDATE/DELETE sobre evento_auditoria', r;
    end if;
    if r <> 'service_role' and has_table_privilege(r, 'public.evento_auditoria', 'insert') then
      raise exception 'FALLA 123: % tiene INSERT sobre evento_auditoria', r;
    end if;
  end loop;
  raise notice 'OK 123: helpers internos y escritura de la tabla cerrados a los roles de API';
end $$;

-- ── 7. Inmutabilidad: nadie (ni service_role) modifica ni borra la auditoría ──
-- Se re-otorgan UPDATE/DELETE para probar la ÚLTIMA barrera (el trigger), como en producción si un grant volviera.
grant update, delete on public.evento_auditoria to service_role, authenticated;
grant truncate on public.evento_auditoria to service_role;
set local role service_role;
do $$ begin
  begin
    update public.evento_auditoria set motivo = 'alterado' where entidad_tipo = 'pais';
    raise exception 'FALLA 123: service_role alteró la auditoría';
  exception when others then
    if sqlerrm not like '%REGISTRO_INMUTABLE%' then raise; end if;
  end;
  begin
    delete from public.evento_auditoria where entidad_tipo = 'pais';
    raise exception 'FALLA 123: service_role borró auditoría';
  exception when others then
    if sqlerrm not like '%REGISTRO_INMUTABLE%' then raise; end if;
  end;
  begin
    truncate public.evento_auditoria;
    raise exception 'FALLA 123: service_role vació la auditoría con TRUNCATE';
  exception when others then
    if sqlerrm not like '%REGISTRO_INMUTABLE%' then raise; end if;
  end;
  raise notice 'OK 123: auditoría inmutable para service_role (UPDATE, DELETE y TRUNCATE)';
end $$;
reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000001230a4","role":"authenticated"}', true);
do $$
declare n int;
begin
  begin
    update public.evento_auditoria set motivo = 'alterado' where negocio_id = '00000000-0000-0000-0000-0000001230b1';
    get diagnostics n = row_count;
    if n > 0 then raise exception 'FALLA 123: SuperSU alteró % filas de auditoría', n; end if;
  exception when others then
    if sqlerrm like 'FALLA%' then raise; end if;
    if sqlerrm not like '%REGISTRO_INMUTABLE%' and sqlstate <> '42501' then raise; end if;
  end;
  begin
    delete from public.evento_auditoria where negocio_id = '00000000-0000-0000-0000-0000001230b1';
    get diagnostics n = row_count;
    if n > 0 then raise exception 'FALLA 123: SuperSU borró % filas de auditoría', n; end if;
  exception when others then
    if sqlerrm like 'FALLA%' then raise; end if;
    if sqlerrm not like '%REGISTRO_INMUTABLE%' and sqlstate <> '42501' then raise; end if;
  end;
  raise notice 'OK 123: auditoría inmutable para authenticated (incluido SuperSU)';
end $$;
reset role;

do $$ begin raise notice 'TODAS LAS PRUEBAS 123 PASARON'; end $$;
rollback;

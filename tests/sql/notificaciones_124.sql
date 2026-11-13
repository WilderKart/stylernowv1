-- Pruebas de comportamiento de la migración 124 (outbox de notificaciones: email, push y panel).
--
-- Se corren contra la base LOCAL (supabase start), nunca contra producción:
--   docker exec -i supabase_db_stylernow psql -U postgres -d postgres -v ON_ERROR_STOP=1 -q < tests/sql/notificaciones_124.sql
-- Todo ocurre dentro de una transacción que termina en ROLLBACK: no deja datos.
-- Cada bloque lanza 'FALLA: …' si el comportamiento no es el esperado; ON_ERROR_STOP corta en el primero.

begin;

-- Paridad con producción: allí service_role tiene todos los privilegios de tabla y
-- authenticated lee con RLS (default privileges de Supabase). La CLI local nueva no los
-- otorga, así que se emulan aquí. Con esto, la máquina de estados se prueba contra los
-- TRIGGERS (última barrera), no solo contra la falta de permisos.
grant select, insert, update, delete on all tables in schema public to service_role;
grant usage, select on all sequences in schema public to service_role;
grant select on all tables in schema public to authenticated;
-- En producción la 124 revoca DESPUÉS de los default privileges; se reproduce ese estado final.
revoke all on public.notificacion_push_suscripcion from authenticated;
grant select (id, usuario_id, endpoint, created_at) on public.notificacion_push_suscripcion to authenticated;
revoke all on public.notificacion_outbox_evento, public.notificacion_plantilla, public.notificacion_evento from authenticated;

-- ── Datos de prueba (como postgres) ─────────────────────────────────────────
-- a1 dueño de b1 (idioma en) · a2 cliente · a3 intruso
insert into auth.users (id, email, aud, role) values
  ('00000000-0000-0000-0000-0000000002a1', 'nt-dueno@test.local', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000002a2', 'nt-cliente@test.local', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000002a3', 'nt-intruso@test.local', 'authenticated', 'authenticated');

insert into public.perfil (id, nombre) values
  ('00000000-0000-0000-0000-0000000002a1', 'Dueño NT'), ('00000000-0000-0000-0000-0000000002a2', 'Ana <b>Cliente</b>'),
  ('00000000-0000-0000-0000-0000000002a3', 'Intruso NT')
on conflict (id) do nothing;
update public.perfil set locale = 'en' where id = '00000000-0000-0000-0000-0000000002a1';
-- Nombre con HTML: el PANEL lo guarda como texto (React lo escapa); el EMAIL lo escapa el renderizador TS.
update public.perfil set nombre = 'Ana <b>Cliente</b>' where id = '00000000-0000-0000-0000-0000000002a2';

insert into public.negocio (id, owner_user_id, nombre, slug, ciudad, pais_codigo)
values ('00000000-0000-0000-0000-0000000002b1', '00000000-0000-0000-0000-0000000002a1', 'Barbería NT', 'barberia-nt-124', 'Cali', 'CO');
insert into public.sede (id, negocio_id, nombre, direccion, ciudad)
values ('00000000-0000-0000-0000-0000000002c1', '00000000-0000-0000-0000-0000000002b1', 'Principal', 'Cra 1', 'Cali');
insert into public.suscripcion (negocio_id, plan_codigo, estado, fecha_proximo_cobro)
select '00000000-0000-0000-0000-0000000002b1', (select codigo from public.plan order by codigo limit 1), 'ACTIVA', now() + interval '30 days'
where not exists (select 1 from public.suscripcion where negocio_id = '00000000-0000-0000-0000-0000000002b1');
update public.suscripcion set estado = 'ACTIVA' where negocio_id = '00000000-0000-0000-0000-0000000002b1';
insert into public.conexion_pago_negocio (negocio_id, estado, entorno, cuenta_externa_id, access_token_cifrado, token_expira_at, conectada_at)
values ('00000000-0000-0000-0000-0000000002b1', 'CONECTADA', 'SANDBOX', '223456789', 'v1.iv.tag.datos', now() + interval '180 days', now());

-- ── Suscripción push: validación y alta como el propio usuario ─────────────
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000002a2","role":"authenticated"}', true);
do $$ begin
  begin
    perform public.notif_push_suscribir('https://evil.example.com/push/abc', repeat('A', 87), repeat('B', 22));
    raise exception 'FALLA 124: se aceptó un endpoint push fuera de la lista de servicios conocidos';
  exception when others then
    if sqlerrm not like '%SUSCRIPCION_PUSH_INVALIDA%' then raise; end if;
  end;
  begin
    perform public.notif_push_suscribir('https://fcm.googleapis.com/fcm/send/abc', 'corto', repeat('B', 22));
    raise exception 'FALLA 124: se aceptó una clave p256dh inválida';
  exception when others then
    if sqlerrm not like '%SUSCRIPCION_PUSH_INVALIDA%' then raise; end if;
  end;
  perform public.notif_push_suscribir('https://fcm.googleapis.com/fcm/send/nt-124-a2', repeat('A', 87), repeat('B', 22));
  raise notice 'OK 124: suscripción push validada (solo servicios conocidos y claves con formato)';
end $$;
reset role;

-- ── Productor de reserva: crea una vez por evento, canal y destinatario ────
insert into public.reserva (id, cliente_id, negocio_id, sede_id, hora_inicio, hora_fin, estado, monto_total, monto_sena) values
  ('00000000-0000-0000-0000-0000000002d1', '00000000-0000-0000-0000-0000000002a2', '00000000-0000-0000-0000-0000000002b1',
   '00000000-0000-0000-0000-0000000002c1', now() + interval '10 hours', now() + interval '11 hours', 'CONFIRMADA', 50000, 0);

do $$
declare n_cli int; n_neg int; n_nuevo int; v_idioma text;
begin
  select count(*) into n_cli from public.notificacion_outbox
   where evento = 'RESERVA_CONFIRMADA' and usuario_id = '00000000-0000-0000-0000-0000000002a2'
     and datos->>'reserva_id' = '00000000-0000-0000-0000-0000000002d1';
  if n_cli <> 2 then raise exception 'FALLA 124: se esperaban 2 avisos al cliente (EMAIL+PUSH), hubo %', n_cli; end if;
  select count(*), min(idioma) into n_neg, v_idioma from public.notificacion_outbox
   where evento = 'NEGOCIO_RESERVA_NUEVA' and usuario_id = '00000000-0000-0000-0000-0000000002a1';
  -- El dueño no tiene suscripción push: EMAIL + PANEL.
  if n_neg <> 2 or v_idioma <> 'en' then raise exception 'FALLA 124: aviso al negocio mal encolado (% filas, idioma %)', n_neg, v_idioma; end if;
  select count(*) into n_nuevo from public.notificacion_outbox where evento = 'NEGOCIO_CLIENTE_NUEVO';
  if n_nuevo <> 2 then raise exception 'FALLA 124: cliente nuevo debía encolarse (EMAIL+PANEL), hubo %', n_nuevo; end if;
  if exists (select 1 from public.notificacion_outbox where estado <> 'PENDIENTE') then
    raise exception 'FALLA 124: todo lo encolado debe nacer PENDIENTE';
  end if;
  raise notice 'OK 124: reserva confirmada → cliente (EMAIL+PUSH), dueño (EMAIL+PANEL, en su idioma), cliente nuevo';
end $$;

-- Actualizaciones duplicadas y reconfirmaciones no duplican.
update public.reserva set estado = 'CONFIRMADA' where id = '00000000-0000-0000-0000-0000000002d1';
update public.reserva set estado = 'PENDIENTE_PAGO' where id = '00000000-0000-0000-0000-0000000002d1';
update public.reserva set estado = 'CONFIRMADA' where id = '00000000-0000-0000-0000-0000000002d1';
update public.reserva set hora_inicio = hora_inicio + interval '1 hour', hora_fin = hora_fin + interval '1 hour'
 where id = '00000000-0000-0000-0000-0000000002d1';
update public.reserva set hora_inicio = hora_inicio where id = '00000000-0000-0000-0000-0000000002d1';
do $$
declare n_conf int; n_rep int; n_neg int; a uuid; b uuid;
begin
  select count(*) into n_conf from public.notificacion_outbox where evento = 'RESERVA_CONFIRMADA';
  select count(*) into n_rep from public.notificacion_outbox where evento = 'RESERVA_REPROGRAMADA';
  select count(*) into n_neg from public.notificacion_outbox where evento = 'NEGOCIO_RESERVA_REPROGRAMADA';
  if n_conf <> 2 then raise exception 'FALLA 124: la reconfirmación duplicó avisos (%)', n_conf; end if;
  if n_rep <> 2 or n_neg <> 2 then raise exception 'FALLA 124: reprogramación mal encolada (% / %)', n_rep, n_neg; end if;
  a := public._encolar_notificacion('RESERVA_CONFIRMADA', '00000000-0000-0000-0000-0000000002a2', null, 'EMAIL', '{}', 'manual:x');
  b := public._encolar_notificacion('RESERVA_CONFIRMADA', '00000000-0000-0000-0000-0000000002a2', null, 'EMAIL', '{}', 'manual:x');
  if a is null or a is distinct from b then raise exception 'FALLA 124: _encolar_notificacion no es idempotente'; end if;
  raise notice 'OK 124: idempotencia (updates repetidos y claves repetidas no duplican)';
end $$;

-- ── Un productor que falla nunca aborta la transacción de la reserva ──────
alter table public.notificacion_outbox add constraint prueba_falla_productor check (false) not valid;
insert into public.reserva (id, cliente_id, negocio_id, sede_id, hora_inicio, hora_fin, estado, monto_total, monto_sena) values
  ('00000000-0000-0000-0000-0000000002d2', '00000000-0000-0000-0000-0000000002a2', '00000000-0000-0000-0000-0000000002b1',
   '00000000-0000-0000-0000-0000000002c1', now() + interval '20 hours', now() + interval '21 hours', 'CONFIRMADA', 50000, 0);
update public.reserva set estado = 'CANCELADA', cancelado_por = 'NEGOCIO' where id = '00000000-0000-0000-0000-0000000002d2';
alter table public.notificacion_outbox drop constraint prueba_falla_productor;
do $$ begin
  if not exists (select 1 from public.reserva where id = '00000000-0000-0000-0000-0000000002d2' and estado = 'CANCELADA') then
    raise exception 'FALLA 124: el fallo del productor abortó la reserva';
  end if;
  if exists (select 1 from public.notificacion_outbox where datos->>'reserva_id' = '00000000-0000-0000-0000-0000000002d2') then
    raise exception 'FALLA 124: no debía quedar nada encolado si el outbox rechazaba filas';
  end if;
  if not exists (select 1 from public.notificacion_usuario where reserva_id = '00000000-0000-0000-0000-0000000002d2') then
    raise exception 'FALLA 124: el aviso in-app de 093 debía seguir funcionando';
  end if;
  raise notice 'OK 124: un productor que falla no aborta la reserva ni rompe 093';
end $$;

-- ── Marketing exige consentimiento ─────────────────────────────────────────
set local role service_role;
do $$
declare v_id uuid; v_estado text; v_err text;
begin
  v_id := public._encolar_notificacion('MARKETING_NOVEDADES', '00000000-0000-0000-0000-0000000002a2', null, 'EMAIL', '{}', 'mk:1');
  select estado, ultimo_error into v_estado, v_err from public.notificacion_outbox where id = v_id;
  if v_estado <> 'OMITIDO_PREFERENCIA' or v_err <> 'SIN_CONSENTIMIENTO_MARKETING' then
    raise exception 'FALLA 124: marketing sin consentimiento debía quedar OMITIDO_PREFERENCIA (% / %)', v_estado, v_err;
  end if;
  v_id := public._encolar_notificacion('MARKETING_NOVEDADES', '00000000-0000-0000-0000-0000000002a2', null, 'PUSH', '{}', 'mk:1');
  select estado into v_estado from public.notificacion_outbox where id = v_id;
  if v_estado <> 'OMITIDO_PREFERENCIA' then raise exception 'FALLA 124: marketing push sin opt-in debía omitirse (%)', v_estado; end if;
  raise notice 'OK 124: marketing sin consentimiento → OMITIDO_PREFERENCIA (email y push)';
end $$;
reset role;

insert into public.consentimiento_evento (usuario_id, proposito, otorgado, origen)
values ('00000000-0000-0000-0000-0000000002a2', 'marketing_email', true, 'centro_privacidad');
set local role service_role;
do $$
declare v_id uuid;
begin
  v_id := public._encolar_notificacion('MARKETING_NOVEDADES', '00000000-0000-0000-0000-0000000002a2', null, 'EMAIL', '{}', 'mk:2');
  if (select estado from public.notificacion_outbox where id = v_id) <> 'PENDIENTE' then
    raise exception 'FALLA 124: con consentimiento el marketing debía encolarse';
  end if;
  raise notice 'OK 124: con consentimiento vigente, marketing PENDIENTE';
end $$;
reset role;
-- Retira el consentimiento antes del envío: el worker no debe enviarlo.
insert into public.consentimiento_evento (usuario_id, proposito, otorgado, origen, created_at)
values ('00000000-0000-0000-0000-0000000002a2', 'marketing_email', false, 'centro_privacidad', now() + interval '1 second');

-- ── Preferencias ───────────────────────────────────────────────────────────
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000002a2","role":"authenticated"}', true);
do $$ begin
  perform public.notif_preferencia_guardar('RESERVA_RECORDATORIO', 'EMAIL', false);
  perform public.notif_preferencia_guardar('RESERVA_CONFIRMADA', 'PUSH', false);
  begin
    perform public.notif_preferencia_guardar('RESERVA_CONFIRMADA', 'EMAIL', false);
    raise exception 'FALLA 124: se desactivó el correo de un evento esencial';
  exception when others then
    if sqlerrm not like '%PREFERENCIA_ESENCIAL%' then raise; end if;
  end;
  begin
    perform public.notif_preferencia_guardar('RESERVA_RECORDATORIO', 'WHATSAPP_API', false);
    raise exception 'FALLA 124: se aceptó un canal inválido';
  exception when others then
    if sqlerrm not like '%VALOR_INVALIDO%' then raise; end if;
  end;
  raise notice 'OK 124: preferencias por evento/canal; el email esencial no se apaga';
end $$;
reset role;
set local role service_role;
do $$
declare v_id uuid;
begin
  v_id := public._encolar_notificacion('RESERVA_RECORDATORIO', '00000000-0000-0000-0000-0000000002a2', null, 'EMAIL', '{}', 'pref:1');
  if (select estado from public.notificacion_outbox where id = v_id) <> 'OMITIDO_PREFERENCIA' then
    raise exception 'FALLA 124: la preferencia desactivada no se respetó';
  end if;
  v_id := public._encolar_notificacion('RESERVA_CONFIRMADA', '00000000-0000-0000-0000-0000000002a2', null, 'PUSH', '{}', 'pref:2');
  if (select estado from public.notificacion_outbox where id = v_id) <> 'OMITIDO_PREFERENCIA' then
    raise exception 'FALLA 124: el push de un evento esencial sí se puede desactivar';
  end if;
  raise notice 'OK 124: preferencias aplicadas al encolar';
end $$;
reset role;

-- ── Worker: lote, ENVIADO con evidencia, reintentos y máquina de estados ──
set local role service_role;
do $$
declare n int; v_id uuid; v_estado text; v_prox timestamptz; v_mk text;
begin
  select count(*) into n from public.notif_outbox_tomar(100, array['EMAIL', 'PUSH']);
  if n < 4 then raise exception 'FALLA 124: el worker debía tomar el lote pendiente, tomó %', n; end if;
  select estado into v_mk from public.notificacion_outbox where idempotency_key like 'mk:2:EMAIL:%';
  if v_mk <> 'OMITIDO_PREFERENCIA' then raise exception 'FALLA 124: consentimiento retirado y aun así se tomó para envío (%)', v_mk; end if;
  if exists (select 1 from public.notificacion_outbox where canal = 'PANEL' and estado <> 'PENDIENTE') then
    raise exception 'FALLA 124: el lote EMAIL/PUSH no debe tomar filas PANEL';
  end if;

  select id into v_id from public.notificacion_outbox where estado = 'PROCESANDO' and canal = 'EMAIL' order by created_at limit 1;
  begin
    perform public.notif_outbox_registrar(v_id, true, null, null, false);
    raise exception 'FALLA 124: ENVIADO sin id_externo';
  exception when others then
    if sqlerrm not like '%ENVIADO_REQUIERE_ID_EXTERNO%' then raise; end if;
  end;
  begin
    update public.notificacion_outbox set estado = 'ENVIADO', enviado_at = now() where id = v_id;
    raise exception 'FALLA 124: service_role marcó ENVIADO sin id_externo con un UPDATE directo';
  exception when others then
    if sqlerrm not like '%ENVIADO_REQUIERE_ID_EXTERNO%' and sqlerrm not like '%enviado_con_evidencia%' then raise; end if;
  end;
  v_estado := public.notif_outbox_registrar(v_id, true, 're_123', null, false);
  if v_estado <> 'ENVIADO' then raise exception 'FALLA 124: con id_externo debía quedar ENVIADO (%)', v_estado; end if;
  -- Registrar dos veces es inocuo.
  if public.notif_outbox_registrar(v_id, false, null, 'HTTP_500', true) <> 'ENVIADO' then
    raise exception 'FALLA 124: un segundo registro alteró un ENVIADO';
  end if;

  -- Fallo reintentable → REINTENTANDO con backoff; no reintentable → FALLIDO; sin proveedor → CANAL_NO_HABILITADO.
  select id into v_id from public.notificacion_outbox where estado = 'PROCESANDO' order by created_at limit 1;
  v_estado := public.notif_outbox_registrar(v_id, false, null, 'HTTP_503', true);
  select proximo_intento_at into v_prox from public.notificacion_outbox where id = v_id;
  if v_estado <> 'REINTENTANDO' or v_prox <= now() then raise exception 'FALLA 124: reintento sin backoff (% / %)', v_estado, v_prox; end if;
  select id into v_id from public.notificacion_outbox where estado = 'PROCESANDO' order by created_at limit 1;
  if public.notif_outbox_registrar(v_id, false, null, 'HTTP_422', false) <> 'FALLIDO' then
    raise exception 'FALLA 124: error no reintentable debía quedar FALLIDO';
  end if;
  select id into v_id from public.notificacion_outbox where estado = 'PROCESANDO' order by created_at limit 1;
  if public.notif_outbox_registrar(v_id, false, null, 'CANAL_NO_HABILITADO', false) <> 'CANAL_NO_HABILITADO' then
    raise exception 'FALLA 124: sin proveedor debía quedar CANAL_NO_HABILITADO';
  end if;
  if public.notif_outbox_reencolar_no_habilitados('EMAIL', 24) + public.notif_outbox_reencolar_no_habilitados('PUSH', 24) < 1 then
    raise exception 'FALLA 124: al habilitar el canal, lo no habilitado debía volver a la cola';
  end if;
  raise notice 'OK 124: ENVIADO exige id_externo; reintento con backoff; FALLIDO; CANAL_NO_HABILITADO y reencolado';

  -- Intentos máximos: al agotar, FALLIDO aunque sea reintentable.
  update public.notificacion_outbox set estado = 'PROCESANDO', intentos = 5
   where id = (select id from public.notificacion_outbox where estado = 'REINTENTANDO' limit 1)
  returning id into v_id;
  if public.notif_outbox_registrar(v_id, false, null, 'HTTP_503', true) <> 'FALLIDO' then
    raise exception 'FALLA 124: al agotar intentos debía quedar FALLIDO';
  end if;
  raise notice 'OK 124: tope de intentos';
end $$;

do $$
declare v_env uuid; v_pen uuid;
begin
  select id into v_env from public.notificacion_outbox where estado = 'ENVIADO' limit 1;
  select id into v_pen from public.notificacion_outbox where estado = 'PENDIENTE' limit 1;
  begin
    update public.notificacion_outbox set estado = 'PENDIENTE' where id = v_env;
    raise exception 'FALLA 124: service_role reabrió un ENVIADO';
  exception when others then
    if sqlerrm not like '%TRANSICION_OUTBOX_INVALIDA%' then raise; end if;
  end;
  begin
    update public.notificacion_outbox set estado = 'ENVIADO', id_externo = 'inventado' where id = v_pen;
    raise exception 'FALLA 124: service_role saltó de PENDIENTE a ENVIADO';
  exception when others then
    if sqlerrm not like '%TRANSICION_OUTBOX_INVALIDA%' then raise; end if;
  end;
  begin
    update public.notificacion_outbox set id_externo = 'otro' where id = v_env;
    raise exception 'FALLA 124: se alteró la evidencia de un ENVIADO';
  exception when others then
    if sqlerrm not like '%OUTBOX_REGISTRO_CERRADO%' then raise; end if;
  end;
  begin
    update public.notificacion_outbox set datos = '{"x":1}' where id = v_pen;
    raise exception 'FALLA 124: se alteraron los datos de un mensaje';
  exception when others then
    if sqlerrm not like '%OUTBOX_CAMPO_INMUTABLE%' then raise; end if;
  end;
  begin
    delete from public.notificacion_outbox where id = v_pen;
    raise exception 'FALLA 124: se borró una fila del outbox';
  exception when others then
    if sqlerrm not like '%REGISTRO_INMUTABLE%' then raise; end if;
  end;
  begin
    insert into public.notificacion_outbox (evento, usuario_id, canal, categoria, plantilla, idempotency_key, estado, id_externo, enviado_at)
    values ('RESERVA_CONFIRMADA', '00000000-0000-0000-0000-0000000002a2', 'EMAIL', 'TRANSACCIONAL', 'RESERVA_CONFIRMADA', 'directo:1', 'ENVIADO', 'x', now());
    raise exception 'FALLA 124: se insertó una fila ya ENVIADA';
  exception when others then
    if sqlerrm not like '%OUTBOX_ESTADO_INICIAL_INVALIDO%' then raise; end if;
  end;
  begin
    update public.notificacion_outbox_evento set detalle = 'x' where outbox_id = v_env;
    raise exception 'FALLA 124: se alteró el historial';
  exception when others then
    if sqlerrm not like '%REGISTRO_INMUTABLE%' then raise; end if;
  end;
  if (select count(*) from public.notificacion_outbox_evento where outbox_id = v_env) < 3 then
    raise exception 'FALLA 124: el historial debía registrar PENDIENTE → PROCESANDO → ENVIADO';
  end if;
  raise notice 'OK 124: transiciones inválidas, campos inmutables, borrado e historial (también para service_role)';
end $$;

-- Canal PANEL: entrega dentro de la base con evidencia (id de notificacion_usuario).
do $$
declare n int; v_ext text; v_tit text;
begin
  n := public.notif_entregar_panel(100);
  if n < 2 then raise exception 'FALLA 124: el panel debía entregar al menos 2, entregó %', n; end if;
  select id_externo into v_ext from public.notificacion_outbox
   where canal = 'PANEL' and evento = 'NEGOCIO_RESERVA_NUEVA' and estado = 'ENVIADO';
  if v_ext not like 'notificacion_usuario:%' then raise exception 'FALLA 124: PANEL ENVIADO sin evidencia (%)', v_ext; end if;
  select titulo into v_tit from public.notificacion_usuario where id = substr(v_ext, 22)::uuid;
  if v_tit <> 'New booking: Ana <b>Cliente</b>' then raise exception 'FALLA 124: plantilla PANEL mal renderizada: %', v_tit; end if;
  if public.notif_entregar_panel(100) <> 0 then raise exception 'FALLA 124: el panel entregó dos veces'; end if;
  raise notice 'OK 124: PANEL entregado una vez, en el idioma del destinatario, con evidencia';
end $$;
reset role;

-- ── Pagos y reembolsos: solo desde estados confirmados en la base ──────────
insert into public.reserva (id, cliente_id, negocio_id, sede_id, hora_inicio, hora_fin, estado, monto_total, monto_sena) values
  ('00000000-0000-0000-0000-0000000002d3', '00000000-0000-0000-0000-0000000002a2', '00000000-0000-0000-0000-0000000002b1',
   '00000000-0000-0000-0000-0000000002c1', now() + interval '50 hours', now() + interval '51 hours', 'PENDIENTE_PAGO', 50000, 10000);
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000002a2","role":"authenticated"}', true);
select public.aceptar_politica_reserva('00000000-0000-0000-0000-0000000002d3') is not null as aceptada \gset
reset role;
insert into public.pago (id, reserva_id, negocio_id, tipo, monto, estado) values
  ('00000000-0000-0000-0000-0000000002e0', '00000000-0000-0000-0000-0000000002d3', '00000000-0000-0000-0000-0000000002b1', 'SENA', 10000, 'PENDIENTE');
update public.pago set estado = 'RECHAZADO' where id = '00000000-0000-0000-0000-0000000002e0';
insert into public.pago (id, reserva_id, negocio_id, tipo, monto, estado) values
  ('00000000-0000-0000-0000-0000000002e9', '00000000-0000-0000-0000-0000000002d1', '00000000-0000-0000-0000-0000000002b1', 'SALDO', 40000, 'APROBADO');
insert into public.pago (id, reserva_id, negocio_id, tipo, monto, estado, id_transaccion_pasarela, comision_plataforma_monto) values
  ('00000000-0000-0000-0000-0000000002e1', '00000000-0000-0000-0000-0000000002d3', '00000000-0000-0000-0000-0000000002b1', 'SENA', 10000, 'APROBADO', '9124001', 0);
update public.reserva set estado = 'CONFIRMADA' where id = '00000000-0000-0000-0000-0000000002d3';
do $$ begin
  if not exists (select 1 from public.notificacion_outbox where evento = 'PAGO_RECHAZADO' and idempotency_key like 'pago:00000000-0000-0000-0000-0000000002e0:rechazado:%') then
    raise exception 'FALLA 124: pago RECHAZADO sin aviso';
  end if;
  if exists (select 1 from public.notificacion_outbox where idempotency_key like 'pago:00000000-0000-0000-0000-0000000002e9:%') then
    raise exception 'FALLA 124: APROBADO sin id de transacción no es una confirmación y no debía notificarse';
  end if;
  if (select count(*) from public.notificacion_outbox where evento = 'ANTICIPO_RECIBIDO') <> 2
     or (select count(*) from public.notificacion_outbox where evento = 'NEGOCIO_ANTICIPO_RECIBIDO') <> 2 then
    raise exception 'FALLA 124: anticipo confirmado mal notificado';
  end if;
  if (select datos->>'monto' from public.notificacion_outbox where evento = 'ANTICIPO_RECIBIDO' limit 1) <> '10.000 COP' then
    raise exception 'FALLA 124: monto mal formateado: %', (select datos->>'monto' from public.notificacion_outbox where evento = 'ANTICIPO_RECIBIDO' limit 1);
  end if;
  raise notice 'OK 124: pago APROBADO (con id de transacción) y RECHAZADO notifican; APROBADO sin evidencia no';
end $$;

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000002a2","role":"authenticated"}', true);
select (public.cancelar_reserva('00000000-0000-0000-0000-0000000002d3', null))->>'reembolso_id' as reembolso_id \gset
reset role;
set local role service_role;
do $$
declare v_r public.reembolso;
begin
  select * into v_r from public.reembolso where pago_id = '00000000-0000-0000-0000-0000000002e1';
  if not exists (select 1 from public.notificacion_outbox where evento = 'REEMBOLSO_SOLICITADO' and idempotency_key like 'reembolso:' || v_r.id || ':%') then
    raise exception 'FALLA 124: reembolso creado sin aviso de solicitud';
  end if;
  if exists (select 1 from public.notificacion_outbox where evento = 'REEMBOLSO_CONFIRMADO') then
    raise exception 'FALLA 124: se avisó confirmación antes de la pasarela';
  end if;
  perform public.reembolso_tomar_pendientes(10);
  perform public.reembolso_registrar_resultado(v_r.id, 'pending', '888', null);
  if exists (select 1 from public.notificacion_outbox where evento = 'REEMBOLSO_CONFIRMADO') then
    raise exception 'FALLA 124: PROCESANDO no es confirmación';
  end if;
  perform public.reembolso_registrar_resultado(v_r.id, 'approved', '888', null);
  perform public.reembolso_registrar_resultado(v_r.id, 'approved', '888', null);
  if (select count(*) from public.notificacion_outbox where evento = 'REEMBOLSO_CONFIRMADO') <> 2 then
    raise exception 'FALLA 124: reembolso confirmado debía avisarse una vez por canal';
  end if;
  if (select count(*) from public.notificacion_outbox where evento = 'NEGOCIO_RESERVA_CANCELADA' and datos->>'reserva_id' = '00000000-0000-0000-0000-0000000002d3') <> 2 then
    raise exception 'FALLA 124: la cancelación debía avisar al negocio';
  end if;
  raise notice 'OK 124: reembolso solicitado → aviso; confirmado solo con REEMBOLSADO; sin duplicados';
end $$;
reset role;

-- ── Suscripción ────────────────────────────────────────────────────────────
update public.suscripcion set estado = 'EN_MORA' where negocio_id = '00000000-0000-0000-0000-0000000002b1';
update public.suscripcion set estado = 'EN_MORA' where negocio_id = '00000000-0000-0000-0000-0000000002b1';
update public.suscripcion set estado = 'SUSPENDIDA' where negocio_id = '00000000-0000-0000-0000-0000000002b1';
do $$ begin
  if (select count(*) from public.notificacion_outbox where evento = 'SUSCRIPCION_VENCIDA') <> 2
     or (select count(*) from public.notificacion_outbox where evento = 'SUSCRIPCION_SUSPENDIDA') <> 2 then
    raise exception 'FALLA 124: avisos de suscripción mal encolados';
  end if;
  raise notice 'OK 124: plan vencido y suspendido avisan al dueño una vez';
end $$;

-- Recordatorios programados: idempotentes al correr el cron varias veces.
set local role service_role;
do $$
declare n1 int; n2 int;
begin
  perform public.notif_generar_programadas(24);
  select count(*) into n1 from public.notificacion_outbox where evento = 'RESERVA_RECORDATORIO' and idempotency_key like 'reserva:%';
  perform public.notif_generar_programadas(24);
  select count(*) into n2 from public.notificacion_outbox where evento = 'RESERVA_RECORDATORIO' and idempotency_key like 'reserva:%';
  if n1 < 1 or n1 <> n2 then raise exception 'FALLA 124: recordatorios no idempotentes (% / %)', n1, n2; end if;
  raise notice 'OK 124: recordatorio programado idempotente';
end $$;
reset role;

-- ── Aislamiento: cada usuario ve solo lo suyo ──────────────────────────────
insert into public.notificacion_push_suscripcion (usuario_id, endpoint, p256dh, auth)
values ('00000000-0000-0000-0000-0000000002a1', 'https://updates.push.services.mozilla.com/wpush/v2/nt-a1', repeat('C', 87), repeat('D', 22));
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000002a2","role":"authenticated"}', true);
do $$
declare n_ajenas int; n_propias int;
begin
  select count(*) filter (where usuario_id <> '00000000-0000-0000-0000-0000000002a2'), count(*) filter (where usuario_id = '00000000-0000-0000-0000-0000000002a2')
    into n_ajenas, n_propias from public.notificacion_outbox;
  if n_ajenas <> 0 or n_propias = 0 then raise exception 'FALLA 124: outbox visible entre usuarios (ajenas %, propias %)', n_ajenas, n_propias; end if;
  if exists (select 1 from public.notificacion_preferencia where usuario_id <> '00000000-0000-0000-0000-0000000002a2')
     or not exists (select 1 from public.notificacion_preferencia) then
    raise exception 'FALLA 124: preferencias visibles entre usuarios';
  end if;
  if (select count(*) from public.notificacion_push_suscripcion) <> 1 then
    raise exception 'FALLA 124: suscripciones push visibles entre usuarios';
  end if;
  begin
    perform p256dh from public.notificacion_push_suscripcion;
    raise exception 'FALLA 124: las claves del navegador se pueden leer por la API';
  exception when insufficient_privilege then null;
  end;
  begin
    perform 1 from public.notificacion_outbox_evento;
    raise exception 'FALLA 124: authenticated lee el historial interno';
  exception when insufficient_privilege then null;
  end;
  if not public.notif_push_desuscribir('https://fcm.googleapis.com/fcm/send/nt-124-a2') then
    raise exception 'FALLA 124: el usuario no pudo quitar su propia suscripción';
  end if;
  if public.notif_push_desuscribir('https://updates.push.services.mozilla.com/wpush/v2/nt-a1') then
    raise exception 'FALLA 124: un usuario borró la suscripción de otro';
  end if;
  raise notice 'OK 124: outbox, preferencias y suscripciones aisladas por usuario';
end $$;

-- authenticated no ejecuta funciones del worker ni de encolado.
do $$
declare f text;
begin
  foreach f in array array[
    'select public.notif_outbox_tomar(10, array[''EMAIL''])',
    'select public.notif_outbox_registrar(gen_random_uuid(), true, ''x'', null, false)',
    'select public.notif_entregar_panel(10)',
    'select public.notif_generar_programadas(24)',
    'select public.notif_outbox_reencolar_no_habilitados(''EMAIL'', 24)',
    'select public.notif_push_eliminar_endpoint(''x'')',
    'select public._encolar_notificacion(''RESERVA_CONFIRMADA'', auth.uid(), null, ''EMAIL'', ''{}'', ''x'')'
  ] loop
    begin
      execute f;
      raise exception 'FALLA 124: authenticated ejecutó %', f;
    exception when insufficient_privilege then null;
    end;
  end loop;
  raise notice 'OK 124: authenticated no puede ejecutar el worker ni encolar';
end $$;
reset role;

set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
do $$
declare f text;
begin
  foreach f in array array[
    'select public.notif_outbox_tomar(10, array[''EMAIL''])',
    'select public.notif_outbox_registrar(gen_random_uuid(), true, ''x'', null, false)',
    'select public.notif_entregar_panel(10)',
    'select public.notif_preferencias_listar()',
    'select public.notif_push_suscribir(''https://fcm.googleapis.com/fcm/send/x'', repeat(''A'', 87), repeat(''B'', 22))',
    'select 1 from public.notificacion_outbox',
    'select 1 from public.notificacion_preferencia'
  ] loop
    begin
      execute f;
      raise exception 'FALLA 124: anon ejecutó %', f;
    exception when insufficient_privilege then null;
    end;
  end loop;
  raise notice 'OK 124: anon no accede a nada de notificaciones';
end $$;
reset role;

do $$ begin raise notice 'TODAS LAS PRUEBAS 124 PASARON'; end $$;
rollback;

-- Pruebas de comportamiento de la migracion 120 (modulo de WhatsApp).
--
-- Se corren contra la base LOCAL (supabase start), nunca contra produccion:
--   docker exec -i supabase_db_stylernow psql -U postgres -d postgres -v ON_ERROR_STOP=1 -q < tests/sql/whatsapp_120.sql
-- Todo ocurre dentro de una transaccion que termina en ROLLBACK: no deja datos.
-- Cada bloque lanza 'FALLA: ...' si el comportamiento no es el esperado; ON_ERROR_STOP corta en el primero.

begin;

-- Paridad con produccion (default privileges de Supabase que la CLI local no otorga).
grant select, insert, update, delete on all tables in schema public to service_role;
grant usage, select on all sequences in schema public to service_role;
grant select on all tables in schema public to authenticated;

-- ── Datos de prueba (como postgres) ─────────────────────────────────────────
-- a1 dueno de b1 · a2 cliente de b1 CON consentimiento · a3 dueno de b2 (intruso para b1)
-- a5 cliente de b1 SIN consentimiento · a6 cliente de b2 CON consentimiento
insert into auth.users (id, email, aud, role) values
  ('00000000-0000-0000-0000-0000000001a1', 'wa-dueno@test.local', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000001a2', 'wa-cliente@test.local', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000001a3', 'wa-intruso@test.local', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000001a5', 'wa-sinconsent@test.local', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000001a6', 'wa-otro@test.local', 'authenticated', 'authenticated');

insert into public.perfil (id, nombre) values
  ('00000000-0000-0000-0000-0000000001a1', 'Dueño WA'), ('00000000-0000-0000-0000-0000000001a2', 'Ana Cliente'),
  ('00000000-0000-0000-0000-0000000001a3', 'Intruso WA'), ('00000000-0000-0000-0000-0000000001a5', 'Beto SinConsent'),
  ('00000000-0000-0000-0000-0000000001a6', 'Caro OtroNegocio')
on conflict (id) do nothing;
update public.perfil set telefono = '+57 300 111 2233' where id = '00000000-0000-0000-0000-0000000001a2';
update public.perfil set telefono = '+57 300 111 5555' where id = '00000000-0000-0000-0000-0000000001a5';
update public.perfil set telefono = '+57 300 111 6666' where id = '00000000-0000-0000-0000-0000000001a6';

insert into public.negocio (id, owner_user_id, nombre, slug, ciudad, pais_codigo) values
  ('00000000-0000-0000-0000-0000000001b1', '00000000-0000-0000-0000-0000000001a1', 'Barbería WA', 'barberia-wa-test', 'Cali', 'CO'),
  ('00000000-0000-0000-0000-0000000001b2', '00000000-0000-0000-0000-0000000001a3', 'Otra WA', 'otra-wa-test', 'Cali', 'CO');
insert into public.sede (id, negocio_id, nombre, direccion, ciudad) values
  ('00000000-0000-0000-0000-0000000001c1', '00000000-0000-0000-0000-0000000001b1', 'Principal', 'Cra 1', 'Cali'),
  ('00000000-0000-0000-0000-0000000001c2', '00000000-0000-0000-0000-0000000001b2', 'Principal', 'Cra 2', 'Cali');
update public.suscripcion set estado = 'ACTIVA'
 where negocio_id in ('00000000-0000-0000-0000-0000000001b1', '00000000-0000-0000-0000-0000000001b2');

insert into public.reserva (id, cliente_id, negocio_id, sede_id, hora_inicio, hora_fin, estado, monto_total, monto_sena) values
  ('00000000-0000-0000-0000-0000000001d1', '00000000-0000-0000-0000-0000000001a2', '00000000-0000-0000-0000-0000000001b1',
   '00000000-0000-0000-0000-0000000001c1', now() + interval '10 hours', now() + interval '11 hours', 'PENDIENTE_PAGO', 50000, 0),
  ('00000000-0000-0000-0000-0000000001d2', '00000000-0000-0000-0000-0000000001a5', '00000000-0000-0000-0000-0000000001b1',
   '00000000-0000-0000-0000-0000000001c1', now() + interval '12 hours', now() + interval '13 hours', 'PENDIENTE_PAGO', 50000, 0),
  ('00000000-0000-0000-0000-0000000001d3', '00000000-0000-0000-0000-0000000001a6', '00000000-0000-0000-0000-0000000001b2',
   '00000000-0000-0000-0000-0000000001c2', now() + interval '14 hours', now() + interval '15 hours', 'PENDIENTE_PAGO', 50000, 0);
update public.reserva set estado = 'COMPLETADA'
 where id in ('00000000-0000-0000-0000-0000000001d1', '00000000-0000-0000-0000-0000000001d2', '00000000-0000-0000-0000-0000000001d3');

-- Consentimiento de marketing por WhatsApp, otorgado por cada cliente desde el centro de privacidad.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000001a2","role":"authenticated"}', true);
do $$ begin
  if not exists (select 1 from public.privacidad_guardar('{"marketing_whatsapp": true}') p where p.proposito = 'marketing_whatsapp' and p.otorgado) then
    raise exception 'FALLA consentimiento: privacidad_guardar no registró marketing_whatsapp';
  end if;
  raise notice 'OK consentimiento: marketing_whatsapp se otorga desde privacidad_guardar';
end $$;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000001a6","role":"authenticated"}', true);
select count(*) from public.privacidad_guardar('{"marketing_whatsapp": true}');
reset role;

-- ── (9) Funciones de service_role: ni anon ni authenticated las ejecutan ─────
set local role anon;
do $$
declare f text;
begin
  foreach f in array array[
    'select public.whatsapp_acreditar_recarga(gen_random_uuid(), gen_random_uuid())',
    'select public.whatsapp_otorgar_lote_plan(gen_random_uuid(), null)',
    'select public.whatsapp_panel_resumen(gen_random_uuid())',
    'select public.whatsapp_sistema_registrar_envio(gen_random_uuid(), ''x'', ''{}'')'
  ] loop
    begin
      execute f;
      raise exception 'FALLA 9: anon ejecutó %', f;
    exception when insufficient_privilege then null;
    end;
  end loop;
  raise notice 'OK 9: anon no ejecuta funciones de WhatsApp';
end $$;
reset role;

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000001a1","role":"authenticated"}', true);
do $$
declare f text;
begin
  foreach f in array array[
    'select public.whatsapp_acreditar_recarga(gen_random_uuid(), gen_random_uuid())',
    'select public.whatsapp_otorgar_lote_plan(''00000000-0000-0000-0000-0000000001b1'', null)',
    'select public.whatsapp_otorgar_lotes_plan_mes()',
    'select public.whatsapp_sistema_estado_conexion(''PRODUCCION'', ''x'')',
    'select public.whatsapp_sistema_plantilla_estado(gen_random_uuid(), ''APROBADA'', ''x'', null)',
    'select public.whatsapp_sistema_preparar_campana(gen_random_uuid())',
    'select public.whatsapp_sistema_reservar_envio(gen_random_uuid())',
    'select public.whatsapp_sistema_registrar_envio(gen_random_uuid(), ''x'', ''{}'')',
    'select public.whatsapp_sistema_registrar_fallo(gen_random_uuid(), ''x'', null, ''{}'')',
    'select public.whatsapp_sistema_actualizar_estado(''x'', ''LEIDO'', ''{}'')',
    'select public._whatsapp_consumir(gen_random_uuid())',
    'select public._whatsapp_otorgar_lote_plan(''00000000-0000-0000-0000-0000000001b1'', null)'
  ] loop
    begin
      execute f;
      raise exception 'FALLA 9: authenticated ejecutó %', f;
    exception when insufficient_privilege then null;
    end;
  end loop;
  begin
    insert into public.whatsapp_conversacion_lote (negocio_id, origen, cantidad, cantidad_disponible, fecha_expiracion)
    values ('00000000-0000-0000-0000-0000000001b1', 'PAQUETE', 99999, 99999, now() + interval '1 year');
    raise exception 'FALLA 9: authenticated insertó un lote directamente';
  exception when insufficient_privilege then null;
  end;
  raise notice 'OK 9: authenticated no ejecuta funciones de sistema ni escribe lotes';
end $$;
reset role;

-- ── (1) Dueño crea plantilla y campaña; otro usuario recibe NO_AUTORIZADO ────
create temp table wa_ids (k text primary key, v uuid) on commit drop;
grant all on wa_ids to authenticated, service_role, anon;

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000001a1","role":"authenticated"}', true);
do $$
declare v_plantilla uuid; v_util uuid; v_campana uuid; r jsonb;
begin
  v_plantilla := public.whatsapp_plantilla_guardar(null, '00000000-0000-0000-0000-0000000001b1', 'promo_corte', 'es', 'MARKETING',
                   'Hola {{1}}, en {{2}} tienes 20% esta semana.', '["nombre_cliente","nombre_negocio"]');
  v_util := public.whatsapp_plantilla_guardar(null, '00000000-0000-0000-0000-0000000001b1', 'recordatorio', 'es', 'UTILIDAD',
                   'Te esperamos mañana.', '[]');
  v_campana := public.whatsapp_campana_crear('00000000-0000-0000-0000-0000000001b1', v_plantilla, 'Promo noviembre', '{}', now() + interval '1 day');
  if v_plantilla is null or v_campana is null then raise exception 'FALLA 1: el dueño no pudo crear plantilla/campaña'; end if;
  insert into wa_ids values ('plantilla_mkt', v_plantilla), ('plantilla_util', v_util), ('campana', v_campana);
  r := public.whatsapp_panel_resumen('00000000-0000-0000-0000-0000000001b1');
  if jsonb_array_length(r->'plantillas') <> 2 or jsonb_array_length(r->'campanas') <> 1 then
    raise exception 'FALLA 1: el resumen no muestra lo creado: %', r;
  end if;
  begin
    perform public.whatsapp_plantilla_guardar(null, '00000000-0000-0000-0000-0000000001b1', 'mala', 'es', 'MARKETING', 'Hola {{2}}', '["nombre_cliente"]');
    raise exception 'FALLA 1: se aceptaron marcadores que no coinciden';
  exception when others then
    if sqlerrm not like '%MARCADORES_NO_COINCIDEN%' then raise; end if;
  end;
  begin
    perform public.whatsapp_campana_crear('00000000-0000-0000-0000-0000000001b1', v_util, 'Usar aviso', '{}', null);
    raise exception 'FALLA 1: una campaña aceptó una plantilla de utilidad';
  exception when others then
    if sqlerrm not like '%CAMPANA_SOLO_MARKETING%' then raise; end if;
  end;
  begin
    perform public.whatsapp_campana_crear('00000000-0000-0000-0000-0000000001b1', v_plantilla, 'Lista manual', '{"clientes":["x"]}', null);
    raise exception 'FALLA 1/10: se aceptó un segmento con lista enviada por el cliente';
  exception when others then
    if sqlerrm not like '%SEGMENTO_INVALIDO%' then raise; end if;
  end;
  raise notice 'OK 1: el dueño crea plantillas y campañas (con validaciones)';
end $$;

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000001a3","role":"authenticated"}', true);
do $$
declare f text;
begin
  foreach f in array array[
    'select public.whatsapp_panel_resumen(''00000000-0000-0000-0000-0000000001b1'')',
    'select public.whatsapp_plantilla_guardar(null, ''00000000-0000-0000-0000-0000000001b1'', ''intrusa'', ''es'', ''MARKETING'', ''Hola'', ''[]'')',
    'select public.whatsapp_plantilla_guardar((select v from wa_ids where k = ''plantilla_mkt''), ''00000000-0000-0000-0000-0000000001b2'', ''robada'', ''es'', ''MARKETING'', ''Hola'', ''[]'')',
    'select public.whatsapp_campana_crear(''00000000-0000-0000-0000-0000000001b1'', (select v from wa_ids where k = ''plantilla_mkt''), ''X'', ''{}'', null)',
    'select public.whatsapp_campana_programar((select v from wa_ids where k = ''campana''))',
    'select public.whatsapp_campana_cancelar((select v from wa_ids where k = ''campana''))',
    'select public.whatsapp_segmento_contar(''00000000-0000-0000-0000-0000000001b1'', ''{}'')',
    'select public.whatsapp_solicitar_recarga(''00000000-0000-0000-0000-0000000001b1'', (select id from public.whatsapp_paquete where codigo = ''RECARGA_500'' and activo))',
    'select public.whatsapp_admin_actualizar_config(50, 10, 12, ''{80,100}'', null, ''intento intruso'')'
  ] loop
    begin
      execute f;
      raise exception 'FALLA 1: el intruso pudo ejecutar %', f;
    exception when others then
      if sqlerrm not like '%NO_AUTORIZADO%' then raise exception 'FALLA 1: error inesperado en "%": %', f, sqlerrm; end if;
    end;
  end loop;
  if exists (select 1 from public.whatsapp_plantilla where negocio_id = '00000000-0000-0000-0000-0000000001b1')
     or exists (select 1 from public.whatsapp_campana where negocio_id = '00000000-0000-0000-0000-0000000001b1') then
    raise exception 'FALLA 1: el intruso ve filas de otro negocio por RLS';
  end if;
  raise notice 'OK 1: otro usuario recibe NO_AUTORIZADO y no ve filas ajenas';
end $$;
reset role;

-- ── (10) Destinatarios: solo clientes de ESE negocio con consentimiento ─────
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000001a1","role":"authenticated"}', true);
do $$
declare r jsonb;
begin
  r := public.whatsapp_segmento_contar('00000000-0000-0000-0000-0000000001b1', '{}');
  if (r->>'con_telefono')::int <> 2 or (r->>'con_consentimiento')::int <> 1 then
    raise exception 'FALLA 10: se esperaban 2 con teléfono y 1 con consentimiento, llegó %', r;
  end if;
  raise notice 'OK 10: el conteo excluye al cliente sin consentimiento y a los de otro negocio';
end $$;
reset role;
do $$
declare v uuid[];
begin
  select array_agg(dest_cliente_id) into v
    from public._whatsapp_destinatarios('00000000-0000-0000-0000-0000000001b1', '{}', 'MARKETING');
  if v is distinct from array['00000000-0000-0000-0000-0000000001a2'::uuid] then
    raise exception 'FALLA 10: destinatarios de marketing incorrectos: %', v;
  end if;
  if exists (select 1 from public._whatsapp_destinatarios('00000000-0000-0000-0000-0000000001b1', '{}', 'UTILIDAD')
              where dest_cliente_id = '00000000-0000-0000-0000-0000000001a6') then
    raise exception 'FALLA 10: un cliente de otro negocio aparece como destinatario';
  end if;
  raise notice 'OK 10: destinatarios = solo a2 (a5 sin consentimiento y a6 de otro negocio quedan fuera)';
end $$;

-- ── (2) Programar sin conexión: BLOQUEADA_SIN_CONEXION y cero mensajes enviados ─
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000001a1","role":"authenticated"}', true);
do $$
declare v_estado text; v_campana uuid := (select v from wa_ids where k = 'campana');
begin
  v_estado := public.whatsapp_campana_programar(v_campana);
  if v_estado <> 'BLOQUEADA_SIN_CONEXION' then raise exception 'FALLA 2: sin conexión debía quedar bloqueada, quedó %', v_estado; end if;
  if (select estado::text from public.whatsapp_campana where id = v_campana) <> 'BLOQUEADA_SIN_CONEXION' then
    raise exception 'FALLA 2: la campaña no quedó BLOQUEADA_SIN_CONEXION en la tabla';
  end if;
  if exists (select 1 from public.whatsapp_mensaje where campana_id = v_campana) then
    raise exception 'FALLA 2: se crearon mensajes sin conexión';
  end if;
  if exists (select 1 from public.whatsapp_mensaje where estado in ('ENVIADO','ENTREGADO','LEIDO'))
     or exists (select 1 from public.whatsapp_consumo where negocio_id = '00000000-0000-0000-0000-0000000001b1') then
    raise exception 'FALLA 2: hay mensajes enviados o consumo sin conexión';
  end if;
  raise notice 'OK 2: sin conexión la campaña queda BLOQUEADA_SIN_CONEXION, 0 mensajes y 0 consumo';
end $$;
reset role;
set local role service_role;
do $$ begin
  begin
    perform public.whatsapp_sistema_preparar_campana((select v from wa_ids where k = 'campana'));
    raise exception 'FALLA 2: se preparó el envío de una campaña bloqueada';
  exception when others then
    if sqlerrm not like '%TRANSICION_INVALIDA%' then raise; end if;
  end;
  raise notice 'OK 2: una campaña bloqueada no se puede preparar para envío';
end $$;
reset role;

-- ── (7) Lote mensual del plan: idempotente ─────────────────────────────────
set local role service_role;
do $$
declare a uuid; b uuid; n int; l public.whatsapp_conversacion_lote;
begin
  a := public.whatsapp_otorgar_lote_plan('00000000-0000-0000-0000-0000000001b1', null);
  b := public.whatsapp_otorgar_lote_plan('00000000-0000-0000-0000-0000000001b1', null);
  perform public.whatsapp_otorgar_lotes_plan_mes();
  perform public.whatsapp_otorgar_lotes_plan_mes();
  select count(*) into n from public.whatsapp_conversacion_lote where negocio_id = '00000000-0000-0000-0000-0000000001b1' and origen = 'PLAN';
  if a is null or a is distinct from b or n <> 1 then raise exception 'FALLA 7: lote del plan no idempotente (% / % / % lotes)', a, b, n; end if;
  select * into l from public.whatsapp_conversacion_lote where id = a;
  if l.cantidad <> 150 or l.cantidad_disponible <> 150 or l.cupo_marketing <> 60 then
    raise exception 'FALLA 7: lote ESSENTIAL esperado 150/150 con tope 60, llegó %/% tope %', l.cantidad, l.cantidad_disponible, l.cupo_marketing;
  end if;
  begin
    perform public.whatsapp_otorgar_lote_plan('00000000-0000-0000-0000-0000000001b1', '2026-11-15');
    raise exception 'FALLA 7: se aceptó un periodo que no es inicio de mes';
  exception when others then
    if sqlerrm not like '%PERIODO_INVALIDO%' then raise; end if;
  end;
  insert into wa_ids values ('lote_plan', a);
  raise notice 'OK 7: un solo lote PLAN por negocio y mes (150, tope marketing 60)';
end $$;
reset role;

-- ── (3) Sin id del proveedor no hay ENVIADO; transiciones inválidas rechazadas ─
insert into public.whatsapp_mensaje (id, negocio_id, plantilla_id, cliente_id, telefono, categoria)
values ('00000000-0000-0000-0000-0000000001f1', '00000000-0000-0000-0000-0000000001b1', (select v from wa_ids where k = 'plantilla_util'),
        '00000000-0000-0000-0000-0000000001a2', '573001112233', 'UTILIDAD');
set local role service_role;
do $$ begin
  begin
    update public.whatsapp_mensaje set estado = 'ENVIADO' where id = '00000000-0000-0000-0000-0000000001f1';
    raise exception 'FALLA 3: service_role marcó ENVIADO sin id del proveedor';
  exception when check_violation then null;
  end;
  begin
    update public.whatsapp_mensaje set estado = 'LEIDO', proveedor_mensaje_id = 'falso' where id = '00000000-0000-0000-0000-0000000001f1';
    raise exception 'FALLA 3: service_role saltó de PREPARADO a LEIDO';
  exception when others then
    if sqlerrm not like '%TRANSICION_INVALIDA%' then raise; end if;
  end;
  begin
    perform public.whatsapp_sistema_registrar_envio('00000000-0000-0000-0000-0000000001f1', '  ', '{}');
    raise exception 'FALLA 3: se registró un envío con id vacío';
  exception when others then
    if sqlerrm not like '%EVIDENCIA_REQUERIDA%' then raise; end if;
  end;
  begin
    perform public.whatsapp_sistema_registrar_envio('00000000-0000-0000-0000-0000000001f1', 'wamid.sinreserva', '{}');
    raise exception 'FALLA 3: se registró un envío sin reservar saldo';
  exception when others then
    if sqlerrm not like '%SIN_RESERVA_DE_SALDO%' then raise; end if;
  end;
  begin
    update public.whatsapp_campana set estado = 'COMPLETADA' where id = (select v from wa_ids where k = 'campana');
    raise exception 'FALLA 3: campaña pasó de BLOQUEADA_SIN_CONEXION a COMPLETADA';
  exception when others then
    if sqlerrm not like '%TRANSICION_INVALIDA%' then raise; end if;
  end;
  begin
    update public.whatsapp_plantilla set estado = 'APROBADA' where id = (select v from wa_ids where k = 'plantilla_mkt');
    raise exception 'FALLA 3: plantilla pasó de BORRADOR a APROBADA sin revisión';
  exception when others then
    if sqlerrm not like '%TRANSICION_INVALIDA%' then raise; end if;
  end;
  begin
    update public.whatsapp_config set estado_conexion = 'PRODUCCION' where id;
    raise exception 'FALLA 3: conexión pasó de NO_CONFIGURADO a PRODUCCION directo';
  exception when others then
    if sqlerrm not like '%TRANSICION_INVALIDA%' then raise; end if;
  end;
  begin
    perform public.whatsapp_sistema_estado_conexion('PRODUCCION', 'sin pasos');
    raise exception 'FALLA 3: la función de sistema saltó a PRODUCCION sin credenciales';
  exception when others then
    if sqlerrm not like '%TRANSICION_INVALIDA%' then raise; end if;
  end;
  if (select estado::text from public.whatsapp_mensaje where id = '00000000-0000-0000-0000-0000000001f1') <> 'PREPARADO' then
    raise exception 'FALLA 3: el mensaje cambió de estado';
  end if;
  raise notice 'OK 3: sin id del proveedor no hay ENVIADO y las transiciones inválidas se rechazan para service_role';
end $$;
reset role;

-- SuperSU no puede declarar la conexión en PRODUCCION a mano.
select set_config('request.jwt.claims', '', true);   -- como postgres sin sesión de usuario
update public.perfil set es_supersu = true where id = '00000000-0000-0000-0000-0000000001a6';
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000001a6","role":"authenticated"}', true);
do $$ begin
  begin
    perform public.whatsapp_admin_estado_conexion('PRODUCCION', 'lo digo yo');
    raise exception 'FALLA 3: SuperSU marcó PRODUCCION sin verificación';
  exception when others then
    if sqlerrm not like '%ESTADO_SOLO_SISTEMA%' then raise; end if;
  end;
  perform public.whatsapp_admin_actualizar_config(40, 10, 12, '{100,80,80}', 'META_CLOUD_API', 'prueba de auditoría');
  if not exists (select 1 from public.evento_auditoria where accion = 'WHATSAPP_CONFIG_ACTUALIZADA'
                  and payload_antes is not null and payload_despues is not null and motivo = 'prueba de auditoría') then
    raise exception 'FALLA config: el cambio de configuración no quedó auditado con antes/después/motivo';
  end if;
  if (select umbrales_alerta from public.whatsapp_config where id) <> '{80,100}'::int[] then
    raise exception 'FALLA config: los umbrales no se normalizaron';
  end if;
  raise notice 'OK 3/config: SuperSU no fija PRODUCCION; cambios de reglas auditados';
end $$;
reset role;
select set_config('request.jwt.claims', '', true);
update public.perfil set es_supersu = false where id = '00000000-0000-0000-0000-0000000001a6';

-- ── Conexión simulada por el SISTEMA con evidencia (solo para probar consumo) ─
set local role service_role;
do $$ begin
  perform public.whatsapp_sistema_estado_conexion('PENDIENTE_CREDENCIALES', 'credenciales cargadas en prueba');
  perform public.whatsapp_sistema_estado_conexion('PRODUCCION', 'phone_number_id de prueba');
  perform public.whatsapp_sistema_plantilla_estado((select v from wa_ids where k = 'plantilla_util'), 'PENDIENTE_APROBACION', 'tpl-util', null);
  perform public.whatsapp_sistema_plantilla_estado((select v from wa_ids where k = 'plantilla_util'), 'APROBADA', 'tpl-util', null);
  perform public.whatsapp_sistema_plantilla_estado((select v from wa_ids where k = 'plantilla_mkt'), 'PENDIENTE_APROBACION', 'tpl-mkt', null);
  perform public.whatsapp_sistema_plantilla_estado((select v from wa_ids where k = 'plantilla_mkt'), 'APROBADA', 'tpl-mkt', null);
end $$;
reset role;

-- ── (4) El consumo baja el saldo y es idempotente por mensaje ─────────────
set local role service_role;
do $$
declare v_msg uuid; v_msg2 uuid; r1 jsonb; r2 uuid; antes int; despues int; n int; v_ok boolean;
begin
  v_msg := public.whatsapp_sistema_preparar_mensaje_utilidad('00000000-0000-0000-0000-0000000001b1', (select v from wa_ids where k = 'plantilla_util'),
             '00000000-0000-0000-0000-0000000001a2', '{}', 'RESERVA', '00000000-0000-0000-0000-0000000001d1');
  if v_msg is distinct from public.whatsapp_sistema_preparar_mensaje_utilidad('00000000-0000-0000-0000-0000000001b1',
             (select v from wa_ids where k = 'plantilla_util'), '00000000-0000-0000-0000-0000000001a2', '{}', 'RESERVA', '00000000-0000-0000-0000-0000000001d1') then
    raise exception 'FALLA 4: el mensaje de utilidad no es idempotente por referencia';
  end if;
  begin
    perform public.whatsapp_sistema_preparar_mensaje_utilidad('00000000-0000-0000-0000-0000000001b1', (select v from wa_ids where k = 'plantilla_util'),
             '00000000-0000-0000-0000-0000000001a6', '{}', 'RESERVA', '00000000-0000-0000-0000-0000000001d3');
    raise exception 'FALLA 10: mensaje a un cliente de otro negocio';
  exception when others then
    if sqlerrm not like '%CLIENTE_NO_ES_DEL_NEGOCIO%' then raise; end if;
  end;
  select cantidad_disponible into antes from public.whatsapp_conversacion_lote where id = (select v from wa_ids where k = 'lote_plan');
  r1 := public.whatsapp_sistema_reservar_envio(v_msg);
  r2 := (public.whatsapp_sistema_reservar_envio(v_msg)->>'lote_id')::uuid;   -- segunda llamada: mismo lote, sin consumir otra vez
  select cantidad_disponible into despues from public.whatsapp_conversacion_lote where id = (select v from wa_ids where k = 'lote_plan');
  select count(*) into n from public.whatsapp_consumo where mensaje_id = v_msg;
  if not (r1->>'ok')::boolean or despues <> antes - 1 or n <> 1 then
    raise exception 'FALLA 4: consumo no idempotente (% → %, % filas, %)', antes, despues, n, r1;
  end if;
  if (r1->>'lote_id')::uuid is distinct from r2 then raise exception 'FALLA 4: la segunda llamada devolvió otro lote'; end if;
  -- Volver a reservar el mismo mensaje no consume (ya no está en un estado nuevo y el libro tiene 1 CONSUMO).
  perform public.whatsapp_sistema_reservar_envio(v_msg);
  if (select count(*) from public.whatsapp_consumo where mensaje_id = v_msg) <> 1 then raise exception 'FALLA 4: doble reserva consumió dos veces'; end if;

  v_ok := public.whatsapp_sistema_registrar_envio(v_msg, 'wamid.prueba.1', '{"messages":[{"id":"wamid.prueba.1"}]}');
  if not v_ok or public.whatsapp_sistema_registrar_envio(v_msg, 'wamid.prueba.1', '{}') then
    raise exception 'FALLA 4: registrar envío no es idempotente';
  end if;
  if not public.whatsapp_sistema_actualizar_estado('wamid.prueba.1', 'LEIDO', '{"status":"read"}')
     or public.whatsapp_sistema_actualizar_estado('wamid.prueba.1', 'ENTREGADO', '{"status":"delivered"}') then
    raise exception 'FALLA 4: un webhook atrasado (ENTREGADO después de LEIDO) cambió el estado';
  end if;
  if (select estado::text from public.whatsapp_mensaje where id = v_msg) <> 'LEIDO' then raise exception 'FALLA 4: el mensaje no quedó LEIDO'; end if;

  -- Fallo reportado: devuelve la conversación (REVERSO) una sola vez.
  insert into public.whatsapp_mensaje (negocio_id, plantilla_id, cliente_id, telefono, categoria)
  values ('00000000-0000-0000-0000-0000000001b1', (select v from wa_ids where k = 'plantilla_util'), '00000000-0000-0000-0000-0000000001a2', '573001112233', 'UTILIDAD')
  returning id into v_msg2;
  perform public.whatsapp_sistema_reservar_envio(v_msg2);
  perform public.whatsapp_sistema_registrar_fallo(v_msg2, '131026', 'número no válido', '{}');
  perform public.whatsapp_sistema_registrar_fallo(v_msg2, '131026', 'número no válido', '{}');
  select cantidad_disponible into despues from public.whatsapp_conversacion_lote where id = (select v from wa_ids where k = 'lote_plan');
  if despues <> antes - 1 or (select count(*) from public.whatsapp_consumo where mensaje_id = v_msg2 and tipo = 'REVERSO') <> 1 then
    raise exception 'FALLA 4: el fallo no devolvió la conversación exactamente una vez (disponible %)', despues;
  end if;
  insert into wa_ids values ('msg_leido', v_msg);
  raise notice 'OK 4: el consumo baja el saldo en 1 por mensaje (idempotente) y el fallo lo devuelve una vez';
end $$;
reset role;

-- ── (5) Tope de marketing del 40 %% del lote del plan, aplicado en la base ──
-- 61 mensajes de marketing preparados (como postgres): con tope 60, el 61 debe rechazarse.
insert into public.whatsapp_mensaje (negocio_id, plantilla_id, cliente_id, telefono, categoria, referencia_tipo)
select '00000000-0000-0000-0000-0000000001b1', (select v from wa_ids where k = 'plantilla_mkt'), '00000000-0000-0000-0000-0000000001a2',
       '573001112233', 'MARKETING', 'PRUEBA_TOPE'
  from generate_series(1, 61);
set local role service_role;
do $$
declare r record; res jsonb; ok_n int := 0; ultimo jsonb; l public.whatsapp_conversacion_lote;
begin
  for r in select id from public.whatsapp_mensaje where referencia_tipo = 'PRUEBA_TOPE' order by created_at, id loop
    res := public.whatsapp_sistema_reservar_envio(r.id);
    if (res->>'ok')::boolean then ok_n := ok_n + 1; else ultimo := res; end if;
  end loop;
  select * into l from public.whatsapp_conversacion_lote where id = (select v from wa_ids where k = 'lote_plan');
  if ok_n <> 60 or ultimo->>'motivo' <> 'CUPO_MARKETING_AGOTADO' or l.marketing_consumido <> 60 then
    raise exception 'FALLA 5: tope de marketing no aplicado (% reservas ok, último %, consumido %)', ok_n, ultimo, l.marketing_consumido;
  end if;
  -- Los avisos siguen saliendo con el marketing agotado.
  res := public.whatsapp_sistema_reservar_envio(public.whatsapp_sistema_preparar_mensaje_utilidad('00000000-0000-0000-0000-0000000001b1',
         (select v from wa_ids where k = 'plantilla_util'), '00000000-0000-0000-0000-0000000001a2', '{}', 'RESERVA', '00000000-0000-0000-0000-0000000001d2'));
  if not (res->>'ok')::boolean then raise exception 'FALLA 5: el tope de marketing bloqueó un aviso: %', res; end if;
  if not exists (select 1 from public.whatsapp_alerta where negocio_id = '00000000-0000-0000-0000-0000000001b1') then
    null;  -- 62/150 = 41 %%: todavía no hay alerta (umbral mínimo 80 %%)
  else
    raise exception 'FALLA alertas: se disparó una alerta antes del 80 %%';
  end if;
  raise notice 'OK 5: 60 de 61 mensajes de marketing reservados; el 61 rechazado con CUPO_MARKETING_AGOTADO; los avisos siguen';
end $$;
reset role;

-- Alertas al 80 % y 100 %: se consume la cuota restante con avisos.
insert into public.whatsapp_mensaje (negocio_id, plantilla_id, cliente_id, telefono, categoria, referencia_tipo)
select '00000000-0000-0000-0000-0000000001b1', (select v from wa_ids where k = 'plantilla_util'), '00000000-0000-0000-0000-0000000001a2',
       '573001112233', 'UTILIDAD', 'PRUEBA_ALERTA'
  from generate_series(1, 89);
set local role service_role;
do $$
declare r record; res jsonb; n_ok int := 0;
begin
  for r in select id from public.whatsapp_mensaje where referencia_tipo = 'PRUEBA_ALERTA' order by created_at, id loop
    res := public.whatsapp_sistema_reservar_envio(r.id);
    if (res->>'ok')::boolean then n_ok := n_ok + 1; end if;
  end loop;
  if (select array_agg(umbral order by umbral) from public.whatsapp_alerta where negocio_id = '00000000-0000-0000-0000-0000000001b1') <> '{80,100}'::int[] then
    raise exception 'FALLA alertas: se esperaban alertas 80 y 100';
  end if;
  if n_ok <> 88 or (res->>'motivo') <> 'SALDO_INSUFICIENTE' then
    raise exception 'FALLA alertas: con la cuota agotada y sin recargas debía rechazar (% ok, último %)', n_ok, res;
  end if;
  raise notice 'OK alertas: 80 %% y 100 %% registradas una vez; sin saldo se rechaza con SALDO_INSUFICIENTE';
end $$;
reset role;

-- Programar una campaña con el cupo de marketing agotado se rechaza en el backend.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000001a1","role":"authenticated"}', true);
do $$ begin
  begin
    perform public.whatsapp_campana_programar((select v from wa_ids where k = 'campana'));
    raise exception 'FALLA 5: se programó una campaña sin cupo de marketing';
  exception when others then
    if sqlerrm not like '%CUPO_MARKETING_INSUFICIENTE%' then raise; end if;
  end;
  raise notice 'OK 5: programar campaña sin cupo de marketing → CUPO_MARKETING_INSUFICIENTE';
end $$;

-- ── (6) Recarga: solicitud pendiente y acreditación idempotente ────────────
do $$
declare v_compra uuid; v_compra2 uuid;
begin
  v_compra := public.whatsapp_solicitar_recarga('00000000-0000-0000-0000-0000000001b1', (select id from public.whatsapp_paquete where codigo = 'RECARGA_500' and activo));
  v_compra2 := public.whatsapp_solicitar_recarga('00000000-0000-0000-0000-0000000001b1', (select id from public.whatsapp_paquete where codigo = 'RECARGA_500' and activo));
  if v_compra is distinct from v_compra2 then raise exception 'FALLA 6: doble clic creó dos solicitudes'; end if;
  if (select estado::text from public.whatsapp_compra_recarga where id = v_compra) <> 'PENDIENTE_PAGO' then
    raise exception 'FALLA 6: la solicitud no quedó PENDIENTE_PAGO';
  end if;
  insert into wa_ids values ('compra', v_compra);
  raise notice 'OK 6: la solicitud de recarga queda PENDIENTE_PAGO (sin duplicados)';
end $$;
reset role;

insert into public.pago (id, negocio_id, tipo, monto, estado) values
  ('00000000-0000-0000-0000-0000000001e1', '00000000-0000-0000-0000-0000000001b1', 'PAQUETE_CONVERSACIONES_WHATSAPP', 25000, 'APROBADO'),
  ('00000000-0000-0000-0000-0000000001e2', '00000000-0000-0000-0000-0000000001b1', 'PAQUETE_CONVERSACIONES_WHATSAPP', 25000, 'PENDIENTE'),
  ('00000000-0000-0000-0000-0000000001e3', '00000000-0000-0000-0000-0000000001b2', 'PAQUETE_CONVERSACIONES_WHATSAPP', 25000, 'APROBADO'),
  ('00000000-0000-0000-0000-0000000001e4', '00000000-0000-0000-0000-0000000001b1', 'PAQUETE_CREDITOS_IA', 25000, 'APROBADO'),
  ('00000000-0000-0000-0000-0000000001e5', '00000000-0000-0000-0000-0000000001b1', 'PAQUETE_CONVERSACIONES_WHATSAPP', 1000, 'APROBADO'),
  ('00000000-0000-0000-0000-0000000001e6', '00000000-0000-0000-0000-0000000001b1', 'PAQUETE_CONVERSACIONES_WHATSAPP', 25000, 'APROBADO');

set local role service_role;
do $$
declare v_compra uuid := (select v from wa_ids where k = 'compra'); a uuid; b uuid; l public.whatsapp_conversacion_lote; res jsonb;
begin
  begin perform public.whatsapp_acreditar_recarga(v_compra, '00000000-0000-0000-0000-0000000001e2');
    raise exception 'FALLA 6: se acreditó con un pago PENDIENTE';
  exception when others then if sqlerrm not like '%PAGO_NO_APROBADO%' then raise; end if; end;
  begin perform public.whatsapp_acreditar_recarga(v_compra, '00000000-0000-0000-0000-0000000001e3');
    raise exception 'FALLA 6: se acreditó con el pago de otro negocio';
  exception when others then if sqlerrm not like '%PAGO_DE_OTRO_NEGOCIO%' then raise; end if; end;
  begin perform public.whatsapp_acreditar_recarga(v_compra, '00000000-0000-0000-0000-0000000001e4');
    raise exception 'FALLA 6: se acreditó con un pago de otro tipo';
  exception when others then if sqlerrm not like '%PAGO_TIPO_INVALIDO%' then raise; end if; end;
  begin perform public.whatsapp_acreditar_recarga(v_compra, '00000000-0000-0000-0000-0000000001e5');
    raise exception 'FALLA 6: se acreditó con un pago por menos del precio';
  exception when others then if sqlerrm not like '%PAGO_MONTO_INSUFICIENTE%' then raise; end if; end;
  if exists (select 1 from public.whatsapp_conversacion_lote where compra_id = v_compra) then
    raise exception 'FALLA 6: un intento rechazado dejó un lote';
  end if;

  a := public.whatsapp_acreditar_recarga(v_compra, '00000000-0000-0000-0000-0000000001e1');
  b := public.whatsapp_acreditar_recarga(v_compra, '00000000-0000-0000-0000-0000000001e1');
  if a is null or a is distinct from b or (select count(*) from public.whatsapp_conversacion_lote where compra_id = v_compra) <> 1 then
    raise exception 'FALLA 6: acreditación no idempotente';
  end if;
  begin perform public.whatsapp_acreditar_recarga(v_compra, '00000000-0000-0000-0000-0000000001e6');
    raise exception 'FALLA 6: una compra acreditada aceptó un segundo pago';
  exception when others then if sqlerrm not like '%COMPRA_YA_ACREDITADA%' then raise; end if; end;
  select * into l from public.whatsapp_conversacion_lote where id = a;
  if l.origen <> 'PAQUETE' or l.cantidad <> 500 or l.cupo_marketing <> 50
     or abs(extract(epoch from (l.fecha_expiracion - (now() + interval '12 months')))) > 60 then
    raise exception 'FALLA 6: lote de recarga mal formado (% % tope % vence %)', l.origen, l.cantidad, l.cupo_marketing, l.fecha_expiracion;
  end if;
  -- Con la recarga, el aviso que antes fue rechazado ahora se reserva desde la recarga.
  res := public.whatsapp_sistema_reservar_envio((select id from public.whatsapp_mensaje where referencia_tipo = 'PRUEBA_ALERTA' and estado = 'PREPARADO'
                                                and not exists (select 1 from public.whatsapp_consumo c where c.mensaje_id = whatsapp_mensaje.id) limit 1));
  if (res->>'lote_id')::uuid is distinct from a then raise exception 'FALLA 6: el consumo no tomó la recarga tras agotar el plan: %', res; end if;
  insert into wa_ids values ('lote_recarga', a);
  raise notice 'OK 6: acreditación idempotente; rechaza pago no aprobado, de otro negocio, de otro tipo y por menos';
end $$;
reset role;

-- ── (8) Libro de consumo y evidencia: inmutables para service_role ─────────
do $$ begin
  if not exists (select 1 from public.whatsapp_consumo) or not exists (select 1 from public.whatsapp_mensaje_evento) then
    raise exception 'FALLA preparación: sin filas para probar inmutabilidad';
  end if;
end $$;
set local role service_role;
do $$ begin
  begin
    update public.whatsapp_consumo set cantidad = 1 where true;
    raise exception 'FALLA 8: service_role modificó el libro de consumo';
  exception when others then if sqlerrm not like '%WHATSAPP_REGISTRO_INMUTABLE%' then raise; end if; end;
  begin
    delete from public.whatsapp_consumo where true;
    raise exception 'FALLA 8: service_role borró el libro de consumo';
  exception when others then if sqlerrm not like '%WHATSAPP_REGISTRO_INMUTABLE%' then raise; end if; end;
  begin
    update public.whatsapp_mensaje_evento set proveedor_payload = '{}' where true;
    raise exception 'FALLA 8: service_role modificó la evidencia del proveedor';
  exception when others then if sqlerrm not like '%WHATSAPP_REGISTRO_INMUTABLE%' then raise; end if; end;
  begin
    delete from public.whatsapp_mensaje_evento where true;
    raise exception 'FALLA 8: service_role borró la evidencia del proveedor';
  exception when others then if sqlerrm not like '%WHATSAPP_REGISTRO_INMUTABLE%' then raise; end if; end;
  begin
    update public.whatsapp_mensaje set proveedor_mensaje_id = 'otro' where id = (select v from wa_ids where k = 'msg_leido');
    raise exception 'FALLA 8: se reescribió el id del proveedor';
  exception when others then if sqlerrm not like '%PROVEEDOR_ID_INMUTABLE%' then raise; end if; end;
  raise notice 'OK 8: consumo y evidencia no se pueden modificar ni borrar (ni por service_role)';
end $$;
reset role;

-- authenticated tampoco escribe directo en las tablas del módulo.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000001a1","role":"authenticated"}', true);
do $$ begin
  begin
    update public.whatsapp_conversacion_lote set cantidad_disponible = 99999 where negocio_id = '00000000-0000-0000-0000-0000000001b1';
    raise exception 'FALLA 9: el dueño se regaló saldo editando el lote';
  exception when insufficient_privilege then null; end;
  begin
    update public.whatsapp_mensaje set estado = 'ENVIADO', proveedor_mensaje_id = 'x' where negocio_id = '00000000-0000-0000-0000-0000000001b1';
    raise exception 'FALLA 9: el dueño marcó mensajes como enviados';
  exception when insufficient_privilege then null; end;
  raise notice 'OK 9: authenticated no escribe lotes ni mensajes directamente';
end $$;
reset role;

do $$ begin raise notice 'TODAS LAS PRUEBAS DE LA MIGRACION 120 PASARON'; end $$;
rollback;

begin;

insert into auth.users (id, email, aud, role) values
  ('11111111-1111-4111-8111-111111111111', 'soporte_essential@t.l', 'authenticated', 'authenticated'),
  ('22222222-2222-4222-8222-222222222222', 'soporte_studio@t.l', 'authenticated', 'authenticated'),
  ('33333333-3333-4333-8333-333333333333', 'soporte_prestige@t.l', 'authenticated', 'authenticated'),
  ('44444444-4444-4444-8444-444444444444', 'soporte_staff@t.l', 'authenticated', 'authenticated'),
  ('55555555-5555-4555-8555-555555555555', 'soporte_otro@t.l', 'authenticated', 'authenticated');

insert into public.perfil (id, nombre, es_supersu) values
  ('11111111-1111-4111-8111-111111111111', 'Essential', false),
  ('22222222-2222-4222-8222-222222222222', 'Studio', false),
  ('33333333-3333-4333-8333-333333333333', 'Prestige', false),
  ('44444444-4444-4444-8444-444444444444', 'Staff', false),
  ('55555555-5555-4555-8555-555555555555', 'Otro', false)
on conflict (id) do update set nombre = excluded.nombre, es_supersu = false;

insert into public.negocio (id, owner_user_id, nombre, slug, ciudad, pais_codigo, plan_codigo) values
  ('aaaaaaa1-1111-4111-8111-111111111111', '11111111-1111-4111-8111-111111111111', 'Essential Shop', 'soporte-essential-test', 'Cali', 'CO', 'ESSENTIAL'),
  ('aaaaaaa2-2222-4222-8222-222222222222', '22222222-2222-4222-8222-222222222222', 'Studio Shop', 'soporte-studio-test', 'Cali', 'CO', 'STUDIO'),
  ('aaaaaaa3-3333-4333-8333-333333333333', '33333333-3333-4333-8333-333333333333', 'Prestige Shop', 'soporte-prestige-test', 'Cali', 'CO', 'PRESTIGE'),
  ('aaaaaaa4-5555-4555-8555-555555555555', '55555555-5555-4555-8555-555555555555', 'Other Shop', 'soporte-other-test', 'Cali', 'CO', 'STUDIO');

insert into public.suscripcion (negocio_id, plan_codigo, estado, fecha_proximo_cobro, pais_codigo) values
  ('aaaaaaa1-1111-4111-8111-111111111111', 'ESSENTIAL', 'ACTIVA', now() + interval '30 days', 'CO'),
  ('aaaaaaa2-2222-4222-8222-222222222222', 'STUDIO', 'ACTIVA', now() + interval '30 days', 'CO'),
  ('aaaaaaa3-3333-4333-8333-333333333333', 'PRESTIGE', 'ACTIVA', now() + interval '30 days', 'CO'),
  ('aaaaaaa4-5555-4555-8555-555555555555', 'STUDIO', 'ACTIVA', now() + interval '30 days', 'CO')
on conflict (negocio_id) do update set plan_codigo = excluded.plan_codigo, estado = 'ACTIVA';

insert into public.staff (usuario_id, nombre) values ('44444444-4444-4444-8444-444444444444', 'Staff Test');
insert into public.vinculo_staff_negocio (staff_id, negocio_id, estado)
values ('44444444-4444-4444-8444-444444444444', 'aaaaaaa2-2222-4222-8222-222222222222', 'ACTIVO');

do $$
begin
  if public._soporte_plan_incluye('aaaaaaa1-1111-4111-8111-111111111111', 'soporte_chat') then
    raise exception 'FALLA: Essential tiene soporte_chat';
  end if;
  if not public._soporte_plan_incluye('aaaaaaa2-2222-4222-8222-222222222222', 'soporte_chat') then
    raise exception 'FALLA: Studio no tiene soporte_chat';
  end if;
  if not public._soporte_plan_incluye('aaaaaaa3-3333-4333-8333-333333333333', 'soporte_prioritario') then
    raise exception 'FALLA: Prestige no es prioritario';
  end if;
  raise notice 'OK soporte chat: definiciones de plan';
end $$;

set local role authenticated;

do $$
declare
  v_sub text;
  v_negocio uuid;
  v_ok boolean;
  v_webhook boolean;
  v_email_admin boolean;
  v_email_negocio boolean;
  v_conv uuid;
  v_count integer;
  v_estado text;
begin
  v_sub := '11111111-1111-4111-8111-111111111111';
  v_negocio := 'aaaaaaa1-1111-4111-8111-111111111111';
  perform set_config('request.jwt.claims', format('{"sub":"%s","role":"authenticated"}', v_sub), true);
  begin
    perform public.soporte_enviar_mensaje(v_negocio, 'mensaje essential');
    raise exception 'FALLA: Essential pudo usar el chat';
  exception when others then
    if sqlerrm not like '%FUNCION_NO_INCLUIDA%' then raise; end if;
  end;

  v_sub := '44444444-4444-4444-8444-444444444444';
  v_negocio := 'aaaaaaa2-2222-4222-8222-222222222222';
  perform set_config('request.jwt.claims', format('{"sub":"%s","role":"authenticated"}', v_sub), true);
  begin
    perform public.soporte_enviar_mensaje(v_negocio, 'mensaje staff');
    raise exception 'FALLA: Staff pudo usar el chat';
  exception when others then
    if sqlerrm not like '%NO_AUTORIZADO%' then raise; end if;
  end;

  v_sub := '55555555-5555-4555-8555-555555555555';
  v_negocio := 'aaaaaaa2-2222-4222-8222-222222222222';
  perform set_config('request.jwt.claims', format('{"sub":"%s","role":"authenticated"}', v_sub), true);
  begin
    perform public.soporte_enviar_mensaje(v_negocio, 'mensaje ajeno');
    raise exception 'FALLA: barberia ajena pudo usar el chat';
  exception when others then
    if sqlerrm not like '%NO_AUTORIZADO%' then raise; end if;
  end;

  select count(*) into v_count
  from public.soporte_conversacion c
  where c.negocio_id = v_negocio;
  if v_count <> 0 then raise exception 'FALLA: un ataque creo conversacion'; end if;

  v_sub := '22222222-2222-4222-8222-222222222222';
  v_negocio := 'aaaaaaa2-2222-4222-8222-222222222222';
  perform set_config('request.jwt.claims', format('{"sub":"%s","role":"authenticated"}', v_sub), true);
  select alerta_webhook, alerta_email_admin, alerta_email_negocio into v_webhook, v_email_admin, v_email_negocio
  from public.soporte_enviar_mensaje(v_negocio, 'primer mensaje de prueba');
  if not v_webhook or not v_email_admin or v_email_negocio then
    raise exception 'FALLA: banderas de alerta del primer mensaje';
  end if;

  select alerta_webhook, alerta_email_admin into v_webhook, v_email_admin
  from public.soporte_enviar_mensaje(v_negocio, 'segundo mensaje de prueba');
  if not v_webhook or v_email_admin then
    raise exception 'FALLA: throttling de correo a SuperSU';
  end if;

  set local role postgres;
  update public.soporte_conversacion c
  set ultima_alerta_admin_at = now() - interval '11 minutes'
  where c.negocio_id = v_negocio;
  set local role authenticated;
  select alerta_email_admin into v_email_admin
  from public.soporte_enviar_mensaje(v_negocio, 'tercer mensaje de prueba');
  if not v_email_admin then raise exception 'FALLA: ventana de 10 minutos no expiro'; end if;

  select c.id into v_conv from public.soporte_conversacion c where c.negocio_id = v_negocio;

  v_sub := '10000000-0000-4000-8000-000000000005';
  perform set_config('request.jwt.claims', format('{"sub":"%s","role":"authenticated"}', v_sub), true);
  select alerta_webhook, alerta_email_admin, alerta_email_negocio into v_webhook, v_email_admin, v_email_negocio
  from public.soporte_enviar_mensaje(v_negocio, 'respuesta del admin');
  if v_webhook or v_email_admin or not v_email_negocio then
    raise exception 'FALLA: banderas de respuesta de SuperSU';
  end if;
  select alerta_email_negocio into v_email_negocio
  from public.soporte_enviar_mensaje(v_negocio, 'respuesta inmediata');
  if v_email_negocio then raise exception 'FALLA: throttling de correo a barberia'; end if;

  v_ok := public.soporte_marcar_leido(v_conv);
  if not v_ok then raise exception 'FALLA: marcar leido de SuperSU'; end if;
  select count(*) into v_count
  from public.soporte_mensaje m
  where m.conversacion_id = v_conv and m.remitente_rol = 'BARBERIA' and m.leido_at is null;
  if v_count <> 0 then raise exception 'FALLA: mensajes de barberia sin leido_at'; end if;

  v_sub := '22222222-2222-4222-8222-222222222222';
  perform set_config('request.jwt.claims', format('{"sub":"%s","role":"authenticated"}', v_sub), true);
  v_ok := public.soporte_marcar_leido(v_conv);
  if not v_ok then raise exception 'FALLA: marcar leido de barberia'; end if;
  select count(*) into v_count
  from public.soporte_mensaje m
  where m.conversacion_id = v_conv and m.remitente_rol = 'SUPERSU' and m.leido_at is null;
  if v_count <> 0 then raise exception 'FALLA: mensajes de SuperSU sin leido_at'; end if;

  begin
    perform public.soporte_cambiar_estado(v_conv, 'CERRADA');
    raise exception 'FALLA: barberia cambio el estado';
  exception when others then
    if sqlerrm not like '%NO_AUTORIZADO%' then raise; end if;
  end;

  v_sub := '10000000-0000-4000-8000-000000000005';
  perform set_config('request.jwt.claims', format('{"sub":"%s","role":"authenticated"}', v_sub), true);
  select estado into v_estado from public.soporte_cambiar_estado(v_conv, 'CERRADA');
  if v_estado <> 'CERRADA' then
    raise exception 'FALLA: SuperSU no pudo cerrar';
  end if;

  v_sub := '55555555-5555-4555-8555-555555555555';
  perform set_config('request.jwt.claims', format('{"sub":"%s","role":"authenticated"}', v_sub), true);
  select count(*) into v_count
  from public.soporte_conversacion c
  where c.negocio_id = 'aaaaaaa2-2222-4222-8222-222222222222';
  if v_count <> 0 then raise exception 'FALLA: fuga RLS de conversacion ajena'; end if;

  set local role postgres;
  if exists (
    select 1 from public.evento_auditoria e
    where e.entidad_tipo = 'soporte_mensaje'
      and e.payload_despues::text like '%primer mensaje de prueba%'
  ) then
    raise exception 'FALLA: la auditoria expone el cuerpo del mensaje';
  end if;
  set local role authenticated;
end $$;

do $$ begin
  raise notice 'OK soporte chat: gating, autorizacion, throttling, lectura, estado, RLS y auditoria';
end $$;
rollback;

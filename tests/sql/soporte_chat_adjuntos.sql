-- Prueba SQL de la migración 196. Ejecutar contra la base local:
--   docker exec -i supabase_db_stylernow psql -U postgres -v ON_ERROR_STOP=1 < tests/sql/soporte_chat_adjuntos.sql
begin;

insert into auth.users (id, email, aud, role) values
  ('c1111111-1111-4111-8111-111111111111', 'adj_studio@t.l', 'authenticated', 'authenticated'),
  ('c2222222-2222-4222-8222-222222222222', 'adj_essential@t.l', 'authenticated', 'authenticated'),
  ('c3333333-3333-4333-8333-333333333333', 'adj_otro@t.l', 'authenticated', 'authenticated');
insert into public.perfil (id, nombre, es_supersu) values
  ('c1111111-1111-4111-8111-111111111111', 'Studio', false),
  ('c2222222-2222-4222-8222-222222222222', 'Essential', false),
  ('c3333333-3333-4333-8333-333333333333', 'Otro', false)
on conflict (id) do update set nombre = excluded.nombre, es_supersu = excluded.es_supersu;
insert into public.negocio (id, owner_user_id, nombre, slug, ciudad, pais_codigo, plan_codigo) values
  ('ddddddd1-1111-4111-8111-111111111111', 'c1111111-1111-4111-8111-111111111111', 'Adj Studio', 'adj-studio-test', 'Cali', 'CO', 'STUDIO'),
  ('ddddddd2-2222-4222-8222-222222222222', 'c2222222-2222-4222-8222-222222222222', 'Adj Essential', 'adj-essential-test', 'Cali', 'CO', 'ESSENTIAL'),
  ('ddddddd3-3333-4333-8333-333333333333', 'c3333333-3333-4333-8333-333333333333', 'Adj Otro', 'adj-otro-test', 'Cali', 'CO', 'PRESTIGE');
insert into public.suscripcion (negocio_id, plan_codigo, estado, fecha_proximo_cobro, pais_codigo) values
  ('ddddddd1-1111-4111-8111-111111111111', 'STUDIO', 'ACTIVA', now() + interval '30 days', 'CO'),
  ('ddddddd2-2222-4222-8222-222222222222', 'ESSENTIAL', 'ACTIVA', now() + interval '30 days', 'CO'),
  ('ddddddd3-3333-4333-8333-333333333333', 'PRESTIGE', 'ACTIVA', now() + interval '30 days', 'CO')
on conflict (negocio_id) do update set plan_codigo = excluded.plan_codigo, estado = 'ACTIVA';

select set_config('t.super', coalesce((select id::text from public.perfil where es_supersu limit 1), ''), true);
set local role authenticated;

do $$
declare
  v_neg constant uuid := 'ddddddd1-1111-4111-8111-111111111111';
  v_otro constant uuid := 'ddddddd3-3333-4333-8333-333333333333';
  v_conv uuid;
  v_ruta text;
  v_fila record;
  v_n integer;
  v_super uuid;
begin
  -- Solo puede existir un SuperSU: se usa el de la base local (la prueba no crea otro).
  v_super := nullif(current_setting('t.super', true), '')::uuid;
  if v_super is null then raise exception 'La base local no tiene un SuperSU para la prueba'; end if;
  -- Dueño Studio: conversación garantizada y mensaje SOLO con adjunto
  perform set_config('request.jwt.claims', '{"sub":"c1111111-1111-4111-8111-111111111111","role":"authenticated"}', true);
  v_conv := public.soporte_asegurar_conversacion(v_neg);
  v_ruta := v_neg || '/' || v_conv || '/' || gen_random_uuid() || '.webp';
  select * into v_fila from public.soporte_enviar_mensaje(v_neg, '', v_ruta, 'IMAGEN', 'captura.webp');
  if v_fila.cuerpo <> '' or not v_fila.tiene_adjunto then raise exception 'FALLA: mensaje solo con adjunto'; end if;
  if (select ultimo_mensaje_preview from public.soporte_conversacion where id = v_conv) <> '📷 Imagen' then
    raise exception 'FALLA: preview de imagen';
  end if;
  if not public.soporte_ruta_autorizada(v_ruta) then raise exception 'FALLA: el dueño no puede usar su ruta'; end if;
  if public.soporte_ruta_autorizada(v_otro || '/' || v_conv || '/' || gen_random_uuid() || '.webp') then
    raise exception 'FALLA: el dueño accede a la ruta de otro negocio';
  end if;

  -- Vacío sin adjunto: rechazado
  begin
    perform public.soporte_enviar_mensaje(v_neg, '   ');
    raise exception 'FALLA: aceptó mensaje vacío';
  exception when others then
    if sqlerrm not like '%MENSAJE_REQUERIDO%' then raise; end if;
  end;

  -- Adjunto apuntando a otro negocio / tipo incoherente: rechazado
  begin
    perform public.soporte_enviar_mensaje(v_neg, 'hola', v_otro || '/' || v_conv || '/' || gen_random_uuid() || '.webp', 'IMAGEN', 'x.webp');
    raise exception 'FALLA: aceptó adjunto de otro negocio';
  exception when others then
    if sqlerrm not like '%ADJUNTO_INVALIDO%' then raise; end if;
  end;
  begin
    perform public.soporte_enviar_mensaje(v_neg, 'hola', v_neg || '/' || v_conv || '/' || gen_random_uuid() || '.pdf', 'IMAGEN', 'x.pdf');
    raise exception 'FALLA: aceptó tipo que no coincide con la extensión';
  exception when others then
    if sqlerrm not like '%ADJUNTO_INVALIDO%' then raise; end if;
  end;

  -- PDF con texto
  select * into v_fila from public.soporte_enviar_mensaje(v_neg, 'adjunto el comprobante', v_neg || '/' || v_conv || '/' || gen_random_uuid() || '.pdf', 'PDF', 'comprobante.pdf');
  if v_fila.prioritario then raise exception 'FALLA: Studio no es prioritario'; end if;

  -- Essential: sin chat ni subida
  perform set_config('request.jwt.claims', '{"sub":"c2222222-2222-4222-8222-222222222222","role":"authenticated"}', true);
  begin
    perform public.soporte_asegurar_conversacion('ddddddd2-2222-4222-8222-222222222222');
    raise exception 'FALLA: Essential obtuvo conversación';
  exception when others then
    if sqlerrm not like '%FUNCION_NO_INCLUIDA%' then raise; end if;
  end;

  -- Barbería: no ve respuestas rápidas, no las escribe y no ve la bandeja
  perform set_config('request.jwt.claims', '{"sub":"c1111111-1111-4111-8111-111111111111","role":"authenticated"}', true);
  select count(*) into v_n from public.soporte_respuesta_rapida;
  if v_n <> 0 then raise exception 'FALLA: barbería lee respuestas rápidas (%).', v_n; end if;
  begin
    insert into public.soporte_respuesta_rapida (titulo, atajo, cuerpo) values ('x', '/xx', 'x');
    raise exception 'FALLA: barbería escribió una respuesta rápida';
  exception when others then
    if sqlerrm not like '%row-level security%' then raise; end if;
  end;
  begin
    perform * from public.soporte_bandeja_admin();
    raise exception 'FALLA: barbería abrió la bandeja de SuperSU';
  exception when others then
    if sqlerrm not like '%NO_AUTORIZADO%' then raise; end if;
  end;

  -- SuperSU: ve las 6 semillas, ve la bandeja con el prioritario arriba y puede subir en cualquier negocio
  perform set_config('request.jwt.claims', format('{"sub":"%s","role":"authenticated"}', v_super), true);
  select count(*) into v_n from public.soporte_respuesta_rapida where activo;
  if v_n < 6 then raise exception 'FALLA: SuperSU no ve las 6 respuestas rápidas (%).', v_n; end if;
  insert into public.soporte_respuesta_rapida (titulo, atajo, cuerpo) values ('Prueba', '/prueba', 'Texto');
  if not public.soporte_ruta_autorizada(v_neg || '/' || v_conv || '/' || gen_random_uuid() || '.pdf') then
    raise exception 'FALLA: SuperSU no puede acceder a adjuntos';
  end if;
  perform public.soporte_enviar_mensaje(v_otro, 'respuesta de soporte');
  select count(*) into v_n from public.soporte_bandeja_admin();
  if v_n < 2 then raise exception 'FALLA: bandeja incompleta'; end if;
  if (select negocio_id from public.soporte_bandeja_admin() limit 1) <> v_otro then
    raise exception 'FALLA: el prioritario (Prestige) no está arriba';
  end if;
  raise notice 'OK soporte chat adjuntos y respuestas rápidas';
end $$;

rollback;

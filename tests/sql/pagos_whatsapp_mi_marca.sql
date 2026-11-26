-- Prueba SQL de la migración 198 (cobros por Mercado Pago de recargas de WhatsApp y de Mi Marca). Ejecutar contra la base local:
--   docker exec -i supabase_db_stylernow psql -U postgres -v ON_ERROR_STOP=1 < tests/sql/pagos_whatsapp_mi_marca.sql
-- Todo ocurre en una transacción que se revierte al final.
begin;

insert into auth.users (id, email, aud, role) values
  ('e1111111-1111-4111-8111-111111111111', 'pw_dueno@t.l', 'authenticated', 'authenticated'),
  ('e2222222-2222-4222-8222-222222222222', 'pw_otro@t.l', 'authenticated', 'authenticated');
insert into public.perfil (id, nombre, es_supersu) values
  ('e1111111-1111-4111-8111-111111111111', 'Dueño', false),
  ('e2222222-2222-4222-8222-222222222222', 'Otro', false)
on conflict (id) do update set nombre = excluded.nombre, es_supersu = excluded.es_supersu;
insert into public.negocio (id, owner_user_id, nombre, slug, ciudad, pais_codigo, plan_codigo, estado) values
  ('eeeeeee1-1111-4111-8111-111111111111', 'e1111111-1111-4111-8111-111111111111', 'PW Uno', 'pw-uno-test', 'Cali', 'CO', 'STUDIO', 'ACTIVO'),
  ('eeeeeee2-2222-4222-8222-222222222222', 'e2222222-2222-4222-8222-222222222222', 'PW Otro', 'pw-otro-test', 'Cali', 'CO', 'STUDIO', 'ACTIVO');
insert into public.suscripcion (negocio_id, plan_codigo, estado, fecha_proximo_cobro, pais_codigo) values
  ('eeeeeee1-1111-4111-8111-111111111111', 'STUDIO', 'ACTIVA', now() + interval '30 days', 'CO'),
  ('eeeeeee2-2222-4222-8222-222222222222', 'STUDIO', 'ACTIVA', now() + interval '30 days', 'CO')
on conflict (negocio_id) do update set plan_codigo = excluded.plan_codigo, estado = 'ACTIVA';

select set_config('request.jwt.claims', '{"sub":"e1111111-1111-4111-8111-111111111111","role":"authenticated"}', true);
set local role authenticated;

do $$
declare
  v_neg constant uuid := 'eeeeeee1-1111-4111-8111-111111111111';
  v_paq uuid; v_compra uuid; v_pago public.pago; v_pago2 public.pago; v_r jsonb; v_estado text; v_n int; v_lote int; v_hasta timestamptz;
begin
  -- ── WhatsApp ──
  select id into v_paq from public.whatsapp_paquete where activo order by conversaciones limit 1;
  v_compra := public.whatsapp_solicitar_recarga(v_neg, v_paq);
  v_pago := public.whatsapp_iniciar_pago_recarga(v_compra);
  if v_pago.tipo <> 'PAQUETE_CONVERSACIONES_WHATSAPP' or v_pago.estado <> 'PENDIENTE' then raise exception 'FALLA: cobro WhatsApp mal creado'; end if;
  v_pago2 := public.whatsapp_iniciar_pago_recarga(v_compra);
  if v_pago2.id <> v_pago.id then raise exception 'FALLA: no reutiliza el cobro pendiente'; end if;

  -- otro propietario no puede cobrar la solicitud ajena
  perform set_config('request.jwt.claims', '{"sub":"e2222222-2222-4222-8222-222222222222","role":"authenticated"}', true);
  begin
    perform public.whatsapp_iniciar_pago_recarga(v_compra);
    raise exception 'FALLA: otro negocio pudo iniciar el cobro';
  exception when others then
    if sqlerrm not like '%NO_AUTORIZADO%' then raise; end if;
  end;
  perform set_config('request.jwt.claims', '{"sub":"e1111111-1111-4111-8111-111111111111","role":"authenticated"}', true);
end $$;

-- Aplicar resultados como el servidor (service_role): el navegador nunca puede hacerlo.
reset role;
do $$
declare
  v_neg constant uuid := 'eeeeeee1-1111-4111-8111-111111111111';
  v_pago public.pago; v_r jsonb; v_estado text; v_lote int; v_hasta timestamptz; v_n int; v_pago_mm public.pago; v_pago_plan public.pago;
begin
  select * into v_pago from public.pago where negocio_id = v_neg and tipo = 'PAQUETE_CONVERSACIONES_WHATSAPP' and estado = 'PENDIENTE';

  -- rechazado: la solicitud sigue pendiente y no acredita nada
  v_r := public.aplicar_evento_pago(v_pago.id, 'mp-rech-1', 'RECHAZADO', '{}'::jsonb);
  if (v_r->>'procesado') <> 'true' then raise exception 'FALLA: rechazo no procesado %', v_r; end if;
  select estado::text into v_estado from public.whatsapp_compra_recarga where id = (v_pago.metadata->>'compra_id')::uuid;
  if v_estado <> 'PENDIENTE_PAGO' then raise exception 'FALLA: el rechazo cambió la solicitud (%)', v_estado; end if;

  -- cobro nuevo (reintento) y aprobado: acredita el lote una sola vez
  perform set_config('request.jwt.claims', '{"sub":"e1111111-1111-4111-8111-111111111111","role":"authenticated"}', true);
  set local role authenticated;
  v_pago := public.whatsapp_iniciar_pago_recarga((v_pago.metadata->>'compra_id')::uuid);
  reset role;
  v_r := public.aplicar_evento_pago(v_pago.id, 'mp-ok-1', 'APROBADO', '{"transaction_amount": 1}'::jsonb);
  if (v_r->>'procesado') <> 'true' then raise exception 'FALLA: aprobación no procesada %', v_r; end if;
  select estado::text into v_estado from public.whatsapp_compra_recarga where id = (v_pago.metadata->>'compra_id')::uuid;
  if v_estado <> 'ACREDITADA' then raise exception 'FALLA: no se acreditó (%)', v_estado; end if;
  select count(*) into v_lote from public.whatsapp_conversacion_lote where compra_id = (v_pago.metadata->>'compra_id')::uuid;
  v_r := public.aplicar_evento_pago(v_pago.id, 'mp-ok-1', 'APROBADO', '{}'::jsonb);   -- webhook repetido
  select count(*) into v_n from public.whatsapp_conversacion_lote where compra_id = (v_pago.metadata->>'compra_id')::uuid;
  if v_lote <> 1 or v_n <> 1 then raise exception 'FALLA: el lote no es idempotente (% / %)', v_lote, v_n; end if;
  if (v_r->>'motivo') is distinct from 'YA_PROCESADO' then raise exception 'FALLA: el repetido no quedó como YA_PROCESADO %', v_r; end if;

  -- ── Mi Marca ──
  perform set_config('request.jwt.claims', '{"sub":"e1111111-1111-4111-8111-111111111111","role":"authenticated"}', true);
  set local role authenticated;
  v_pago_mm := public.mi_marca_iniciar_pago(v_neg);
  if v_pago_mm.monto <> 29900 then raise exception 'FALLA: precio de Mi Marca inesperado %', v_pago_mm.monto; end if;
  if (public.mi_marca_iniciar_pago(v_neg)).id <> v_pago_mm.id then raise exception 'FALLA: Mi Marca no reutiliza el pendiente'; end if;
  -- un cobro de Mi Marca pendiente NO bloquea mejorar el plan
  v_pago_plan := public.solicitar_upgrade_plan(v_neg, 'PRESTIGE');
  if v_pago_plan.id is null then raise exception 'FALLA: el cobro de Mi Marca bloqueó el upgrade del plan'; end if;
  reset role;

  v_r := public.aplicar_evento_pago(v_pago_mm.id, 'mp-mm-1', 'APROBADO', '{}'::jsonb);
  if (v_r->>'procesado') <> 'true' then raise exception 'FALLA: Mi Marca no se aplicó %', v_r; end if;
  select hasta into v_hasta from public.negocio_addon where negocio_id = v_neg and addon_codigo = 'MI_MARCA' and activo;
  if v_hasta is null or v_hasta < now() + interval '27 days' then raise exception 'FALLA: Mi Marca sin vigencia de un mes (%)', v_hasta; end if;
  v_r := public.aplicar_evento_pago(v_pago_mm.id, 'mp-mm-1', 'APROBADO', '{}'::jsonb);
  if (v_r->>'motivo') is distinct from 'YA_PROCESADO' then raise exception 'FALLA: Mi Marca no es idempotente %', v_r; end if;
end $$;

-- Los roles de producto no pueden ejecutar las funciones internas.
set local role authenticated;
do $$
begin
  begin
    perform public._mi_marca_aplicar_pago(null::public.pago, 'x', 'APROBADO', '{}'::jsonb);
    raise exception 'FALLA: authenticated pudo ejecutar _mi_marca_aplicar_pago';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.aplicar_evento_pago('eeeeeee1-1111-4111-8111-111111111111', 'x', 'APROBADO', '{}'::jsonb);
    raise exception 'FALLA: authenticated pudo ejecutar aplicar_evento_pago';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;

select 'OK pagos WhatsApp y Mi Marca' as resultado;
rollback;

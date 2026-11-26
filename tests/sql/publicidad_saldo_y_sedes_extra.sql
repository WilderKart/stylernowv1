-- Prueba SQL de la migración 200 (publicidad prepagada y sedes adicionales). Ejecutar contra la base local:
--   docker exec -i supabase_db_stylernow psql -U postgres -v ON_ERROR_STOP=1 < tests/sql/publicidad_saldo_y_sedes_extra.sql
-- Todo ocurre en una transacción que se revierte al final.
begin;

insert into auth.users (id, email, aud, role) values
  ('f1111111-1111-4111-8111-111111111111', 'ps_dueno@t.l', 'authenticated', 'authenticated'),
  ('f2222222-2222-4222-8222-222222222222', 'ps_otro@t.l', 'authenticated', 'authenticated');
insert into public.perfil (id, nombre, es_supersu) values
  ('f1111111-1111-4111-8111-111111111111', 'Dueño', false),
  ('f2222222-2222-4222-8222-222222222222', 'Otro', false)
on conflict (id) do update set nombre = excluded.nombre, es_supersu = excluded.es_supersu;
insert into public.negocio (id, owner_user_id, nombre, slug, ciudad, pais_codigo, plan_codigo, estado) values
  ('fffffff1-1111-4111-8111-111111111111', 'f1111111-1111-4111-8111-111111111111', 'PS Essential', 'ps-essential-test', 'Cali', 'CO', 'ESSENTIAL', 'ACTIVO'),
  ('fffffff2-2222-4222-8222-222222222222', 'f2222222-2222-4222-8222-222222222222', 'PS Otro', 'ps-otro-test', 'Cali', 'CO', 'STUDIO', 'ACTIVO');
insert into public.suscripcion (negocio_id, plan_codigo, estado, fecha_proximo_cobro, pais_codigo) values
  ('fffffff1-1111-4111-8111-111111111111', 'ESSENTIAL', 'ACTIVA', now() + interval '30 days', 'CO'),
  ('fffffff2-2222-4222-8222-222222222222', 'STUDIO', 'ACTIVA', now() + interval '30 days', 'CO')
on conflict (negocio_id) do update set plan_codigo = excluded.plan_codigo, estado = 'ACTIVA';
insert into public.sede (negocio_id, nombre, direccion, ciudad, horario_base, es_principal) values
  ('fffffff1-1111-4111-8111-111111111111', 'Principal', 'Calle 1', 'Cali', '{}'::jsonb, true);

select set_config('request.jwt.claims', '{"sub":"f1111111-1111-4111-8111-111111111111","role":"authenticated"}', true);
set local role authenticated;

do $$
declare
  v_neg constant uuid := 'fffffff1-1111-4111-8111-111111111111';
  v_paq uuid; v_pago public.pago; v_camp public.campana_publicitaria; v_lim int; v_sede public.sede;
begin
  -- ── Sedes: Essential = 1 sede; la segunda exige pagar la extra (90.000) ──
  begin
    perform public.crear_sede(v_neg, 'Segunda', 'Calle 2', 'Cali', '{}'::jsonb);
    raise exception 'FALLA: Essential creó una 2.ª sede sin pagarla';
  exception when others then
    if sqlerrm not like '%PLAN_LIMIT_EXCEEDED%' then raise; end if;
  end;
  v_pago := public.sede_extra_iniciar_pago(v_neg, 'AGREGAR');
  if v_pago.monto <> 90000 then raise exception 'FALLA: precio de la sede extra % (esperado 90000)', v_pago.monto; end if;
  if (public.sede_extra_iniciar_pago(v_neg, 'AGREGAR')).id <> v_pago.id then raise exception 'FALLA: no reutiliza el cobro pendiente'; end if;
  begin
    perform public.sede_extra_iniciar_pago(v_neg, 'RENOVAR');
    raise exception 'FALLA: renovó sin tener sedes extra';
  exception when others then
    if sqlerrm not like '%SIN_SEDES_EXTRA_QUE_RENOVAR%' then raise; end if;
  end;
  -- un cobro de sede extra pendiente NO bloquea mejorar el plan
  if (public.solicitar_upgrade_plan(v_neg, 'STUDIO')).id is null then raise exception 'FALLA: la sede extra bloqueó el upgrade'; end if;

  -- ── Publicidad: sin saldo no se activa ──
  select id into v_paq from public.ads_paquete_recarga where monto_cop = 50000;
  insert into public.campana_publicitaria (negocio_id, formato, presupuesto_diario, presupuesto_total, unidad_cobro)
  values (v_neg, 'DESTACADO', 5000, 40000, 'CPC') returning * into v_camp;
  begin
    perform public.activar_campana(v_camp.id);
    raise exception 'FALLA: activó una campaña sin saldo publicitario';
  exception when others then
    if sqlerrm not like '%SALDO_INSUFICIENTE%' then raise; end if;
  end;
  v_pago := public.ads_iniciar_recarga(v_neg, v_paq);
  if v_pago.monto <> 50000 then raise exception 'FALLA: monto de recarga %', v_pago.monto; end if;
  if (public.ads_iniciar_recarga(v_neg, v_paq)).id <> v_pago.id then raise exception 'FALLA: no reutiliza la recarga pendiente'; end if;

  -- el otro negocio no puede ver el saldo ni cobrar por este
  perform set_config('request.jwt.claims', '{"sub":"f2222222-2222-4222-8222-222222222222","role":"authenticated"}', true);
  begin
    perform public.ads_iniciar_recarga(v_neg, v_paq);
    raise exception 'FALLA: otro negocio inició una recarga ajena';
  exception when others then
    if sqlerrm not like '%NO_AUTORIZADO%' then raise; end if;
  end;
  perform set_config('request.jwt.claims', '{"sub":"f1111111-1111-4111-8111-111111111111","role":"authenticated"}', true);
end $$;

reset role;
do $$
declare
  v_neg constant uuid := 'fffffff1-1111-4111-8111-111111111111';
  v_pago public.pago; v_r jsonb; v_saldo numeric; v_camp uuid; v_n int; v_estado text; v_lim int; v_hasta timestamptz; v_cant int;
begin
  -- ── Aplicar la recarga de publicidad (servidor) ──
  select * into v_pago from public.pago where negocio_id = v_neg and metadata->>'concepto' = 'ADS_RECARGA' and estado = 'PENDIENTE';
  v_r := public.aplicar_evento_pago(v_pago.id, 'mp-ads-1', 'APROBADO', '{}'::jsonb);
  if (v_r->>'procesado') <> 'true' then raise exception 'FALLA: recarga no aplicada %', v_r; end if;
  v_r := public.aplicar_evento_pago(v_pago.id, 'mp-ads-1', 'APROBADO', '{}'::jsonb);   -- webhook repetido
  select saldo_disponible into v_saldo from public.ads_saldo where negocio_id = v_neg;
  if v_saldo <> 50000 then raise exception 'FALLA: saldo % tras recarga (idempotencia)', v_saldo; end if;
  if (select count(*) from public.ads_saldo_movimiento where negocio_id = v_neg and tipo = 'RECARGA') <> 1 then raise exception 'FALLA: movimientos duplicados'; end if;

  -- ── La campaña consume del saldo publicitario, NO del Wallet ──
  select id into v_camp from public.campana_publicitaria where negocio_id = v_neg;
  perform set_config('request.jwt.claims', '{"sub":"f1111111-1111-4111-8111-111111111111","role":"authenticated"}', true);
  set local role authenticated;
  perform public.activar_campana(v_camp);
  reset role;
  perform public.registrar_clic_patrocinado(v_camp, v_neg);
  select saldo_disponible into v_saldo from public.ads_saldo where negocio_id = v_neg;
  if v_saldo <> 50000 - 800 then raise exception 'FALLA: el clic no descontó 800 del saldo publicitario (%)', v_saldo; end if;
  if exists (select 1 from public.wallet_movimiento m join public.wallet w on w.id = m.wallet_id where w.negocio_id = v_neg and m.tipo = 'CAMPANA') then
    raise exception 'FALLA: la campaña tocó el Wallet';
  end if;

  -- saldo agotado → la campaña se detiene; al recargar se puede reactivar
  update public.ads_saldo set saldo_disponible = 100 where negocio_id = v_neg;
  perform public.registrar_clic_patrocinado(v_camp, v_neg);
  select estado::text into v_estado from public.campana_publicitaria where id = v_camp;
  if v_estado <> 'AGOTADA' then raise exception 'FALLA: sin saldo la campaña debía quedar AGOTADA (%)', v_estado; end if;
  update public.ads_saldo set saldo_disponible = 20000 where negocio_id = v_neg;
  set local role authenticated;
  perform public.activar_campana(v_camp);
  reset role;
  select estado::text into v_estado from public.campana_publicitaria where id = v_camp;
  if v_estado <> 'ACTIVA' then raise exception 'FALLA: no se reactivó tras recargar (%)', v_estado; end if;

  -- ── Aplicar la sede extra (servidor) ──
  select * into v_pago from public.pago where negocio_id = v_neg and metadata->>'concepto' = 'SEDE_EXTRA' and estado = 'PENDIENTE';
  v_r := public.aplicar_evento_pago(v_pago.id, 'mp-sede-1', 'APROBADO', '{}'::jsonb);
  if (v_r->>'procesado') <> 'true' then raise exception 'FALLA: sede extra no aplicada %', v_r; end if;
  v_r := public.aplicar_evento_pago(v_pago.id, 'mp-sede-1', 'APROBADO', '{}'::jsonb);
  if (v_r->>'motivo') is distinct from 'YA_PROCESADO' then raise exception 'FALLA: sede extra no idempotente %', v_r; end if;
  select cantidad, hasta into v_cant, v_hasta from public.negocio_addon where negocio_id = v_neg and addon_codigo = 'SEDE_EXTRA';
  if v_cant <> 1 or v_hasta < now() + interval '27 days' then raise exception 'FALLA: vigencia/cantidad de la sede extra (% / %)', v_cant, v_hasta; end if;

  set local role authenticated;
  select public.limite_sedes_negocio(v_neg) into v_lim;
  if v_lim <> 2 then raise exception 'FALLA: límite efectivo % (esperado 2)', v_lim; end if;
  perform public.crear_sede(v_neg, 'Segunda', 'Calle 2', 'Cali', '{}'::jsonb);
  begin
    perform public.crear_sede(v_neg, 'Tercera', 'Calle 3', 'Cali', '{}'::jsonb);
    raise exception 'FALLA: creó una 3.ª sede en Essential (tope 1 extra)';
  exception when others then
    if sqlerrm not like '%PLAN_LIMIT_EXCEEDED%' then raise; end if;
  end;
  begin
    perform public.sede_extra_iniciar_pago(v_neg, 'AGREGAR');
    raise exception 'FALLA: permitió superar el tope de sedes extra';
  exception when others then
    if sqlerrm not like '%TOPE_SEDES_EXTRA%' then raise; end if;
  end;
  -- renovar: cobra por cada sede extra vigente
  if (public.sede_extra_iniciar_pago(v_neg, 'RENOVAR')).monto <> 90000 then raise exception 'FALLA: monto de renovación'; end if;
  reset role;

  -- vencida la sede extra, el límite vuelve al del plan
  update public.negocio_addon set hasta = now() - interval '1 day' where negocio_id = v_neg and addon_codigo = 'SEDE_EXTRA';
  set local role authenticated;
  select public.limite_sedes_negocio(v_neg) into v_lim;
  if v_lim <> 1 then raise exception 'FALLA: vencida, el límite debía volver a 1 (%)', v_lim; end if;
  reset role;
end $$;

-- Los roles de producto no pueden tocar saldos ni ejecutar funciones internas.
set local role authenticated;
do $$
begin
  begin
    update public.ads_saldo set saldo_disponible = 999999;
    if found then raise exception 'FALLA: authenticated pudo editar el saldo publicitario'; end if;
  exception when insufficient_privilege then null;
  end;
  begin
    perform public._ads_recarga_aplicar_pago(null::public.pago, 'x', 'APROBADO', '{}'::jsonb);
    raise exception 'FALLA: authenticated ejecutó _ads_recarga_aplicar_pago';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public._sede_extra_aplicar_pago(null::public.pago, 'x', 'APROBADO', '{}'::jsonb);
    raise exception 'FALLA: authenticated ejecutó _sede_extra_aplicar_pago';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;

select 'OK publicidad prepagada y sedes extra' as resultado;
rollback;

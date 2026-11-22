-- 177: Barberos adicionales (FASE 2A) — RPC de SuperAdmin: configuración, precio por plan, consulta y acciones con motivo.
--
-- Todas: primera línea `is_supersu()` (con coalesce: NULL no lanza), motivo obligatorio (≥5 caracteres) en todo lo que cambia algo,
-- y auditoría con valor anterior/nuevo. Cambiar un precio NUNCA toca lotes existentes (precio congelado por lote).
-- Excepciones (activación manual, reactivación, ajuste): responsable = quien actúa, vigencia obligatoria y tope configurable,
-- historial del lote.
-- Rollback: 177_adicionales_rpc_superadmin_REVERSION.sql.txt.

create or replace function public._adicional_exige_supersu(p_motivo text default null, p_motivo_obligatorio boolean default true)
returns void language plpgsql stable security definer set search_path = public as $$
begin
  if auth.uid() is null or not coalesce(public.is_supersu(), false) then raise exception 'NO_AUTORIZADO'; end if;
  if p_motivo_obligatorio and length(btrim(coalesce(p_motivo, ''))) < 5 then raise exception 'MOTIVO_REQUERIDO'; end if;
end $$;
revoke all on function public._adicional_exige_supersu(text, boolean) from public, anon, authenticated;

-- ── Configuración y precios ────────────────────────────────────────────────────────────────────
create or replace function public.admin_adicional_config_obtener()
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  perform public._adicional_exige_supersu(null, false);
  return jsonb_build_object(
    'config', (select to_jsonb(c) - 'id' from public.adicional_config c where c.id),
    'precios', coalesce((select jsonb_agg(to_jsonb(p) order by p.pais_codigo, p.plan_codigo) from public.adicional_precio_plan p), '[]'::jsonb),
    'planes', coalesce((select jsonb_agg(jsonb_build_object('codigo', x.codigo, 'nombre', x.nombre) order by x.staff_tope_absoluto nulls last) from public.plan x), '[]'::jsonb),
    'paises', coalesce((select jsonb_agg(codigo order by codigo) from public.pais), '[]'::jsonb),
    'estados', coalesce((select jsonb_agg(to_jsonb(e) order by e.orden) from public.adicional_estado_def e), '[]'::jsonb),
    'transiciones', coalesce((select jsonb_agg(to_jsonb(t) order by t.desde, t.hacia) from public.adicional_transicion t), '[]'::jsonb));
end $$;
revoke all on function public.admin_adicional_config_obtener() from public, anon, authenticated;
grant execute on function public.admin_adicional_config_obtener() to authenticated;

create or replace function public.admin_adicional_config_guardar(p_config jsonb, p_motivo text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare a public.adicional_config; n public.adicional_config; v_av int[];
begin
  perform public._adicional_exige_supersu(p_motivo);
  if p_config is null or jsonb_typeof(p_config) <> 'object' then raise exception 'CONFIG_INVALIDA'; end if;
  select * into a from public.adicional_config where id for update;
  n := a;
  if p_config ? 'habilitado' then n.habilitado := (p_config ->> 'habilitado')::boolean; end if;
  if p_config ? 'max_por_negocio' then n.max_por_negocio := (p_config ->> 'max_por_negocio')::int; end if;
  if p_config ? 'max_por_lote' then n.max_por_lote := (p_config ->> 'max_por_lote')::int; end if;
  if p_config ? 'periodo_dias' then n.periodo_dias := (p_config ->> 'periodo_dias')::int; end if;
  if p_config ? 'gracia_dias' then n.gracia_dias := (p_config ->> 'gracia_dias')::int; end if;
  if p_config ? 'checkout_expira_horas' then n.checkout_expira_horas := (p_config ->> 'checkout_expira_horas')::int; end if;
  if p_config ? 'pago_pendiente_expira_dias' then n.pago_pendiente_expira_dias := (p_config ->> 'pago_pendiente_expira_dias')::int; end if;
  if p_config ? 'activacion_manual_max_dias' then n.activacion_manual_max_dias := (p_config ->> 'activacion_manual_max_dias')::int; end if;
  if p_config ? 'avisos_dias_antes' then
    select coalesce(array_agg(distinct x::int order by x::int desc), '{}') into v_av from jsonb_array_elements_text(p_config -> 'avisos_dias_antes') x;
    n.avisos_dias_antes := v_av;
  end if;
  if n.max_por_lote > n.max_por_negocio then raise exception 'CONFIG_INVALIDA: max_por_lote > max_por_negocio'; end if;
  update public.adicional_config set habilitado = n.habilitado, max_por_negocio = n.max_por_negocio, max_por_lote = n.max_por_lote,
         periodo_dias = n.periodo_dias, gracia_dias = n.gracia_dias, avisos_dias_antes = n.avisos_dias_antes,
         checkout_expira_horas = n.checkout_expira_horas, pago_pendiente_expira_dias = n.pago_pendiente_expira_dias,
         activacion_manual_max_dias = n.activacion_manual_max_dias, updated_at = now(), updated_by = auth.uid()
   where id;
  perform public._auditar('adicional_config', null, 'ADICIONAL_CONFIG_CAMBIADA', null, to_jsonb(a) - 'id', to_jsonb(n) - 'id', p_motivo);
  return to_jsonb(n) - 'id';
end $$;
revoke all on function public.admin_adicional_config_guardar(jsonb, text) from public, anon, authenticated;
grant execute on function public.admin_adicional_config_guardar(jsonb, text) to authenticated;

create or replace function public.admin_adicional_precio_guardar(p_pais char, p_plan public.plan_codigo, p_precio numeric, p_motivo text, p_activo boolean default true)
returns jsonb language plpgsql security definer set search_path = public as $$
declare a public.adicional_precio_plan; n public.adicional_precio_plan;
begin
  perform public._adicional_exige_supersu(p_motivo);
  if p_precio is null or p_precio <= 0 then raise exception 'PRECIO_INVALIDO'; end if;
  if not exists (select 1 from public.pais where codigo = p_pais) then raise exception 'PAIS_INVALIDO'; end if;
  select * into a from public.adicional_precio_plan where pais_codigo = p_pais and plan_codigo = p_plan for update;
  insert into public.adicional_precio_plan (pais_codigo, plan_codigo, precio_mensual, activo, updated_by)
  values (p_pais, p_plan, p_precio, coalesce(p_activo, true), auth.uid())
  on conflict (pais_codigo, plan_codigo) do update set precio_mensual = excluded.precio_mensual, activo = excluded.activo, updated_at = now(), updated_by = auth.uid()
  returning * into n;
  -- Los lotes vigentes conservan su precio: esta función no los toca.
  perform public._auditar('adicional_precio_plan', null, 'ADICIONAL_PRECIO_CAMBIADO', null, to_jsonb(a), to_jsonb(n), p_motivo);
  return to_jsonb(n);
end $$;
revoke all on function public.admin_adicional_precio_guardar(char, public.plan_codigo, numeric, text, boolean) from public, anon, authenticated;
grant execute on function public.admin_adicional_precio_guardar(char, public.plan_codigo, numeric, text, boolean) to authenticated;

-- ── Consulta ────────────────────────────────────────────────────────────────────────────────────
create or replace function public.admin_adicional_listar(p_filtros jsonb default '{}'::jsonb)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_neg uuid; v_est text; v_vence date; v_lim int; v_off int; v_total int; v_filas jsonb; v_txt text;
begin
  perform public._adicional_exige_supersu(null, false);
  v_neg := nullif(p_filtros ->> 'negocio_id', '')::uuid;
  v_est := nullif(p_filtros ->> 'estado', '');
  v_vence := nullif(p_filtros ->> 'vence_antes', '')::date;
  v_txt := nullif(btrim(p_filtros ->> 'texto'), '');
  v_lim := least(greatest(coalesce((p_filtros ->> 'limite')::int, 50), 1), 200);
  v_off := greatest(coalesce((p_filtros ->> 'desde')::int, 0), 0);
  select count(*) into v_total from public.adicional_lote l join public.negocio n on n.id = l.negocio_id
   where (v_neg is null or l.negocio_id = v_neg) and (v_est is null or l.estado = v_est)
     and (v_vence is null or public.adicional_fecha_bogota(l.vigente_hasta) <= v_vence)
     and (v_txt is null or n.nombre ilike '%' || v_txt || '%');
  select coalesce(jsonb_agg(x), '[]'::jsonb) into v_filas from (
    select jsonb_build_object(
      'id', l.id, 'negocio_id', l.negocio_id, 'negocio', n.nombre, 'plan_codigo', l.plan_codigo, 'cantidad', l.cantidad,
      'precio_unitario', l.precio_unitario, 'total', l.total, 'moneda', l.moneda, 'estado', l.estado, 'origen', l.origen,
      'contratado_at', l.contratado_at, 'inicio_periodo_at', l.inicio_periodo_at, 'vigente_hasta', l.vigente_hasta, 'gracia_fin', l.gracia_fin,
      'dias_para_vencer', case when l.vigente_hasta is null then null else public.adicional_dias_para(l.vigente_hasta) end,
      'periodo_n', l.periodo_n, 'cancelar_renovacion', l.cancelar_renovacion, 'manual_tipo', l.manual_tipo,
      'cobros', (select count(*) from public.adicional_cobro c where c.lote_id = l.id),
      'cobros_fallidos', (select count(*) from public.adicional_cobro c where c.lote_id = l.id and c.estado in ('RECHAZADO', 'ANULADO')),
      'ultimo_mp_payment_id', (select c.mp_payment_id from public.adicional_cobro c where c.lote_id = l.id and c.mp_payment_id is not null order by c.periodo_n desc limit 1),
      'revisiones_abiertas', (select count(*) from public.adicional_pago_revision r where r.lote_id = l.id and r.estado = 'PENDIENTE')) as x
    from public.adicional_lote l join public.negocio n on n.id = l.negocio_id
    where (v_neg is null or l.negocio_id = v_neg) and (v_est is null or l.estado = v_est)
      and (v_vence is null or public.adicional_fecha_bogota(l.vigente_hasta) <= v_vence)
      and (v_txt is null or n.nombre ilike '%' || v_txt || '%')
    order by l.created_at desc limit v_lim offset v_off) q;
  return jsonb_build_object('total', v_total, 'filas', v_filas);
end $$;
revoke all on function public.admin_adicional_listar(jsonb) from public, anon, authenticated;
grant execute on function public.admin_adicional_listar(jsonb) to authenticated;

create or replace function public.admin_adicional_detalle(p_lote_id uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_l public.adicional_lote;
begin
  perform public._adicional_exige_supersu(null, false);
  select * into v_l from public.adicional_lote where id = p_lote_id;
  if not found then raise exception 'LOTE_NO_ENCONTRADO'; end if;
  return jsonb_build_object(
    'lote', to_jsonb(v_l), 'negocio', (select n.nombre from public.negocio n where n.id = v_l.negocio_id),
    'cobros', coalesce((select jsonb_agg(to_jsonb(c) order by c.periodo_n desc, c.created_at desc) from public.adicional_cobro c where c.lote_id = p_lote_id), '[]'::jsonb),
    'historial', coalesce((select jsonb_agg(to_jsonb(h) order by h.created_at desc) from public.adicional_historial h where h.lote_id = p_lote_id), '[]'::jsonb),
    'revisiones', coalesce((select jsonb_agg(to_jsonb(r) order by r.created_at desc) from public.adicional_pago_revision r where r.lote_id = p_lote_id), '[]'::jsonb),
    'reembolsos', coalesce((select jsonb_agg(to_jsonb(r) order by r.created_at desc) from public.adicional_reembolso r where r.lote_id = p_lote_id), '[]'::jsonb),
    'capacidad', public._capacidad_profesional(v_l.negocio_id));
end $$;
revoke all on function public.admin_adicional_detalle(uuid) from public, anon, authenticated;
grant execute on function public.admin_adicional_detalle(uuid) to authenticated;

-- ── Acciones con motivo ─────────────────────────────────────────────────────────────────────────
-- p_accion: SUSPENDER | REACTIVAR (requiere datos.dias = vigencia de la excepción) | CANCELAR | AJUSTAR (datos.cantidad)
create or replace function public.admin_adicional_accion(p_lote_id uuid, p_accion text, p_motivo text, p_datos jsonb default '{}'::jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_l public.adicional_lote; c public.adicional_config; v_dias int; v_cant int; v_otros int; v_hasta timestamptz;
begin
  perform public._adicional_exige_supersu(p_motivo);
  select * into v_l from public.adicional_lote where id = p_lote_id;
  if not found then raise exception 'LOTE_NO_ENCONTRADO'; end if;
  select * into c from public.adicional_config where id;
  p_accion := upper(coalesce(p_accion, ''));
  if p_accion = 'SUSPENDER' then
    perform public._adicional_transicionar(p_lote_id, 'SUSPENDIDO', 'SUSPENDIDO_POR_SUPERADMIN', 'SUPERSU', auth.uid(), p_motivo);
    perform public._adicional_notificar(p_lote_id, 'ADICIONAL_SUSPENDIDO', 'admin-susp:' || extract(epoch from now())::bigint);
  elsif p_accion = 'REACTIVAR' then
    v_dias := (p_datos ->> 'dias')::int;
    if v_dias is null or v_dias < 1 or v_dias > c.activacion_manual_max_dias then raise exception 'VIGENCIA_INVALIDA'; end if;
    perform public._cupo_bloquear(v_l.negocio_id);
    v_hasta := public.adicional_fin_periodo(now(), v_dias);
    update public.adicional_lote set inicio_periodo_at = now(), vigente_hasta = v_hasta, gracia_fin = null, ultimo_aviso_dias = null,
           manual_tipo = 'AJUSTE', manual_motivo = left(p_motivo, 500), manual_por = auth.uid() where id = p_lote_id;
    perform public._adicional_transicionar(p_lote_id, 'ACTIVO', 'REACTIVADO_POR_SUPERADMIN', 'SUPERSU', auth.uid(), p_motivo,
                                           null, jsonb_build_object('dias', v_dias, 'vigente_hasta', v_hasta));
    perform public._adicional_notificar(p_lote_id, 'ADICIONAL_REACTIVADO', 'admin-react:' || extract(epoch from now())::bigint);
  elsif p_accion = 'CANCELAR' then
    perform public._adicional_transicionar(p_lote_id, 'CANCELADO', 'CANCELADO_POR_SUPERADMIN', 'SUPERSU', auth.uid(), p_motivo);
  elsif p_accion = 'AJUSTAR' then
    v_cant := (p_datos ->> 'cantidad')::int;
    if v_cant is null or v_cant < 1 then raise exception 'CANTIDAD_INVALIDA'; end if;
    if v_l.estado in ('CANCELADO', 'EXPIRADO_SIN_PAGO', 'REEMBOLSADO') then raise exception 'LOTE_NO_AJUSTABLE'; end if;
    perform public._cupo_bloquear(v_l.negocio_id);
    select coalesce(sum(x.cantidad), 0) into v_otros from public.adicional_lote x
     where x.negocio_id = v_l.negocio_id and x.id <> p_lote_id and x.estado in ('ACTIVO', 'PROXIMO_A_RENOVAR', 'EN_GRACIA', 'SUSPENDIDO', 'CHECKOUT_INICIADO', 'PAGO_PENDIENTE');
    if v_otros + v_cant > c.max_por_negocio then raise exception 'MAXIMO_POR_NEGOCIO_EXCEDIDO'; end if;
    perform set_config('app.adicional_ajuste', 'on', true);
    update public.adicional_lote set cantidad = v_cant, total = round(v_cant * precio_unitario, 2) where id = p_lote_id;
    perform set_config('app.adicional_ajuste', 'off', true);
    perform public._adicional_historial(p_lote_id, 'AJUSTE_CANTIDAD', 'SUPERSU', auth.uid(), p_motivo, null, null,
      jsonb_build_object('nota', 'Ajuste administrativo: no genera cobro ni reembolso'), v_l.estado, v_l.estado, v_l.cantidad, v_cant);
    perform public._auditar('adicional_lote', p_lote_id, 'ADICIONAL_AJUSTE_CANTIDAD', v_l.negocio_id,
                            jsonb_build_object('cantidad', v_l.cantidad), jsonb_build_object('cantidad', v_cant), p_motivo);
  else
    raise exception 'ACCION_INVALIDA';
  end if;
  select * into v_l from public.adicional_lote where id = p_lote_id;
  return jsonb_build_object('lote_id', p_lote_id, 'estado', v_l.estado, 'cantidad', v_l.cantidad, 'vigente_hasta', v_l.vigente_hasta);
end $$;
revoke all on function public.admin_adicional_accion(uuid, text, text, jsonb) from public, anon, authenticated;
grant execute on function public.admin_adicional_accion(uuid, text, text, jsonb) to authenticated;

-- ── Activación manual de cupo (excepción con motivo, responsable, vigencia obligatoria e historial) ────
create or replace function public.admin_adicional_activar_manual(p_negocio_id uuid, p_cantidad int, p_dias int, p_tipo text, p_motivo text, p_referencia text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  c public.adicional_config; v_neg public.negocio; v_pais char(2); v_contratados int; v_lote public.adicional_lote; v_hasta timestamptz;
begin
  perform public._adicional_exige_supersu(p_motivo);
  select * into c from public.adicional_config where id;
  select * into v_neg from public.negocio where id = p_negocio_id;
  if not found then raise exception 'NEGOCIO_NO_ENCONTRADO'; end if;
  if v_neg.estado <> 'ACTIVO' then raise exception 'NEGOCIO_NO_ACTIVO'; end if;
  if p_tipo is null or p_tipo not in ('CORTESIA', 'TRANSFERENCIA', 'CONTINGENCIA_PASARELA') then raise exception 'TIPO_INVALIDO'; end if;
  if p_tipo = 'TRANSFERENCIA' and length(btrim(coalesce(p_referencia, ''))) < 3 then raise exception 'REFERENCIA_REQUERIDA'; end if;
  if p_cantidad is null or p_cantidad < 1 or p_cantidad > c.max_por_lote then raise exception 'CANTIDAD_INVALIDA'; end if;
  if p_dias is null or p_dias < 1 or p_dias > c.activacion_manual_max_dias then raise exception 'VIGENCIA_INVALIDA'; end if;
  perform public._cupo_bloquear(p_negocio_id);
  select coalesce(sum(l.cantidad), 0)::int into v_contratados from public.adicional_lote l
   where l.negocio_id = p_negocio_id and l.estado in ('ACTIVO', 'PROXIMO_A_RENOVAR', 'EN_GRACIA', 'SUSPENDIDO', 'CHECKOUT_INICIADO', 'PAGO_PENDIENTE');
  if v_contratados + p_cantidad > c.max_por_negocio then raise exception 'MAXIMO_POR_NEGOCIO_EXCEDIDO'; end if;
  select coalesce(s.pais_codigo, 'CO') into v_pais from public.suscripcion s where s.negocio_id = p_negocio_id;
  v_hasta := public.adicional_fin_periodo(now(), p_dias);
  insert into public.adicional_lote (negocio_id, pais_codigo, plan_codigo, cantidad, precio_unitario, total, moneda, estado, origen,
                                     inicio_periodo_at, vigente_hasta, manual_tipo, manual_motivo, manual_por, manual_referencia, creado_por)
  values (p_negocio_id, coalesce(v_pais, 'CO'), v_neg.plan_codigo, p_cantidad, 0, 0, 'COP', 'ACTIVO', 'MANUAL_SUPERADMIN',
          now(), v_hasta, p_tipo, left(p_motivo, 500), auth.uid(), left(p_referencia, 200), auth.uid())
  returning * into v_lote;
  perform public._adicional_historial(v_lote.id, 'ACTIVACION_MANUAL', 'SUPERSU', auth.uid(), p_motivo, null, null,
    jsonb_build_object('tipo', p_tipo, 'dias', p_dias, 'vigente_hasta', v_hasta, 'referencia', p_referencia), null, 'ACTIVO', null, p_cantidad);
  perform public._auditar('adicional_lote', v_lote.id, 'ADICIONAL_ACTIVACION_MANUAL', p_negocio_id, null,
    jsonb_build_object('cantidad', p_cantidad, 'tipo', p_tipo, 'vigente_hasta', v_hasta, 'responsable', auth.uid()), p_motivo);
  perform public._adicional_notificar(v_lote.id, 'ADICIONAL_ACTIVADO', 'manual');
  return jsonb_build_object('lote_id', v_lote.id, 'vigente_hasta', v_hasta);
end $$;
revoke all on function public.admin_adicional_activar_manual(uuid, int, int, text, text, text) from public, anon, authenticated;
grant execute on function public.admin_adicional_activar_manual(uuid, int, int, text, text, text) to authenticated;

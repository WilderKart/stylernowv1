-- 172: Barberos adicionales (FASE 2A) — motor de estados y suma de adicionales en la capacidad central.
--
-- 1) _adicional_transicionar: ÚNICO camino para cambiar `estado` de un lote. Valida la tabla adicional_transicion (quién puede
--    pasar de qué a qué), toma _cupo_bloquear(negocio) ANTES que el lock del lote (mismo orden que las altas de staff: sin
--    interbloqueos) y deja historial + auditoría.
-- 2) _adicionales_activos / _adicionales_resumen: cupo vigente de un negocio. Aportan cupo: ACTIVO, PROXIMO_A_RENOVAR, EN_GRACIA (con
--    gracia vigente) y CANCELADO mientras quede periodo pagado. SUSPENDIDO, EXPIRADO_SIN_PAGO y REEMBOLSADO aportan 0.
-- 3) _capacidad_profesional (152) SIN cambiar su firma: limite = tope del plan + adicionales activos. `p_adicionales` queda como
--    mínimo/simulación (greatest), de modo que los cuatro llamadores que pasan 0 reciben los adicionales reales sin tocarlos.
--    Nunca se retira a nadie por exceso: solo se bloquean nuevas altas/invitaciones (disponibles = 0). Los suspendidos siguen ocupando.
-- Rollback: 172_adicionales_motor_estados_y_capacidad_REVERSION.sql.txt.

create or replace function public._adicional_historial(
  p_lote uuid, p_evento text, p_actor_tipo text, p_actor uuid, p_motivo text, p_pago uuid default null, p_mp_ref text default null,
  p_datos jsonb default '{}'::jsonb, p_estado_antes text default null, p_estado_despues text default null,
  p_cant_antes int default null, p_cant_despues int default null)
returns boolean language plpgsql security definer set search_path = public as $$
declare v_neg uuid; v_id uuid;
begin
  select negocio_id into v_neg from public.adicional_lote where id = p_lote;
  insert into public.adicional_historial (lote_id, negocio_id, evento, estado_antes, estado_despues, cantidad_antes, cantidad_despues,
                                          actor_tipo, actor_id, motivo, pago_id, mp_ref, datos)
  values (p_lote, v_neg, p_evento, p_estado_antes, p_estado_despues, p_cant_antes, p_cant_despues, p_actor_tipo,
          case when p_actor is not null and exists (select 1 from auth.users u where u.id = p_actor) then p_actor end,
          nullif(btrim(left(p_motivo, 500)), ''), p_pago, p_mp_ref, coalesce(p_datos, '{}'::jsonb))
  on conflict (lote_id, evento, mp_ref) where mp_ref is not null do nothing
  returning id into v_id;
  return v_id is not null;
end $$;
revoke all on function public._adicional_historial(uuid, text, text, uuid, text, uuid, text, jsonb, text, text, int, int) from public, anon, authenticated;

create or replace function public._adicional_transicionar(
  p_lote uuid, p_a text, p_evento text, p_actor_tipo text, p_actor uuid default null, p_motivo text default null,
  p_pago uuid default null, p_datos jsonb default '{}'::jsonb)
returns boolean language plpgsql security definer set search_path = public as $$
declare v_neg uuid; v_l public.adicional_lote; v_ok boolean;
begin
  select negocio_id into v_neg from public.adicional_lote where id = p_lote;
  if v_neg is null then raise exception 'ADICIONAL_LOTE_NO_ENCONTRADO'; end if;
  perform public._cupo_bloquear(v_neg);                      -- primero el cupo del negocio, luego el lote
  select * into v_l from public.adicional_lote where id = p_lote for update;
  if v_l.estado = p_a then return false; end if;             -- idempotente: ya está ahí
  select exists (select 1 from public.adicional_transicion t
                  where t.desde = v_l.estado and t.hacia = p_a and p_actor_tipo = any (t.actores)) into v_ok;
  if not coalesce(v_ok, false) then
    raise exception 'ADICIONAL_TRANSICION_NO_PERMITIDA: % -> % (%)', v_l.estado, p_a, p_actor_tipo;
  end if;
  perform set_config('app.adicional_transicion', 'on', true);
  update public.adicional_lote set
    estado = p_a,
    suspendido_at = case when p_a = 'SUSPENDIDO' then now() when p_a = 'ACTIVO' then null else suspendido_at end,
    gracia_fin = case when p_a in ('ACTIVO', 'SUSPENDIDO', 'PROXIMO_A_RENOVAR') then null else gracia_fin end,
    cancelado_at = case when p_a = 'CANCELADO' then now() else cancelado_at end,
    cancelar_renovacion = case when p_a = 'CANCELADO' then true else cancelar_renovacion end
  where id = p_lote;
  perform set_config('app.adicional_transicion', 'off', true);
  perform public._adicional_historial(p_lote, p_evento, p_actor_tipo, p_actor, p_motivo, p_pago, null, p_datos,
                                      v_l.estado, p_a, v_l.cantidad, v_l.cantidad);
  perform public._auditar('adicional_lote', p_lote, 'ADICIONAL_' || p_evento, v_neg,
                          jsonb_build_object('estado', v_l.estado, 'cantidad', v_l.cantidad),
                          jsonb_build_object('estado', p_a, 'actor_tipo', p_actor_tipo, 'pago_id', p_pago) || coalesce(p_datos, '{}'::jsonb),
                          p_motivo);
  return true;
end $$;
revoke all on function public._adicional_transicionar(uuid, text, text, text, uuid, text, uuid, jsonb) from public, anon, authenticated;

-- ── Cupo vigente ───────────────────────────────────────────────────────────────────────────────
create or replace function public._adicionales_activos(p_negocio_id uuid)
returns int language sql stable security definer set search_path = public as $$
  select coalesce(sum(l.cantidad), 0)::int from public.adicional_lote l
   where l.negocio_id = p_negocio_id
     and (l.estado in ('ACTIVO', 'PROXIMO_A_RENOVAR')
          or (l.estado = 'EN_GRACIA' and l.gracia_fin > now())
          or (l.estado = 'CANCELADO' and l.vigente_hasta > now()));
$$;
revoke all on function public._adicionales_activos(uuid) from public, anon, authenticated;

create or replace function public._adicionales_resumen(p_negocio_id uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'activos', coalesce(sum(l.cantidad) filter (where l.estado in ('ACTIVO', 'PROXIMO_A_RENOVAR')
                          or (l.estado = 'CANCELADO' and l.vigente_hasta > now())), 0)::int,
    'en_gracia', coalesce(sum(l.cantidad) filter (where l.estado = 'EN_GRACIA' and l.gracia_fin > now()), 0)::int,
    'suspendidos', coalesce(sum(l.cantidad) filter (where l.estado = 'SUSPENDIDO'), 0)::int,
    'en_proceso', coalesce(sum(l.cantidad) filter (where l.estado in ('PENDIENTE_CONTRATACION', 'CHECKOUT_INICIADO', 'PAGO_PENDIENTE', 'PAGO_CONFIRMADO')), 0)::int,
    'vence_at', min(l.vigente_hasta) filter (where l.estado in ('ACTIVO', 'PROXIMO_A_RENOVAR', 'EN_GRACIA')))
  from public.adicional_lote l where l.negocio_id = p_negocio_id;
$$;
revoke all on function public._adicionales_resumen(uuid) from public, anon, authenticated;

-- ── _capacidad_profesional: suma los adicionales activos (misma firma) ────────────────────────────
do $$
declare v_def text; v_ancla text; v_nuevo text;
  v_a_decl constant text := E'  v_act int; v_susp int; v_pend int; v_inv int; v_ocup int; v_limite int;\nbegin';
  v_a_lim constant text := E'  v_limite := case when v_plan.staff_tope_absoluto is null then null\n                   else v_plan.staff_tope_absoluto + greatest(coalesce(p_adicionales, 0), 0) end;';
  v_a_ret constant text := E'    ''adicionales_contratados'', greatest(coalesce(p_adicionales, 0), 0),';
begin
  v_def := pg_get_functiondef('public._capacidad_profesional(uuid,text,integer,text)'::regprocedure);
  if position('_adicionales_resumen' in v_def) > 0 then return; end if;  -- ya migrada
  foreach v_ancla in array array[v_a_decl, v_a_lim, v_a_ret] loop
    if position(v_ancla in v_def) = 0 then raise exception 'ANCLA_NO_ENCONTRADA _capacidad_profesional: %', left(v_ancla, 60); end if;
  end loop;
  v_nuevo := v_def;
  v_nuevo := replace(v_nuevo, v_a_decl, E'  v_act int; v_susp int; v_pend int; v_inv int; v_ocup int; v_limite int;\n  v_adic int; v_res jsonb;\nbegin');
  v_nuevo := replace(v_nuevo, v_a_lim,
    E'  -- Adicionales vigentes del negocio (lotes pagados). p_adicionales solo puede SUBIR el tope (simulación), nunca bajarlo.\n'
    || E'  v_res := public._adicionales_resumen(p_negocio_id);\n'
    || E'  v_adic := greatest(coalesce(p_adicionales, 0), (v_res ->> ''activos'')::int + (v_res ->> ''en_gracia'')::int, 0);\n'
    || E'  v_limite := case when v_plan.staff_tope_absoluto is null then null\n                   else v_plan.staff_tope_absoluto + v_adic end;');
  v_nuevo := replace(v_nuevo, v_a_ret,
    E'    ''adicionales_contratados'', v_adic,\n'
    || E'    ''tope_plan'', v_plan.staff_tope_absoluto,\n'
    || E'    ''adicionales_activos'', (v_res ->> ''activos'')::int,\n'
    || E'    ''adicionales_en_gracia'', (v_res ->> ''en_gracia'')::int,\n'
    || E'    ''adicionales_suspendidos'', (v_res ->> ''suspendidos'')::int,\n'
    || E'    ''adicionales_en_proceso'', (v_res ->> ''en_proceso'')::int,\n'
    || E'    ''adicionales_vencen_at'', v_res -> ''vence_at'',\n'
    || E'    ''a_regularizar'', case when v_limite is null then 0 else greatest(v_ocup - v_limite, 0) end,');
  execute v_nuevo;
end $$;
revoke all on function public._capacidad_profesional(uuid, text, int, text) from public, anon, authenticated;

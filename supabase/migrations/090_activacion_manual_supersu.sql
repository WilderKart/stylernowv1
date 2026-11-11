-- 090 — Activación manual de planes por SuperSU (plan de contingencia).
-- Casos: la pasarela falla, pago por transferencia directa (Nequi/bancos) o cortesía a clientes piloto.
-- SuperSU pasa un negocio a TRIAL / ACTIVA / REQUIERE_PLAN con motivo obligatorio y auditoría.
-- Una activación manual con fecha de vencimiento vuelve sola a REQUIERE_PLAN (no se vuelve gratis
-- permanente); sin fecha queda vigente hasta que SuperSU la revierta. El cron NO intenta cobrarla.

alter table public.suscripcion
  add column activacion_manual boolean not null default false,
  add column manual_tipo text check (manual_tipo in ('TRANSFERENCIA','CORTESIA','CONTINGENCIA_PASARELA')),
  add column manual_hasta timestamptz,
  add column manual_referencia text;

create function public.admin_activar_negocio_manual(
  p_negocio_id uuid,
  p_estado text,                       -- 'TRIAL' | 'ACTIVA' | 'REQUIERE_PLAN'
  p_plan public.plan_codigo,
  p_tipo text,                         -- 'TRANSFERENCIA' | 'CORTESIA' | 'CONTINGENCIA_PASARELA'
  p_motivo text,
  p_dias integer default null,         -- vigencia; null = sin vencimiento (solo ACTIVA)
  p_referencia text default null       -- ej. comprobante de transferencia
) returns public.suscripcion language plpgsql security definer set search_path = public as $$
declare
  v_neg public.negocio; v_antes public.suscripcion; v_s public.suscripcion; v_hasta timestamptz; v_prox timestamptz;
begin
  if not public.is_supersu() then raise exception 'NO_AUTORIZADO'; end if;
  if p_estado not in ('TRIAL','ACTIVA','REQUIERE_PLAN') then raise exception 'ESTADO_INVALIDO'; end if;
  if p_estado <> 'REQUIERE_PLAN' and p_tipo not in ('TRANSFERENCIA','CORTESIA','CONTINGENCIA_PASARELA') then raise exception 'TIPO_INVALIDO'; end if;
  if char_length(trim(coalesce(p_motivo, ''))) < 5 then raise exception 'MOTIVO_REQUERIDO'; end if;
  if p_estado = 'TRIAL' and coalesce(p_dias, 0) < 1 then raise exception 'DIAS_REQUERIDOS_EN_TRIAL'; end if;
  if p_dias is not null and (p_dias < 1 or p_dias > 730) then raise exception 'DIAS_INVALIDOS'; end if;
  if p_tipo = 'TRANSFERENCIA' and p_estado = 'ACTIVA' and coalesce(trim(p_referencia), '') = '' then
    raise exception 'REFERENCIA_REQUERIDA_EN_TRANSFERENCIA';
  end if;

  select * into v_neg from public.negocio where id = p_negocio_id;
  if not found then raise exception 'NEGOCIO_NO_ENCONTRADO'; end if;
  select * into v_antes from public.suscripcion where negocio_id = p_negocio_id;

  v_hasta := case when p_dias is null then null else now() + make_interval(days => p_dias) end;
  -- fecha_proximo_cobro es NOT NULL: sin vencimiento usamos una fecha lejana que ningún proceso cobra.
  v_prox := coalesce(v_hasta, now() + interval '1 year');

  insert into public.suscripcion (negocio_id, plan_codigo, estado, fecha_inicio_ciclo, fecha_proximo_cobro, pais_codigo,
                                  prueba_inicio, prueba_fin, activacion_manual, manual_tipo, manual_hasta, manual_referencia,
                                  gracia_fin, reintentos_fallo_count, suspendido_causa)
  values (p_negocio_id, p_plan, p_estado::public.suscripcion_estado, now(), v_prox, v_neg.pais_codigo,
          case when p_estado = 'TRIAL' then now() end, case when p_estado = 'TRIAL' then v_hasta end,
          p_estado <> 'REQUIERE_PLAN', case when p_estado = 'REQUIERE_PLAN' then null else p_tipo end,
          case when p_estado = 'REQUIERE_PLAN' then null else v_hasta end,
          case when p_estado = 'REQUIERE_PLAN' then null else p_referencia end, null, 0, null)
  on conflict (negocio_id) do update set
    plan_codigo = excluded.plan_codigo, estado = excluded.estado, fecha_inicio_ciclo = excluded.fecha_inicio_ciclo,
    fecha_proximo_cobro = excluded.fecha_proximo_cobro, prueba_inicio = excluded.prueba_inicio, prueba_fin = excluded.prueba_fin,
    activacion_manual = excluded.activacion_manual, manual_tipo = excluded.manual_tipo, manual_hasta = excluded.manual_hasta,
    manual_referencia = excluded.manual_referencia, gracia_fin = null, reintentos_fallo_count = 0, suspendido_causa = null,
    aviso_3d_at = null, aviso_1d_at = null
  returning * into v_s;

  update public.negocio set plan_codigo = p_plan where id = p_negocio_id;

  insert into public.evento_auditoria (entidad_tipo, entidad_id, accion, actor_tipo, actor_id, negocio_id, payload_antes, payload_despues, motivo)
  values ('suscripcion', v_s.id, 'ACTIVACION_MANUAL_' || p_estado, 'SUPERSU', auth.uid(), p_negocio_id,
          case when v_antes.id is null then null else jsonb_build_object('estado', v_antes.estado, 'plan', v_antes.plan_codigo, 'manual', v_antes.activacion_manual) end,
          jsonb_build_object('estado', v_s.estado, 'plan', v_s.plan_codigo, 'tipo', p_tipo, 'hasta', v_hasta, 'referencia', p_referencia),
          p_motivo);
  return v_s;
end $$;

revoke all on function public.admin_activar_negocio_manual(uuid, text, plan_codigo, text, text, integer, text) from public, anon, authenticated;
grant execute on function public.admin_activar_negocio_manual(uuid, text, plan_codigo, text, text, integer, text) to authenticated;

-- El cron no cobra ni avisa activaciones manuales.
create or replace function public.pruebas_por_cobrar()
returns table (negocio_id uuid, plan_codigo public.plan_codigo, ciclo text, pais_codigo char(2), metodo_pago_ref text, metodo_pago_proveedor text)
language sql stable security definer set search_path = public as $$
  select s.negocio_id, s.plan_codigo, s.ciclo, s.pais_codigo, s.metodo_pago_ref, s.metodo_pago_proveedor
  from public.suscripcion s where s.estado = 'TRIAL' and s.prueba_fin <= now() and not s.activacion_manual;
$$;

create or replace function public.avisos_prueba_pendientes()
returns table (negocio_id uuid, owner_user_id uuid, tipo text, fecha_cobro timestamptz)
language sql stable security definer set search_path = public as $$
  select s.negocio_id, n.owner_user_id, '3D'::text, s.prueba_fin from public.suscripcion s join public.negocio n on n.id = s.negocio_id
   where s.estado = 'TRIAL' and not s.activacion_manual and s.aviso_3d_at is null and s.prueba_fin - interval '3 days' <= now() and s.prueba_fin > now()
  union all
  select s.negocio_id, n.owner_user_id, '1D'::text, s.prueba_fin from public.suscripcion s join public.negocio n on n.id = s.negocio_id
   where s.estado = 'TRIAL' and not s.activacion_manual and s.aviso_1d_at is null and s.prueba_fin - interval '1 day' <= now() and s.prueba_fin > now();
$$;

-- Mantenimiento: además de mora y fundadores, vence las activaciones manuales con fecha.
create or replace function public.mantenimiento_suscripciones() returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_susp integer; v_fund integer; v_manual integer;
begin
  update public.suscripcion set estado = 'SUSPENDIDA', suspendido_causa = 'IMPAGO'
   where estado = 'EN_MORA' and gracia_fin is not null and gracia_fin < now();
  get diagnostics v_susp = row_count;
  update public.suscripcion_fundador set estado = 'FINALIZADO' where estado = 'ACTIVO' and fecha_fin <= now();
  get diagnostics v_fund = row_count;
  update public.suscripcion set estado = 'REQUIERE_PLAN', activacion_manual = false, prueba_inicio = null, prueba_fin = null
   where activacion_manual and manual_hasta is not null and manual_hasta <= now() and estado in ('TRIAL','ACTIVA');
  get diagnostics v_manual = row_count;
  return jsonb_build_object('suspendidas', v_susp, 'fundadores_finalizados', v_fund, 'manuales_vencidas', v_manual);
end $$;

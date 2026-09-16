-- StylerNow — Migración 047: crear_campana_publicitaria() — p_fecha_fin
-- debe ser opcional (una campaña puede correr sin fecha de fin definida).
create or replace function public.crear_campana_publicitaria(
  p_negocio_id uuid,
  p_formato text,
  p_unidad_cobro text,
  p_presupuesto_diario numeric,
  p_presupuesto_total numeric,
  p_fecha_fin timestamptz default null,
  p_segmentacion jsonb default '{}'::jsonb
)
returns public.campana_publicitaria
language plpgsql security definer set search_path = public as $fn$
declare
  v_negocio public.negocio;
  v_campana public.campana_publicitaria;
begin
  if not public.is_barberia_de(p_negocio_id) then raise exception 'NO_AUTORIZADO'; end if;
  if p_formato not in ('DESTACADO', 'PIN') then raise exception 'FORMATO_NO_DISPONIBLE'; end if;
  if p_unidad_cobro not in ('CPC', 'CPM') then raise exception 'UNIDAD_COBRO_INVALIDA'; end if;
  if p_formato = 'DESTACADO' and p_unidad_cobro <> 'CPC' then raise exception 'DESTACADO_SOLO_CPC'; end if;
  if p_presupuesto_diario is null or p_presupuesto_diario <= 0 then raise exception 'PRESUPUESTO_DIARIO_INVALIDO'; end if;
  if p_presupuesto_total is null or p_presupuesto_total < p_presupuesto_diario then
    raise exception 'PRESUPUESTO_TOTAL_INVALIDO';
  end if;

  select * into v_negocio from public.negocio where id = p_negocio_id;
  if v_negocio.plan_codigo = 'RAVEN' then raise exception 'PLAN_INSUFICIENTE'; end if;

  insert into public.campana_publicitaria
    (negocio_id, formato, unidad_cobro, presupuesto_diario, presupuesto_total, fecha_fin, segmentacion, estado)
  values
    (p_negocio_id, p_formato, p_unidad_cobro, p_presupuesto_diario, p_presupuesto_total, p_fecha_fin, coalesce(p_segmentacion, '{}'::jsonb), 'BORRADOR')
  returning * into v_campana;

  insert into public.evento_auditoria (entidad_tipo, entidad_id, accion, actor_tipo, actor_id, negocio_id)
  values ('campana_publicitaria', v_campana.id, 'CAMPANA_CREADA', 'BARBERIA', auth.uid(), p_negocio_id);

  return v_campana;
end;
$fn$;

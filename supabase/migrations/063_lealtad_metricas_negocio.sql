-- StylerNow — Migración 063: Lealtad transversal — KPIs de Lealtad
-- para el Dashboard del propio Negocio (a diferencia de
-- metricas_lealtad_plataforma(), que es agregada y exclusiva SuperSU).

create or replace function public.metricas_lealtad_negocio(p_negocio_id uuid)
returns jsonb
language plpgsql stable security definer set search_path = public as $fn$
declare
  v_resultado jsonb;
begin
  if not public.tiene_acceso_interno(p_negocio_id) then raise exception 'NO_AUTORIZADO'; end if;

  select jsonb_build_object(
    'membresiasActivas', (select count(*) from public.cliente_membresia where negocio_id = p_negocio_id and estado = 'ACTIVA'),
    'giftCardsActivas', (select count(*) from public.gift_card where negocio_id = p_negocio_id and estado = 'ACTIVA'),
    'sellosCampanasActivas', (select count(*) from public.sello_campana where negocio_id = p_negocio_id and estado = 'ACTIVA'),
    'cashbackOtorgadoMes', (
      select coalesce(sum(cm.monto), 0) from public.cashback_movimiento cm
      join public.cashback_regla cr on cr.id = cm.regla_id
      where cr.negocio_id = p_negocio_id and cm.created_at >= date_trunc('month', now())
    ),
    'miembrosVip', (select count(*) from public.vip_miembro where negocio_id = p_negocio_id),
    'referidosCompletadosMes', (
      select count(*) from public.referido
      where negocio_id = p_negocio_id and estado = 'COMPLETADO' and completado_at >= date_trunc('month', now())
    )
  ) into v_resultado;

  return v_resultado;
end;
$fn$;
grant execute on function public.metricas_lealtad_negocio(uuid) to authenticated;

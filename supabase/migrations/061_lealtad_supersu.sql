-- StylerNow — Migración 061: Dominio LEALTAD (ADR-011) — SuperSU CMS:
-- revisión de fraude y métricas agregadas de plataforma.

create or replace function public.listar_eventos_fraude(p_revisado boolean default false)
returns setof public.lealtad_fraude_evento
language plpgsql stable security definer set search_path = public as $fn$
begin
  if not public.is_supersu() then raise exception 'NO_AUTORIZADO'; end if;
  return query select * from public.lealtad_fraude_evento where revisado = p_revisado order by created_at desc limit 200;
end;
$fn$;
grant execute on function public.listar_eventos_fraude(boolean) to authenticated;

create or replace function public.marcar_fraude_revisado(p_evento_id uuid)
returns public.lealtad_fraude_evento
language plpgsql security definer set search_path = public as $fn$
declare
  v_evento public.lealtad_fraude_evento;
begin
  if not public.is_supersu() then raise exception 'NO_AUTORIZADO'; end if;
  update public.lealtad_fraude_evento set revisado = true where id = p_evento_id returning * into v_evento;
  if not found then raise exception 'EVENTO_NO_ENCONTRADO'; end if;
  return v_evento;
end;
$fn$;
grant execute on function public.marcar_fraude_revisado(uuid) to authenticated;

create or replace function public.metricas_lealtad_plataforma()
returns jsonb
language plpgsql stable security definer set search_path = public as $fn$
declare
  v_resultado jsonb;
begin
  if not public.is_supersu() then raise exception 'NO_AUTORIZADO'; end if;

  select jsonb_build_object(
    'saldoTotalWallets', (select coalesce(sum(saldo_disponible), 0) from public.lealtad_wallet),
    'membresiasActivas', (select count(*) from public.cliente_membresia where estado = 'ACTIVA'),
    'giftCardsActivas', (select count(*) from public.gift_card where estado = 'ACTIVA'),
    'giftCardsSaldoTotal', (select coalesce(sum(saldo_actual), 0) from public.gift_card where estado = 'ACTIVA'),
    'referidosCompletados', (select count(*) from public.referido where estado = 'COMPLETADO'),
    'sellosCampanasActivas', (select count(*) from public.sello_campana where estado = 'ACTIVA'),
    'cashbackOtorgadoTotal', (select coalesce(sum(monto), 0) from public.cashback_movimiento),
    'vipMiembrosTotal', (select count(*) from public.vip_miembro),
    'familiasTotal', (select count(*) from public.familia_grupo),
    'cuentasCorporativasActivas', (select count(*) from public.corporativo_cuenta where activo = true),
    'eventosFraudeSinRevisar', (select count(*) from public.lealtad_fraude_evento where revisado = false)
  ) into v_resultado;

  return v_resultado;
end;
$fn$;
grant execute on function public.metricas_lealtad_plataforma() to authenticated;

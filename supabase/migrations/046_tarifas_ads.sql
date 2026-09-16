-- StylerNow — Migración 046: SuperSU edita las tarifas de referencia de
-- Marketplace Ads (06_Advertising_System.md, Permisos: "SuperSU define
-- tarifas de referencia (CPC/CPM base)").
create or replace function public.actualizar_tarifas_ads(p_cpc_destacado numeric, p_cpc_pin numeric, p_cpm_pin numeric)
returns public.configuracion_plataforma
language plpgsql security definer set search_path = public as $fn$
declare
  v_config public.configuracion_plataforma;
begin
  if not public.is_supersu() then raise exception 'NO_AUTORIZADO'; end if;
  if p_cpc_destacado <= 0 or p_cpc_pin <= 0 or p_cpm_pin <= 0 then raise exception 'TARIFA_INVALIDA'; end if;

  update public.configuracion_plataforma
  set cpc_destacado_cop = p_cpc_destacado, cpc_pin_cop = p_cpc_pin, cpm_pin_cop = p_cpm_pin, updated_at = now(), updated_by = auth.uid()
  where id = true
  returning * into v_config;

  insert into public.evento_auditoria (entidad_tipo, entidad_id, accion, actor_tipo, actor_id)
  values ('configuracion_plataforma', null, 'TARIFAS_ADS_ACTUALIZADAS', 'SUPERSU', auth.uid());

  return v_config;
end;
$fn$;
grant execute on function public.actualizar_tarifas_ads(numeric, numeric, numeric) to authenticated;

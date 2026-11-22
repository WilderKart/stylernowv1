-- 168 · FASE 2B · Configuración SuperAdmin del ciclo de suscripción y lectura del estado operativo por negocio (depende de 160).
--   · config_suscripcion()                    → lectura (solo SuperSU) de periodo, gracias y si la gracia opera.
--   · admin_set_config_suscripcion(...)       → cambia periodo (días), gracia de la prueba y si la gracia opera; motivo obligatorio y auditoría.
--     (La gracia del periodo pagado y los días de prueba siguen en admin_set_config_prueba, ya existente, sin cambios de firma.)
--   · admin_estado_operativo_negocios(ids)    → estado operativo de varios negocios para la ficha/lista de /admin/negocios (solo SuperSU).
-- Reversión: 164_..._REVERSION.sql.txt.

begin;
set local lock_timeout = '5s';

create or replace function public.config_suscripcion()
 returns jsonb language plpgsql stable security definer set search_path to 'public'
as $function$
begin
  if not coalesce(public.is_supersu(), false) then raise exception 'NO_AUTORIZADO'; end if;
  return (select jsonb_build_object('periodo_dias', suscripcion_periodo_dias, 'gracia_dias', suscripcion_gracia_dias,
                                    'prueba_dias', prueba_dias, 'prueba_gracia_dias', prueba_gracia_dias,
                                    'gracia_permite_operar', gracia_permite_operar)
            from public.configuracion_plataforma where id);
end $function$;
revoke all on function public.config_suscripcion() from public, anon, authenticated;
grant execute on function public.config_suscripcion() to authenticated, service_role;

create or replace function public.admin_set_config_suscripcion(p_periodo_dias integer, p_prueba_gracia_dias integer, p_gracia_permite_operar boolean, p_motivo text)
 returns void language plpgsql security definer set search_path to 'public'
as $function$
declare v_antes jsonb;
begin
  if not coalesce(public.is_supersu(), false) then raise exception 'NO_AUTORIZADO'; end if;
  if char_length(btrim(coalesce(p_motivo, ''))) < 5 then raise exception 'MOTIVO_REQUERIDO'; end if;
  if p_periodo_dias is null or p_periodo_dias < 1 or p_periodo_dias > 366 then raise exception 'PERIODO_INVALIDO'; end if;
  if p_prueba_gracia_dias is null or p_prueba_gracia_dias < 0 or p_prueba_gracia_dias > 30 then raise exception 'GRACIA_PRUEBA_INVALIDA'; end if;
  if p_gracia_permite_operar is null then raise exception 'GRACIA_OPERA_REQUERIDO'; end if;

  select jsonb_build_object('periodo_dias', suscripcion_periodo_dias, 'prueba_gracia_dias', prueba_gracia_dias, 'gracia_permite_operar', gracia_permite_operar)
    into v_antes from public.configuracion_plataforma where id for update;
  update public.configuracion_plataforma
     set suscripcion_periodo_dias = p_periodo_dias, prueba_gracia_dias = p_prueba_gracia_dias,
         gracia_permite_operar = p_gracia_permite_operar, updated_at = now(), updated_by = auth.uid()
   where id;
  insert into public.evento_auditoria (entidad_tipo, accion, actor_tipo, actor_id, motivo, payload_antes, payload_despues)
  values ('configuracion_plataforma', 'CONFIG_SUSCRIPCION_ACTUALIZADA', 'SUPERSU', auth.uid(), p_motivo, v_antes,
          jsonb_build_object('periodo_dias', p_periodo_dias, 'prueba_gracia_dias', p_prueba_gracia_dias, 'gracia_permite_operar', p_gracia_permite_operar));
end $function$;
revoke all on function public.admin_set_config_suscripcion(integer, integer, boolean, text) from public, anon, authenticated;
grant execute on function public.admin_set_config_suscripcion(integer, integer, boolean, text) to authenticated, service_role;

create or replace function public.admin_estado_operativo_negocios(p_negocio_ids uuid[])
 returns table (negocio_id uuid, estado_operativo jsonb) language plpgsql stable security definer set search_path to 'public'
as $function$
begin
  if not coalesce(public.is_supersu(), false) then raise exception 'NO_AUTORIZADO'; end if;
  return query select n.id, public._estado_operativo_en(n.id, now()) from public.negocio n where n.id = any(p_negocio_ids);
end $function$;
revoke all on function public.admin_estado_operativo_negocios(uuid[]) from public, anon, authenticated;
grant execute on function public.admin_estado_operativo_negocios(uuid[]) to authenticated, service_role;

commit;

-- StylerNow — Migración 028: corrige actualizar_comision_plataforma_global()
--
-- Bug real encontrado por la prueba end-to-end: "UPDATE requires a WHERE
-- clause" — Supabase exige WHERE explícito en todo UPDATE/DELETE (incluso
-- dentro de una función SECURITY DEFINER), y `update public.negocio set
-- comision_plataforma_pct = p_pct;` no tenía ninguno porque la intención es
-- afectar a TODOS los negocios. Se agrega `where true`, sin cambiar el
-- comportamiento.

create or replace function public.actualizar_comision_plataforma_global(p_pct numeric)
returns public.configuracion_plataforma
language plpgsql security definer set search_path = public as $fn$
declare
  v_anterior numeric;
  v_config public.configuracion_plataforma;
begin
  if not public.is_supersu() then
    raise exception 'NO_AUTORIZADO';
  end if;
  if p_pct is null or p_pct < 3 or p_pct > 15 then
    raise exception 'COMISION_FUERA_DE_RANGO';
  end if;

  select comision_plataforma_pct_default into v_anterior from public.configuracion_plataforma where id = true;

  update public.configuracion_plataforma
  set comision_plataforma_pct_default = p_pct, updated_at = now(), updated_by = auth.uid()
  where id = true
  returning * into v_config;

  update public.negocio set comision_plataforma_pct = p_pct where true;

  insert into public.evento_auditoria (entidad_tipo, entidad_id, accion, actor_tipo, actor_id, payload_antes, payload_despues)
  values ('configuracion_plataforma', null, 'COMISION_PLATAFORMA_ACTUALIZADA', 'SUPERSU', auth.uid(),
    jsonb_build_object('comision_pct', v_anterior), jsonb_build_object('comision_pct', p_pct));

  return v_config;
end;
$fn$;

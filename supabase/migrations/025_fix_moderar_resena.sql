-- StylerNow — Migración 025: corrige moderar_resena() (migración 024)
--
-- Bug real encontrado por la prueba end-to-end (no a simple vista): el
-- CASE que decide el nuevo estado ("ELIMINADA"/"VISIBLE") producía texto
-- plano, y Postgres no lo castea automáticamente al enum `resena_estado`
-- en un UPDATE — "column "estado" is of type resena_estado but expression
-- is of type text". Se corrige casteando cada rama del CASE.

create or replace function public.moderar_resena(p_resena_id uuid, p_accion text, p_motivo text default null)
returns public.resena
language plpgsql security definer set search_path = public as $fn$
declare
  v_resena public.resena;
begin
  if not public.is_supersu() then
    raise exception 'NO_AUTORIZADO';
  end if;
  if p_accion not in ('MANTENER', 'ELIMINAR') then
    raise exception 'ACCION_INVALIDA';
  end if;

  select * into v_resena from public.resena where id = p_resena_id;
  if not found then
    raise exception 'RESENA_NO_ENCONTRADA';
  end if;
  if v_resena.estado <> 'REPORTADA' then
    raise exception 'RESENA_NO_EN_COLA';
  end if;

  update public.resena
  set estado = case when p_accion = 'ELIMINAR' then 'ELIMINADA'::resena_estado else 'VISIBLE'::resena_estado end,
      moderado_por = auth.uid(), moderado_motivo = p_motivo, updated_at = now()
  where id = p_resena_id
  returning * into v_resena;

  insert into public.evento_auditoria (entidad_tipo, entidad_id, accion, actor_tipo, actor_id, negocio_id, motivo)
  values ('resena', p_resena_id, 'RESENA_MODERADA_' || p_accion, 'SUPERSU', auth.uid(), v_resena.negocio_id, p_motivo);

  return v_resena;
end;
$fn$;

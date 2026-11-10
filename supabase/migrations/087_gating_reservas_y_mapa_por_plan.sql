-- 087 — El plan de suscripción gobierna reservas y visibilidad.
--   · REQUIERE_PLAN: el perfil se ve, pero NO recibe reservas.
--   · SUSPENDIDA / CANCELADA (o mora pasada la gracia de 3 días): se oculta del mapa.
-- Un negocio sin fila de suscripción (datos previos al modelo) sigue habilitado.
-- Se hace con un trigger en `reserva` (cubre crear_reserva y crear_reserva_manual sin reescribirlas)
-- y parchando los dos filtros de elegibilidad de marketplace_buscar.

create function public.trg_reserva_exige_plan() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not public.negocio_puede_recibir_reservas(new.negocio_id) then
    raise exception 'NEGOCIO_REQUIERE_PLAN';
  end if;
  return new;
end $$;

revoke all on function public.trg_reserva_exige_plan() from public, anon, authenticated;
grant execute on function public.trg_reserva_exige_plan() to service_role;

create trigger trg_reserva_exige_plan before insert on public.reserva
  for each row execute function public.trg_reserva_exige_plan();

do $$
declare
  v_sig regprocedure := 'public.marketplace_buscar(text,text,text,text,integer,integer,double precision,double precision)'::regprocedure;
  v_def text := pg_get_functiondef(v_sig);
  v_nuevo text;
begin
  if v_def like '%negocio_visible_en_mapa%' then return; end if; -- idempotente
  v_nuevo := replace(v_def, 'and n.elegibilidad_marketplace', 'and n.elegibilidad_marketplace and public.negocio_visible_en_mapa(n.id)');
  if v_nuevo = v_def then raise exception 'ANCLA_NO_ENCONTRADA en marketplace_buscar'; end if;
  execute v_nuevo;
end $$;

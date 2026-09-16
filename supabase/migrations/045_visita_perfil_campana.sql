-- StylerNow — Migración 045: registrar_visita_perfil() acepta la campaña
-- de origen (atribución de Reservas para Marketplace Ads, Módulo 6.2)
--
-- Agregar un parámetro a una función existente vía `create or replace`
-- crea una sobrecarga nueva en vez de reemplazarla (ADL-020/ADL-021) —
-- se corrige con `drop function` + `create function`, aunque el tipo de
-- retorno (`void`) no cambie: el problema es la lista de parámetros, no
-- el retorno.

drop function if exists public.registrar_visita_perfil(uuid);

create function public.registrar_visita_perfil(p_negocio_id uuid, p_campana_id uuid default null)
returns void
language plpgsql security definer set search_path = public as $fn$
begin
  insert into public.negocio_visita_perfil (negocio_id, cliente_id, campana_id)
  values (p_negocio_id, auth.uid(), p_campana_id);
end;
$fn$;
grant execute on function public.registrar_visita_perfil(uuid, uuid) to anon, authenticated;

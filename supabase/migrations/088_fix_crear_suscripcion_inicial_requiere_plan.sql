-- 088 — Corrige 086: fecha_proximo_cobro es NOT NULL, así que un plan pendiente (REQUIERE_PLAN)
-- usa now() como valor neutro (el cron solo procesa TRIAL y ACTIVA). Además cierra la ejecución
-- de crear_suscripcion_inicial a public/anon: solo usuarios autenticados (valida dueño por dentro).
-- Misma firma que antes: no crea sobrecarga.

create or replace function public.crear_suscripcion_inicial(p_negocio_id uuid, p_plan_codigo public.plan_codigo)
returns public.suscripcion language plpgsql security definer set search_path = public as $$
declare v_suscripcion public.suscripcion;
begin
  if p_plan_codigo = 'ALLFATHER' then raise exception 'ALLFATHER_REQUIERE_COTIZACION'; end if;
  if not exists (select 1 from public.negocio where id = p_negocio_id and owner_user_id = auth.uid()) then
    raise exception 'NO_AUTORIZADO';
  end if;
  insert into public.suscripcion (negocio_id, plan_codigo, estado, fecha_proximo_cobro, pais_codigo)
  select p_negocio_id, p_plan_codigo, 'REQUIERE_PLAN'::public.suscripcion_estado, now(), n.pais_codigo from public.negocio n where n.id = p_negocio_id
  on conflict (negocio_id) do update set plan_codigo = excluded.plan_codigo
  returning * into v_suscripcion;
  update public.negocio set plan_codigo = p_plan_codigo where id = p_negocio_id;
  return v_suscripcion;
end $$;

revoke all on function public.crear_suscripcion_inicial(uuid, plan_codigo) from public, anon, authenticated;
grant execute on function public.crear_suscripcion_inicial(uuid, plan_codigo) to authenticated, service_role;

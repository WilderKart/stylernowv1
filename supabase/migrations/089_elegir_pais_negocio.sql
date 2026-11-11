-- 089 — El dueño elige el país de su negocio mientras aún no tiene un plan en curso.
-- Define moneda, precios, cupos fundador y pasarela. Una vez en TRIAL/ACTIVA (o con otro estado
-- vigente) el país queda fijo: cambiarlo lo hace SuperSU.
create function public.elegir_pais_negocio(p_negocio_id uuid, p_pais char(2)) returns void
language plpgsql security definer set search_path = public as $$
declare v_estado public.suscripcion_estado;
begin
  if not public.is_barberia_de(p_negocio_id) then raise exception 'NO_AUTORIZADO'; end if;
  if not exists (select 1 from public.pais where codigo = p_pais and activo) then raise exception 'PAIS_NO_DISPONIBLE'; end if;
  select estado into v_estado from public.suscripcion where negocio_id = p_negocio_id;
  if found and v_estado <> 'REQUIERE_PLAN' then raise exception 'PAIS_FIJO_CON_PLAN_VIGENTE'; end if;
  update public.negocio set pais_codigo = p_pais where id = p_negocio_id;
  update public.suscripcion set pais_codigo = p_pais where negocio_id = p_negocio_id;
end $$;

revoke all on function public.elegir_pais_negocio(uuid, bpchar) from public, anon, authenticated;
grant execute on function public.elegir_pais_negocio(uuid, bpchar) to authenticated;

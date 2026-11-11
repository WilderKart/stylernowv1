-- CRITICO (QA panel): un dueño podia hacer UPDATE directo por REST a su negocio y cambiar plan_codigo
-- (upgrade gratis), comision_plataforma_pct, elegibilidad_marketplace, pais_codigo y owner_user_id.
-- Solo funciones del sistema (definer / service_role) y SuperSU pueden cambiarlas. Mismo patron que 101.
create or replace function public.trg_negocio_proteger_comercial()
returns trigger language plpgsql set search_path = public as $$
begin
  if current_user not in ('authenticated', 'anon') then return new; end if;
  if public.is_supersu() then return new; end if;
  if new.plan_codigo is distinct from old.plan_codigo
     or new.comision_plataforma_pct is distinct from old.comision_plataforma_pct
     or new.elegibilidad_marketplace is distinct from old.elegibilidad_marketplace
     or new.pais_codigo is distinct from old.pais_codigo
     or new.owner_user_id is distinct from old.owner_user_id then
    raise exception 'NEGOCIO_COLUMNA_PROTEGIDA';
  end if;
  return new;
end $$;
revoke all on function public.trg_negocio_proteger_comercial() from public, anon, authenticated;

drop trigger if exists trg_negocio_proteger_comercial on public.negocio;
create trigger trg_negocio_proteger_comercial before update on public.negocio
  for each row execute function public.trg_negocio_proteger_comercial();

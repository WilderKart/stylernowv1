-- 6.6 (H8): registrar_clic_patrocinado / registrar_impresion_patrocinada cobran dinero real de la billetera del
-- anunciante y eran ejecutables por anon con cualquier campana_id (incluso via ?campana_id= en la URL).
-- Ahora solo el servidor (service_role) puede ejecutarlas, a traves de registrar_evento_patrocinado, que:
--  * exige una huella de llamador (el servidor la calcula: usuario autenticado o IP+agente, con sal secreta),
--  * deduplica: 1 evento por huella, campana, tipo y dia (hora de Bogota),
--  * limita a 120 eventos por huella y dia entre todas las campanas.
-- PENDIENTE DE APLICAR por Wilder, junto con el despliegue del codigo (src/lib/ads/registrar-evento.ts).
create table if not exists public.anuncio_evento_dedupe (
  campana_id uuid not null references public.campana_publicitaria(id) on delete cascade,
  tipo text not null check (tipo in ('CLIC', 'IMPRESION')),
  huella text not null check (length(huella) between 16 and 128),
  dia date not null default ((now() at time zone 'America/Bogota')::date),
  created_at timestamptz not null default now(),
  primary key (campana_id, tipo, huella, dia)
);
alter table public.anuncio_evento_dedupe enable row level security;   -- sin politicas: nadie por API
revoke all on public.anuncio_evento_dedupe from public, anon, authenticated;
create index if not exists anuncio_evento_dedupe_huella_dia on public.anuncio_evento_dedupe (huella, dia);

create or replace function public.registrar_evento_patrocinado(p_tipo text, p_campana_id uuid, p_negocio_id uuid, p_huella text)
returns boolean language plpgsql security definer set search_path = public as $$
declare v_filas int;
begin
  if p_tipo not in ('CLIC', 'IMPRESION') or p_huella is null or length(p_huella) < 16 then return false; end if;
  if (select count(*) from public.anuncio_evento_dedupe
       where huella = p_huella and dia = (now() at time zone 'America/Bogota')::date) >= 120 then
    return false;
  end if;
  insert into public.anuncio_evento_dedupe (campana_id, tipo, huella) values (p_campana_id, p_tipo, p_huella)
  on conflict do nothing;
  get diagnostics v_filas = row_count;
  if v_filas = 0 then return false; end if;      -- repetido hoy: no se cobra
  if p_tipo = 'CLIC' then
    perform public.registrar_clic_patrocinado(p_campana_id, p_negocio_id);
  else
    perform public.registrar_impresion_patrocinada(p_campana_id);
  end if;
  return true;
end $$;
revoke all on function public.registrar_evento_patrocinado(text, uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.registrar_evento_patrocinado(text, uuid, uuid, text) to service_role;

revoke all on function public.registrar_clic_patrocinado(uuid, uuid) from public, anon, authenticated;
grant execute on function public.registrar_clic_patrocinado(uuid, uuid) to service_role;
revoke all on function public.registrar_impresion_patrocinada(uuid) from public, anon, authenticated;
grant execute on function public.registrar_impresion_patrocinada(uuid) to service_role;

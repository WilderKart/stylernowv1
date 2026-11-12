-- 6.7: limite de tasa por clave (IP, usuario o correo) en base de datos, para endpoints sin proteccion en el borde.
-- consumir_cupo cuenta eventos de una clave en una ventana y devuelve cuantos segundos esperar si se excedio (0 = permitido).
-- Solo service_role (la app la llama desde el servidor). Los registros viejos los limpia el cron diario.
-- PENDIENTE DE APLICAR por Wilder. Complemento recomendado: reglas de Firewall de Vercel para el buscador publico.
create table if not exists public.limite_tasa_evento (
  clave text not null,
  creado_at timestamptz not null default now()
);
create index if not exists limite_tasa_evento_clave_fecha on public.limite_tasa_evento (clave, creado_at desc);
alter table public.limite_tasa_evento enable row level security;     -- sin politicas: nadie por API
revoke all on public.limite_tasa_evento from public, anon, authenticated;

create or replace function public.consumir_cupo(p_clave text, p_limite integer, p_ventana_seg integer)
returns integer language plpgsql security definer set search_path = public as $$
declare v_usados int; v_mas_viejo timestamptz;
begin
  if p_clave is null or length(p_clave) > 200 or p_limite < 1 or p_ventana_seg < 1 then return 0; end if;
  select count(*), min(creado_at) into v_usados, v_mas_viejo from public.limite_tasa_evento
   where clave = p_clave and creado_at > now() - make_interval(secs => p_ventana_seg);
  if v_usados >= p_limite then
    return greatest(1, ceil(extract(epoch from (v_mas_viejo + make_interval(secs => p_ventana_seg) - now())))::int);
  end if;
  insert into public.limite_tasa_evento (clave) values (p_clave);
  return 0;
end $$;
revoke all on function public.consumir_cupo(text, integer, integer) from public, anon, authenticated;
grant execute on function public.consumir_cupo(text, integer, integer) to service_role;

create or replace function public.limpiar_limite_tasa()
returns integer language plpgsql security definer set search_path = public as $$
declare n int;
begin
  delete from public.limite_tasa_evento where creado_at < now() - interval '1 day';
  get diagnostics n = row_count;
  return n;
end $$;
revoke all on function public.limpiar_limite_tasa() from public, anon, authenticated;
grant execute on function public.limpiar_limite_tasa() to service_role;

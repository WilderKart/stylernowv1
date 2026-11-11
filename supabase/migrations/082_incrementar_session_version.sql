-- ADR-015, Fase 6 (Session Version) — incremento atómico, sin race condition
-- de leer-luego-escribir desde el cliente JS. Se llama tras cambio de
-- contraseña, recuperación, suspensión, traslado o revocación de permisos.
create or replace function public.incrementar_session_version(p_user_id uuid)
returns void
language sql
security definer set search_path = public
as $$
  update public.perfil set session_version = session_version + 1 where id = p_user_id;
$$;

revoke all on function public.incrementar_session_version(uuid) from public, anon, authenticated;

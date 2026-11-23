-- 181 — Fase 1 de hardening (SOC 2 CC6.1 / ISO 27001 A.9.4): Session Version en el JWT.
--
-- `perfil.session_version` (081) ya se incrementa en cambio de contraseña, recuperación,
-- suspensión, traslado y revocación de Guardian (082/083/162), pero hasta ahora no viajaba
-- en el token: una sesión ya emitida seguía siendo válida hasta su expiración natural (~1 h)
-- aunque se hubiera revocado. Esta migración agrega la función que el Custom Access Token
-- Hook de Supabase usa para inyectar `session_version` en los claims del JWT.
--
-- ─────────────────────────────────────────────────────────────────────────────
-- ACCIÓN MANUAL REQUERIDA (no la puede hacer una migración): habilitar el hook en
--   Supabase Dashboard → Authentication → Hooks → "Customize Access Token (JWT) Claims"
--   → seleccionar `public.custom_access_token_hook`. Es un toggle del Dashboard (disponible
--   en el plan Free); hasta que se active, la función existe pero el claim no viaja y el
--   control del middleware queda dormido (fail-safe: no bloquea nada).
-- ─────────────────────────────────────────────────────────────────────────────
--
-- Aditiva y reversible: `drop function public.custom_access_token_hook(jsonb)` y quitar el
-- hook del Dashboard. No cambia datos ni políticas.

create or replace function public.custom_access_token_hook(event jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $fn$
declare
  v_version integer;
  v_claims jsonb;
begin
  select session_version into v_version
    from public.perfil
   where id = (event ->> 'user_id')::uuid;

  v_claims := coalesce(event -> 'claims', '{}'::jsonb);
  v_claims := jsonb_set(v_claims, '{session_version}', to_jsonb(coalesce(v_version, 0)));
  event := jsonb_set(event, '{claims}', v_claims);
  return event;
end;
$fn$;

-- Solo el rol interno de Auth de Supabase puede ejecutar el hook.
grant usage on schema public to supabase_auth_admin;
revoke execute on function public.custom_access_token_hook(jsonb) from public, anon, authenticated;
grant execute on function public.custom_access_token_hook(jsonb) to supabase_auth_admin;

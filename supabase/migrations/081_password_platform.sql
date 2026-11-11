-- ADR-015, Fase C: Password Platform Enterprise.
-- Agrega el soporte de base de datos para: estado "contraseña creada" en la
-- máquina de estados de identidad, historial de contraseñas (solo hashes,
-- nunca texto plano), Session Version (preparación — el hook de Supabase que
-- lo embebe en el JWT se habilita aparte, en el Dashboard), y rate limiting
-- de intentos de auth (OTP/password/recovery) sin infraestructura externa.

alter table public.perfil
  add column password_establecida boolean not null default false,
  add column session_version integer not null default 1;

comment on column public.perfil.password_establecida is
  'Auth_State_Machine.md: true una vez que el usuario completó "Crear contraseña". No implica que YA use contraseña para entrar — solo que la tiene disponible además del OTP.';
comment on column public.perfil.session_version is
  'ADR-015 Fase 6 (Session Version): se incrementa en cambio de contraseña, suspensión, traslado o revocación de permisos. Un JWT emitido con un valor anterior queda lógicamente inválido. Requiere el Custom Access Token Hook de Supabase (Dashboard → Authentication → Hooks) para viajar como claim — sin ese hook habilitado, esta columna existe pero no se aplica todavía.';

-- ── Historial de contraseñas (solo hashes, ADR-015 Fase 2) ──────────────────
create table public.password_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  hash text not null,
  created_at timestamptz not null default now()
);
create index password_history_user_idx on public.password_history(user_id, created_at desc);

alter table public.password_history enable row level security;
-- Deny-by-default (06-Security/02_RLS.md): nadie lee ni escribe esta tabla
-- directo, ni siquiera el propio dueño — solo Server Actions vía
-- `createAdminClient()` (mismo patrón que `evento_auditoria`). El hash nunca
-- se expone a ningún cliente ni se usa para autenticar, solo para comparar
-- "no reutilizar las últimas 5".
revoke all on public.password_history from public, anon, authenticated;

-- ── Rate limiting de intentos de autenticación (sin Redis) ──────────────────
create table public.intento_auth (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  tipo text not null check (tipo in ('otp_envio', 'otp_verificacion', 'password_login', 'password_recovery')),
  exitoso boolean not null default false,
  created_at timestamptz not null default now()
);
create index intento_auth_email_tipo_idx on public.intento_auth(email, tipo, created_at desc);

alter table public.intento_auth enable row level security;
revoke all on public.intento_auth from public, anon, authenticated;

create or replace function public.verificar_rate_limit_auth(p_email text, p_tipo text)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_intentos int;
begin
  select count(*) into v_intentos
  from intento_auth
  where email = lower(p_email)
    and tipo = p_tipo
    and created_at > now() - interval '15 minutes'
    and not exitoso;

  if v_intentos >= 5 then
    raise exception 'RATE_LIMIT_EXCEDIDO';
  end if;
end;
$$;

create or replace function public.registrar_intento_auth(p_email text, p_tipo text, p_exitoso boolean)
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  insert into intento_auth (email, tipo, exitoso) values (lower(p_email), p_tipo, p_exitoso);
end;
$$;

-- ADL-022/028: revocar de los 3 roles explícitamente, nunca solo de uno.
-- Estas dos RPC se llaman desde Server Actions vía `createAdminClient()`
-- (mismo patrón que auditoría) — nunca directo desde el cliente, ni siquiera
-- autenticado, porque el chequeo debe correr ANTES de que exista sesión
-- (OTP/login/recovery son justamente los caminos pre-sesión).
revoke all on function public.verificar_rate_limit_auth(text, text) from public, anon, authenticated;
revoke all on function public.registrar_intento_auth(text, text, boolean) from public, anon, authenticated;

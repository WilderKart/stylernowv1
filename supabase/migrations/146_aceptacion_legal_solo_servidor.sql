-- 146 — Fase 1 del Centro de Evidencias: cerrar las tres debilidades de la aceptación legal.
--
--  1. El usuario ya NO puede crear, editar ni borrar sus filas de `aceptacion_legal` (antes la
--     política `aceptacion_legal_propia` era FOR ALL: podía borrar su prueba o cambiar la fecha).
--     Solo se escribe por funciones del servidor; la fila queda inmutable (trg_fila_inmutable, 116).
--  2. La hora es SIEMPRE la del servidor (clock_timestamp()); nunca un dato enviado por el navegador
--     ni los metadatos de Auth (que el propio usuario puede editar).
--  3. Los textos legales publicados son inmutables: sin UPDATE/DELETE para nadie (ni Super Admin);
--     una corrección es una versión NUEVA vía `publicar_texto_legal`. Cada texto guarda su SHA-256.
--
-- Además: cada aceptación indica su ORIGEN y si fue EXPRESA (la persona marcó/pulsó) o TÁCITA
-- (regla vigente: cambios no materiales se registran al ingresar sin acción del usuario). No se
-- cambia esa regla de negocio aquí: se deja trazada para que la evidencia no aparente lo que no es.

-- ── aceptacion_legal ────────────────────────────────────────────────────────
alter table public.aceptacion_legal add column if not exists origen text not null default 'desconocido';
alter table public.aceptacion_legal add column if not exists tipo_aceptacion text not null default 'EXPRESA';
alter table public.aceptacion_legal drop constraint if exists aceptacion_legal_tipo_chk;
alter table public.aceptacion_legal add constraint aceptacion_legal_tipo_chk check (tipo_aceptacion in ('EXPRESA', 'TACITA'));
alter table public.aceptacion_legal drop constraint if exists aceptacion_legal_origen_chk;
alter table public.aceptacion_legal add constraint aceptacion_legal_origen_chk
  check (origen in ('desconocido', 'registro', 'perfil', 'legal_aceptar', 'ingreso', 'sistema'));
alter table public.aceptacion_legal alter column aceptado_at set default clock_timestamp();

drop policy if exists aceptacion_legal_propia on public.aceptacion_legal;
drop policy if exists aceptacion_legal_select_propia on public.aceptacion_legal;
create policy aceptacion_legal_select_propia on public.aceptacion_legal for select to authenticated
  using (usuario_id = (select auth.uid()) or public.is_supersu());

revoke insert, update, delete, truncate on public.aceptacion_legal from public, anon, authenticated;
-- service_role también: en producción los default privileges le dan todo y salta la RLS. Escribe
-- solo por las funciones SECURITY DEFINER; TRUNCATE no dispara triggers de fila (borraría todo).
revoke insert, update, delete, truncate on public.aceptacion_legal from service_role;
grant select on public.aceptacion_legal to authenticated;
grant select, insert on public.aceptacion_legal to service_role;

drop trigger if exists trg_aceptacion_legal_inmutable on public.aceptacion_legal;
create trigger trg_aceptacion_legal_inmutable before update or delete on public.aceptacion_legal
  for each row execute function public.trg_fila_inmutable();

-- ── texto_legal: inmutable y con huella ─────────────────────────────────────
alter table public.texto_legal add column if not exists contenido_sha256 text;
-- Huella de los textos ya publicados (antes de volverlos inmutables) y de cada versión nueva al insertarla.
update public.texto_legal set contenido_sha256 = encode(sha256(convert_to(contenido, 'UTF8')), 'hex') where contenido_sha256 is null;
create or replace function public.trg_texto_legal_huella() returns trigger
language plpgsql set search_path = public as $$
begin
  new.contenido_sha256 := encode(sha256(convert_to(new.contenido, 'UTF8')), 'hex');
  return new;
end $$;
revoke all on function public.trg_texto_legal_huella() from public, anon, authenticated;
drop trigger if exists trg_texto_legal_huella on public.texto_legal;
create trigger trg_texto_legal_huella before insert on public.texto_legal
  for each row execute function public.trg_texto_legal_huella();
alter table public.texto_legal alter column contenido_sha256 set not null;

drop policy if exists texto_legal_write_supersu on public.texto_legal;
revoke insert, update, delete, truncate on public.texto_legal from public, anon, authenticated;
revoke insert, update, delete, truncate on public.texto_legal from service_role; -- publica `publicar_texto_legal`
grant select on public.texto_legal to anon, authenticated;

drop trigger if exists trg_texto_legal_inmutable on public.texto_legal;
create trigger trg_texto_legal_inmutable before update or delete on public.texto_legal
  for each row execute function public.trg_fila_inmutable();

-- ── Escritura de aceptaciones: solo por funciones ───────────────────────────
-- Con sesión: la persona acepta las versiones VIGENTES (la de mayor número de su tipo).
create or replace function public.registrar_aceptacion_legal(p_texto_ids uuid[], p_origen text, p_tipo text default 'EXPRESA')
returns integer
language plpgsql security definer set search_path = public as $fn$
declare
  v_uid uuid := auth.uid();
  v_n integer;
begin
  if v_uid is null then raise exception 'NO_AUTENTICADO'; end if;
  if p_origen not in ('registro', 'perfil', 'legal_aceptar', 'ingreso') then raise exception 'ORIGEN_INVALIDO'; end if;
  if p_tipo not in ('EXPRESA', 'TACITA') then raise exception 'TIPO_INVALIDO'; end if;
  -- La aceptación tácita solo existe para cambios NO materiales (regla vigente del ingreso).
  insert into public.aceptacion_legal (usuario_id, texto_legal_id, aceptado_at, origen, tipo_aceptacion)
  select v_uid, t.id, clock_timestamp(), p_origen, p_tipo
  from public.texto_legal t
  where t.id = any(coalesce(p_texto_ids, '{}'))
    and t.version = (select max(t2.version) from public.texto_legal t2 where t2.tipo = t.tipo and t2.publicado_at <= now())
    and (p_tipo = 'EXPRESA' or t.cambio_material = false)
  on conflict (usuario_id, texto_legal_id) do nothing;
  get diagnostics v_n = row_count;
  return v_n;
end;
$fn$;
revoke all on function public.registrar_aceptacion_legal(uuid[], text, text) from public, anon, authenticated;
grant execute on function public.registrar_aceptacion_legal(uuid[], text, text) to authenticated;

-- Sin sesión todavía (registro con contraseña): la llama SOLO el servidor (service_role) en el mismo
-- instante en que la persona marcó la casilla y creó la cuenta, con la hora del servidor.
create or replace function public.registrar_aceptacion_legal_registro(p_usuario uuid, p_texto_ids uuid[])
returns integer
language plpgsql security definer set search_path = public as $fn$
declare
  v_n integer;
begin
  if p_usuario is null or not exists (select 1 from auth.users u where u.id = p_usuario) then raise exception 'USUARIO_NO_ENCONTRADO'; end if;
  insert into public.aceptacion_legal (usuario_id, texto_legal_id, aceptado_at, origen, tipo_aceptacion)
  select p_usuario, t.id, clock_timestamp(), 'registro', 'EXPRESA'
  from public.texto_legal t
  where t.id = any(coalesce(p_texto_ids, '{}'))
    and t.version = (select max(t2.version) from public.texto_legal t2 where t2.tipo = t.tipo and t2.publicado_at <= now())
  on conflict (usuario_id, texto_legal_id) do nothing;
  get diagnostics v_n = row_count;
  update public.perfil set consentimiento_datos_at = clock_timestamp() where id = p_usuario and consentimiento_datos_at is null;
  return v_n;
end;
$fn$;
revoke all on function public.registrar_aceptacion_legal_registro(uuid, uuid[]) from public, anon, authenticated;
grant execute on function public.registrar_aceptacion_legal_registro(uuid, uuid[]) to service_role;

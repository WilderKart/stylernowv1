-- 136 · Super Admin solo desde la base de datos (pedido del propietario, 2026-11-14).
--
-- Antes: el trigger de perfil impedía cambiar es_supersu a quien NO era Super Admin, pero
--   (a) un Super Admin sí podía promover a otros por la API, y
--   (b) el INSERT no estaba cubierto: la política perfil_insert_propio deja insertar el perfil propio,
--       así que una cuenta sin perfil podía crearlo con es_supersu = true.
-- Ahora ningún rol de la API (anon / authenticated) puede fijar ni cambiar es_supersu, en INSERT ni en
-- UPDATE, aunque sea Super Admin. Solo el SQL Editor / postgres / service_role lo modifican.
-- Además: un único Super Admin en toda la plataforma (índice único parcial). Para tener otro, primero se
-- elimina este índice a propósito.

create or replace function public.perfil_proteger_columnas_sensibles()
 returns trigger
 language plpgsql
 set search_path to 'public'
as $function$
begin
  if current_user in ('authenticated', 'anon') then
    if tg_op = 'INSERT' then
      if coalesce(new.es_supersu, false) then
        raise exception 'NO_AUTORIZADO: es_supersu solo se asigna desde la base de datos';
      end if;
      return new;
    end if;
    if new.es_supersu is distinct from old.es_supersu then
      raise exception 'NO_AUTORIZADO: es_supersu solo se asigna desde la base de datos';
    end if;
    if new.email is distinct from old.email then
      raise exception 'NO_AUTORIZADO: el correo del perfil se toma de la cuenta y no se edita directamente';
    end if;
  end if;
  if tg_op = 'UPDATE' and auth.uid() is not null and not public.is_supersu()
     and new.session_version is distinct from old.session_version then
    raise exception 'NO_AUTORIZADO: session_version no se puede modificar directamente';
  end if;
  return new;
end;
$function$;

create or replace trigger perfil_proteger_columnas_sensibles_ins_trg
  before insert on public.perfil
  for each row execute function public.perfil_proteger_columnas_sensibles();

create unique index if not exists ux_perfil_supersu_unico on public.perfil (es_supersu) where es_supersu;

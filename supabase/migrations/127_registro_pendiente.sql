-- 127 · Registro pendiente: una cuenta nueva no entra a la app hasta pulsar «Crear cuenta».
--
-- Falla (reportada 2026-11-12): al validar el código del correo, Supabase ya abre sesión. El paso
-- «Crea tu cuenta» (nombre, país, aceptación de Términos y Política) solo se exigía en /login: si el
-- usuario iba hacia atrás, entraba a la app sin haber completado el registro ni aceptado los textos
-- legales.
--
-- Solución:
--  * `perfil.registro_pendiente`: true para toda cuenta NUEVA desde esta migración; false para las
--    existentes (283 de 284 perfiles en producción no tienen país, entre ellos dueños, staff y SuperSU:
--    usar "sin país" como señal los habría bloqueado a todos).
--  * Se baja a false SOLO cuando `completar_registro` fija el país (la acción de «Crear cuenta»).
--  * Se refleja en `auth.users.raw_app_meta_data.registro_pendiente`, que el usuario NO puede editar
--    (app_metadata solo la cambia el servidor) y que el proxy lee en cada petición sin consultar la base.
--  * `cuentas_registro_abandonado()`: lista las cuentas que nunca completaron el registro tras el plazo,
--    sin reservas, negocios, vínculos ni pagos, para que el cron las elimine.
--
-- Sin aplicar en producción. Re-ejecutable.

alter table public.perfil add column if not exists registro_pendiente boolean not null default false;
-- Las filas existentes quedan en false (arriba). Desde aquí, toda cuenta nueva nace pendiente.
alter table public.perfil alter column registro_pendiente set default true;

-- Reflejo en app_metadata (lo lee el proxy). SECURITY DEFINER: el dueño de la función (postgres)
-- puede actualizar auth.users; ningún rol de la API puede llamarla.
create or replace function public._sincronizar_registro_pendiente(p_usuario uuid, p_pendiente boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  update auth.users
     set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || jsonb_build_object('registro_pendiente', p_pendiente)
   where id = p_usuario
     and (raw_app_meta_data->>'registro_pendiente') is distinct from p_pendiente::text;
end $$;
revoke all on function public._sincronizar_registro_pendiente(uuid, boolean) from public, anon, authenticated, service_role;

-- Fijar el país (completar_registro) es lo único que completa el registro.
-- SECURITY INVOKER a propósito: decide con `current_user`, que dentro de una función DEFINER
-- siempre sería el dueño (postgres) y dejaría pasar a cualquiera.
create or replace function public.trg_perfil_registro_pendiente() returns trigger
language plpgsql security invoker set search_path = public as $$
begin
  if tg_op = 'UPDATE' then
    if new.pais is not null and old.pais is null then
      new.registro_pendiente := false;
    elsif new.registro_pendiente is distinct from old.registro_pendiente
          and current_user not in ('postgres', 'supabase_admin') then
      -- Nadie puede marcarse "registro completo" a mano por la API: solo vía país (completar_registro).
      new.registro_pendiente := old.registro_pendiente;
    end if;
  end if;
  return new;
end $$;
revoke all on function public.trg_perfil_registro_pendiente() from public, anon, authenticated;

drop trigger if exists trg_perfil_registro_pendiente on public.perfil;
create trigger trg_perfil_registro_pendiente before update on public.perfil
  for each row execute function public.trg_perfil_registro_pendiente();

create or replace function public.trg_perfil_registro_pendiente_sync() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' or new.registro_pendiente is distinct from old.registro_pendiente then
    perform public._sincronizar_registro_pendiente(new.id, new.registro_pendiente);
  end if;
  return new;
end $$;
revoke all on function public.trg_perfil_registro_pendiente_sync() from public, anon, authenticated;

drop trigger if exists trg_perfil_registro_pendiente_sync on public.perfil;
-- Sin lista de columnas: el cambio lo hace el trigger BEFORE al fijar el país, y `update of
-- registro_pendiente` solo se dispara si la columna viene en el SET del UPDATE original.
create trigger trg_perfil_registro_pendiente_sync after insert or update on public.perfil
  for each row execute function public.trg_perfil_registro_pendiente_sync();

-- Cuentas abandonadas: pendientes más allá del plazo y sin ningún dato propio. El cron borra la
-- cuenta de acceso con la Admin API (el perfil cae en cascada). Nunca toca cuentas con actividad.
create or replace function public.cuentas_registro_abandonado(p_horas int default 24, p_limite int default 50)
returns table(usuario_id uuid)
language sql stable security definer set search_path = public as $$
  select p.id
    from public.perfil p
   where p.registro_pendiente
     and p.created_at < now() - make_interval(hours => greatest(p_horas, 1))
     and not p.es_supersu
     and not exists (select 1 from public.reserva r where r.cliente_id = p.id)
     and not exists (select 1 from public.negocio n where n.owner_user_id = p.id)
     and not exists (select 1 from public.vinculo_staff_negocio v where v.staff_id = p.id)
     and not exists (select 1 from public.gift_card g where g.comprador_id = p.id)
   order by p.created_at
   limit greatest(1, least(p_limite, 200));
$$;
revoke all on function public.cuentas_registro_abandonado(int, int) from public, anon, authenticated;
grant execute on function public.cuentas_registro_abandonado(int, int) to service_role;

-- Paridad: las cuentas existentes quedan marcadas como completas también en app_metadata.
update auth.users u
   set raw_app_meta_data = coalesce(u.raw_app_meta_data, '{}'::jsonb) || '{"registro_pendiente": false}'::jsonb
 where exists (select 1 from public.perfil p where p.id = u.id and not p.registro_pendiente)
   and (u.raw_app_meta_data->>'registro_pendiente') is distinct from 'false';

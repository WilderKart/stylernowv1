-- 146 · Corrige una regresión funcional: el dueño no podía suspender/retirar staff ni promover/revocar guardianes.
-- Causa: el trigger perfil_proteger_columnas_sensibles() bloquea cualquier cambio de session_version cuando auth.uid() no es nulo y quien llama
-- no es Super Admin. Las funciones SECURITY DEFINER suspender_staff / retirar_staff / promover_guardian / revocar_guardian llaman a
-- incrementar_session_version() (para cerrar las sesiones del staff afectado); dentro de ellas auth.uid() sigue siendo el dueño, así que el trigger
-- lanza «NO_AUTORIZADO: session_version no se puede modificar directamente» y la operación entera falla (reproducido en local; la definición del
-- trigger y de suspender_staff en producción es idéntica: mismo md5).
-- Ahora el bloqueo de session_version aplica a los roles de la API (anon/authenticated), igual que es_supersu y email: una actualización DIRECTA por la
-- API sigue prohibida; las funciones DEFINER controladas por el servidor (dueño del negocio verificado dentro de cada función) pueden incrementarlo.
-- ADITIVA: solo reemplaza la función del trigger; no toca filas. Reversión: restaurar la definición de 136_supersu_solo_desde_base.sql.
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
    -- session_version: solo lo mueven funciones del servidor (DEFINER) o el Super Admin; nunca una escritura directa de la API.
    if new.session_version is distinct from old.session_version and not coalesce(public.is_supersu(), false) then
      raise exception 'NO_AUTORIZADO: session_version no se puede modificar directamente';
    end if;
  end if;
  return new;
end;
$function$;

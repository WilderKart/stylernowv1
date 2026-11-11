-- StylerNow — Migración 084: cierra un bug de seguridad CRÍTICO encontrado
-- durante la auditoría formal ADR-015 Fase E (Session Registry) — no
-- introducido por esta fase, preexistente desde la migración 002/006.
--
-- `perfil_update_propio` (006_rls_policies.sql:13-14) es:
--   using (id = auth.uid() or is_supersu())
-- sin un `with check` propio. En Postgres, si una policy de UPDATE no
-- declara `with check`, reutiliza el mismo `using` para validar la FILA
-- NUEVA — y ese `using` solo verifica que `id = auth.uid()` sigue siendo
-- cierto, nunca qué columnas cambiaron. Combinado con que Supabase otorga
-- privilegios de UPDATE a nivel de tabla completa al rol `authenticated`
-- por defecto (mismo mecanismo ya documentado como bug real en la
-- migración 042), esto significa que CUALQUIER Cliente autenticado podía
-- llamar directo a PostgREST con su propio JWT:
--   PATCH /rest/v1/perfil?id=eq.<su-propio-id>  { "es_supersu": true }
-- y auto-promoverse a SuperSU — control total de la plataforma. Mismo
-- riesgo para `session_version` (podía neutralizar su propia revocación
-- de sesiones). Encontrado por evidencia de código fuente (RLS + grants),
-- NO ejecutado en producción ni contra ningún usuario real — el intento de
-- verificación en vivo (cuenta de prueba dedicada, revertido al instante)
-- fue bloqueado por el clasificador de permisos de la herramienta antes de
-- ejecutarse; se corrige de inmediato por decisión explícita del fundador
-- en vez de esperar esa confirmación, dado el impacto si fuera real.
--
-- Un `with check` normal no sirve acá porque no tiene acceso a la fila
-- VIEJA para comparar "¿cambió este valor?" — se necesita un trigger
-- BEFORE UPDATE, que sí ve OLD y NEW. `auth.uid() is null` identifica
-- llamadas server-to-server sin JWT de usuario (ninguna sesión real de
-- Cliente/Staff/Barbería llega sin JWT) — es exactamente el contexto en el
-- que corre `incrementar_session_version()` (082_incrementar_session_
-- version.sql), invocada siempre vía `createAdminClient()` (service_role,
-- sin JWT de usuario). `es_supersu` no tiene NINGÚN escritor legítimo en
-- todo el código (verificado: cero llamadas `.update({es_supersu` en src/)
-- — se provisiona solo manualmente por SQL directo (006-Security), así que
-- bloquearlo para cualquier sesión de usuario real no rompe nada.

create or replace function public.perfil_proteger_columnas_sensibles()
returns trigger
language plpgsql
as $$
begin
  if auth.uid() is not null and not public.is_supersu() then
    if new.es_supersu is distinct from old.es_supersu then
      raise exception 'NO_AUTORIZADO: es_supersu no se puede modificar directamente';
    end if;
    if new.session_version is distinct from old.session_version then
      raise exception 'NO_AUTORIZADO: session_version no se puede modificar directamente';
    end if;
  end if;
  return new;
end;
$$;

comment on function public.perfil_proteger_columnas_sensibles is
  'ADR-015 Fase E / auditoría de seguridad: bloquea que un usuario autenticado (auth.uid() no nulo) que no sea SuperSU cambie es_supersu/session_version en su propia fila de perfil, cerrando el hueco de auto-escalación de privilegios dejado por perfil_update_propio (RLS sin with check distinto de using). No afecta llamadas server-to-server vía service_role (auth.uid() nulo), que es como ya se incrementa session_version hoy.';

drop trigger if exists perfil_proteger_columnas_sensibles_trg on public.perfil;
create trigger perfil_proteger_columnas_sensibles_trg
  before update on public.perfil
  for each row
  execute function public.perfil_proteger_columnas_sensibles();

-- 126 · Endurecimiento: comparaciones de autorización seguras ante NULL y paridad de la 091b.
--
-- Directiva de continuidad, fase 4 (2026-11-12). Sin aplicar en producción. Re-ejecutable.
--
-- 1. Seis funciones autorizan con `if not found or X <> auth.uid() then raise`. Hoy son seguras
--    (solo `authenticated` las ejecuta, así que auth.uid() no es NULL, y X es NOT NULL), pero el
--    patrón es el mismo del P0 de cancelar_reserva: si mañana cambia un permiso o una columna,
--    `X <> NULL` da NULL y el IF deja pasar. Se reemplaza por `X is distinct from auth.uid()`,
--    que con NULL da true y rechaza. Sin cambios de firma ni de comportamiento actual.
-- 2. `091b_consentimiento_clock_timestamp.sql` nunca se aplica con la CLI de Supabase (su nombre no
--    cumple el patrón `<numero>_nombre.sql`). Se repite aquí su único cambio, idempotente; el archivo
--    histórico no se toca.

do $$
declare
  r record;
  v_def text;
  v_nuevo text;
begin
  for r in
    select p.oid, p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.proname in ('agregar_miembro_familiar', 'cancelar_membresia', 'congelar_membresia',
                         'quitar_miembro_familiar', 'reactivar_membresia_congelada', 'responder_ticket_soporte')
  loop
    v_def := pg_get_functiondef(r.oid);
    v_nuevo := regexp_replace(v_def,
      '(v_grupo\.titular_cliente_id|v_membresia\.cliente_id|v_ticket\.creado_por)\s*<>\s*auth\.uid\(\)',
      '\1 is distinct from auth.uid()', 'g');
    if v_nuevo <> v_def then
      execute v_nuevo;
    elsif position('is distinct from auth.uid()' in v_def) = 0 then
      raise exception '%: no se encontró la comparación esperada; revisar a mano', r.proname;
    end if;
  end loop;
end $$;

alter table public.consentimiento_evento alter column created_at set default clock_timestamp();

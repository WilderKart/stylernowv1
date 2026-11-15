-- 141 · Quitar TRUNCATE, TRIGGER y REFERENCES de las tablas de `public` a anon y authenticated. ADITIVA en datos (no toca filas), solo reduce privilegios.
-- Motivo: en producción todas las tablas de `public` conceden a anon/authenticated INSERT/SELECT/UPDATE/DELETE/TRUNCATE/REFERENCES/TRIGGER.
-- Las políticas RLS acotan SELECT/INSERT/UPDATE/DELETE, pero TRUNCATE NO pasa por RLS: cualquier vía que ejecute SQL como esos roles podría vaciar una tabla.
-- La API (PostgREST) nunca emite TRUNCATE ni crea triggers/referencias, así que la app no depende de estos privilegios.
-- Reversión: grant truncate, references, trigger on all tables in schema public to anon, authenticated;
revoke truncate, references, trigger on all tables in schema public from anon, authenticated;
-- Tablas futuras: que no nazcan con esos privilegios.
alter default privileges in schema public revoke truncate, references, trigger on tables from anon, authenticated;
alter default privileges for role postgres in schema public revoke truncate, references, trigger on tables from anon, authenticated;

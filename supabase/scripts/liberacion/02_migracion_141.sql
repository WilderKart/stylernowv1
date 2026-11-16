-- MIGRACIÓN 141 · quitar TRUNCATE, REFERENCES y TRIGGER a anon y authenticated. No toca filas, políticas ni funciones.
-- CÓMO USARLO (Supabase → SQL Editor): ejecuta los TRES bloques por separado y en orden, seleccionando el texto de cada bloque y pulsando «Run» (no uses «Run» sin selección: correría todo junto).
--   BLOQUE A (solo lectura): verificación previa. Compara con «ESPERADO». Si no coincide, NO continúes y avísame.
--   BLOQUE B: aplica el cambio dentro de begin/commit (si algo falla, no queda nada a medias).
--   BLOQUE C (solo lectura): verificación posterior. Compara con «ESPERADO».
-- Antes del primer paso ya debes haber ejecutado y GUARDADO captura_estado_previo.sql. La captura NO sustituye un respaldo completo de producción.
-- Reversión: sección A de captura_estado_previo.sql (sentencias exactas) + las dos líneas «alter default privileges» de reversion_139_141_142.sql.txt.

-- ===================== BLOQUE A · verificación previa (solo lectura) =====================
select
  (select count(*) from information_schema.role_table_grants where table_schema = 'public' and grantee in ('anon', 'authenticated') and privilege_type in ('TRUNCATE', 'TRIGGER', 'REFERENCES')) as privilegios_a_quitar,
  (select count(*) from pg_class c join pg_namespace n on n.oid = c.relnamespace and n.nspname = 'public' where c.relkind in ('r', 'p') and pg_get_userbyid(c.relowner) <> 'postgres') as tablas_con_dueno_distinto_de_postgres;
-- ESPERADO: privilegios_a_quitar > 0 (en local fueron 586) y tablas_con_dueno_distinto_de_postgres = 0. Si el segundo no es 0, NO apliques y avísame.

-- ===================== BLOQUE B · aplicar (contenido EXACTO de 141_quitar_truncate_y_trigger_a_roles_publicos.sql) =====================
begin;
-- 141 · Quitar TRUNCATE, TRIGGER y REFERENCES de las tablas de `public` a anon y authenticated. ADITIVA en datos (no toca filas), solo reduce privilegios.
-- Motivo: en producción todas las tablas de `public` conceden a anon/authenticated INSERT/SELECT/UPDATE/DELETE/TRUNCATE/REFERENCES/TRIGGER.
-- Las políticas RLS acotan SELECT/INSERT/UPDATE/DELETE, pero TRUNCATE NO pasa por RLS: cualquier vía que ejecute SQL como esos roles podría vaciar una tabla.
-- La API (PostgREST) nunca emite TRUNCATE ni crea triggers/referencias, así que la app no depende de estos privilegios.
-- Reversión: grant truncate, references, trigger on all tables in schema public to anon, authenticated;
revoke truncate, references, trigger on all tables in schema public from anon, authenticated;
-- Tablas futuras: que no nazcan con esos privilegios.
alter default privileges in schema public revoke truncate, references, trigger on tables from anon, authenticated;
alter default privileges for role postgres in schema public revoke truncate, references, trigger on tables from anon, authenticated;
commit;

-- ===================== BLOQUE C · verificación posterior (solo lectura) =====================
select
  (select count(*) from information_schema.role_table_grants where table_schema = 'public' and grantee in ('anon', 'authenticated') and privilege_type in ('TRUNCATE', 'TRIGGER', 'REFERENCES')) as privilegios_restantes,
  has_table_privilege('authenticated', 'public.reserva', 'SELECT') as authenticated_sigue_leyendo_reserva,
  has_table_privilege('authenticated', 'public.reserva', 'INSERT') as authenticated_sigue_insertando_reserva,
  not has_table_privilege('anon', 'public.reserva', 'TRUNCATE') as anon_ya_no_puede_truncar,
  not has_table_privilege('authenticated', 'public.reserva', 'TRUNCATE') as authenticated_ya_no_puede_truncar;
-- ESPERADO: privilegios_restantes = 0 y las demás columnas = true. Después abre la app (inicio, un negocio, reservar, tu panel) y confirma que todo carga.

-- 145 · Quitar MAINTAIN (Postgres 17+) de las tablas de `public` a anon y authenticated. ADITIVA en datos: solo reduce privilegios, no toca filas.
-- Hallazgo (Fase 1B, residual de 141): MAINTAIN permite VACUUM, ANALYZE, REINDEX, CLUSTER y REFRESH MATERIALIZED VIEW sobre la tabla.
-- Con ese privilegio, cualquier vía que ejecute SQL como anon/authenticated podría lanzar mantenimiento pesado (REINDEX/CLUSTER/VACUUM reescriben y
-- bloquean la tabla). PostgREST nunca emite esos comandos y el autovacuum corre como superusuario: ninguna función de la app los necesita.
-- NOTA (medido): LOCK TABLE ... ACCESS EXCLUSIVE NO depende de MAINTAIN, también lo permiten UPDATE/DELETE; no se resuelve con permisos (ver informe).
-- Origen medido en producción (PG 17.6): 96 tablas para anon y 104 para authenticated, de 139; vienen de los privilegios por defecto de `postgres` en `public`.
-- Protegida por versión: en Postgres < 17 el privilegio no existe y la migración no hace nada.
-- Reversión: grant maintain on all tables in schema public to anon, authenticated;  (o las sentencias exactas de la captura previa)
do $$
begin
  if current_setting('server_version_num')::int >= 170000 then
    execute 'revoke maintain on all tables in schema public from anon, authenticated';
    execute 'alter default privileges in schema public revoke maintain on tables from anon, authenticated';
    execute 'alter default privileges for role postgres in schema public revoke maintain on tables from anon, authenticated';
  end if;
end $$;

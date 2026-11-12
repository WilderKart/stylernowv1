-- LIMPIEZA DE DATOS DE PRUEBA EN PRODUCCION (auditoria: bloqueante #9)
-- NO es una migracion: se pega a mano en el SQL editor de Supabase, por pasos, DESPUES de leerla.
--
-- Por que "ocultar y desactivar" y no "borrar": evento_auditoria es inmutable y tiene claves foraneas a los usuarios,
-- asi que borrar usuarios o negocios con historial falla o destruye la auditoria. Esto deja la plataforma limpia de cara al
-- publico y es REVERSIBLE (el paso 5 lo deshace).
--
-- Que se considera "de prueba": perfiles con correo @stylernow-test.com o @stylernow.test, y los negocios que son de esos duenos.
-- NUNCA se toca: ghocho88@gmail.com, wildercaicedo88@gmail.com ni ningun otro perfil con correo fuera de esos dominios.
--
-- IMPORTANTE (hallazgo de la auditoria): hoy los 17 SuperSU son TODOS cuentas de prueba. Si se les quita el permiso sin
-- haber promovido antes a un SuperSU real, nadie podra entrar a /admin. Por eso el paso 3 exige el correo del admin real.

-- ===== PASO 0: simulacro (solo lee) ==========================================================================================
select
  (select count(*) from perfil where email ~ '@stylernow(-test)?\.(test|com)$')                                   as perfiles_de_prueba,
  (select count(*) from perfil where es_supersu and email ~ '@stylernow(-test)?\.(test|com)$')                    as supersu_de_prueba,
  (select count(*) from perfil where es_supersu and email !~ '@stylernow(-test)?\.(test|com)$')                   as supersu_reales,
  (select count(*) from negocio n join perfil p on p.id = n.owner_user_id
    where p.email ~ '@stylernow(-test)?\.(test|com)$' and n.estado <> 'CANCELADO')                                 as negocios_de_prueba_visibles,
  (select count(*) from perfil where email !~ '@stylernow(-test)?\.(test|com)$')                                  as perfiles_no_prueba_que_NO_se_tocan;

-- ===== PASO 1: respaldo de lo que se va a cambiar (queda en tablas _respaldo_limpieza_*) ========================================
create table if not exists public._respaldo_limpieza_negocio as
  select n.id, n.estado, now() as respaldado_at from negocio n join perfil p on p.id = n.owner_user_id
   where p.email ~ '@stylernow(-test)?\.(test|com)$';
create table if not exists public._respaldo_limpieza_supersu as
  select p.id, p.email, p.es_supersu, now() as respaldado_at from perfil p
   where p.es_supersu and p.email ~ '@stylernow(-test)?\.(test|com)$';
alter table public._respaldo_limpieza_negocio enable row level security;   -- sin politicas: nadie por API
alter table public._respaldo_limpieza_supersu enable row level security;
revoke all on public._respaldo_limpieza_negocio from anon, authenticated;
revoke all on public._respaldo_limpieza_supersu from anon, authenticated;

-- ===== PASO 2: ocultar los negocios de prueba del marketplace, mapa y sitemap =================================================
update negocio n set estado = 'CANCELADO', updated_at = now()
  from perfil p
 where p.id = n.owner_user_id and p.email ~ '@stylernow(-test)?\.(test|com)$' and n.estado <> 'CANCELADO';

-- ===== PASO 3: promover al SuperSU REAL (EDITA EL CORREO) y solo despues quitar el permiso a las cuentas de prueba ==============
do $$
declare
  v_admin_email text := 'CAMBIAR_POR_EL_CORREO_DEL_ADMIN_REAL@ejemplo.com';   -- <<< EDITAR
  v_n int;
begin
  if v_admin_email like 'CAMBIAR_POR_%' then raise exception 'Edita v_admin_email antes de ejecutar este paso'; end if;
  update perfil set es_supersu = true where lower(email) = lower(v_admin_email);
  get diagnostics v_n = row_count;
  if v_n <> 1 then raise exception 'No existe un perfil con el correo % (inicia sesion una vez con esa cuenta y repite)', v_admin_email; end if;
  if v_admin_email ~ '@stylernow(-test)?\.(test|com)$' then raise exception 'El admin real no puede ser una cuenta de prueba'; end if;
  update perfil set es_supersu = false where es_supersu and email ~ '@stylernow(-test)?\.(test|com)$';
end $$;

-- ===== PASO 4: bloquear el acceso de las cuentas de prueba (no se borran; reversible) ============================================
update auth.users set banned_until = 'infinity'
 where lower(email) ~ '@stylernow(-test)?\.(test|com)$'
   and lower(email) not in ('ghocho88@gmail.com', 'wildercaicedo88@gmail.com');

-- ===== PASO 5 (solo si hay que DESHACER): restaurar negocios, permisos y accesos =================================================
-- update negocio n set estado = r.estado from public._respaldo_limpieza_negocio r where r.id = n.id;
-- update perfil p set es_supersu = r.es_supersu from public._respaldo_limpieza_supersu r where r.id = p.id;
-- update auth.users set banned_until = null where lower(email) ~ '@stylernow(-test)?\.(test|com)$';

-- ===== VERIFICACION final ===========================================================================================================
-- select count(*) filter (where estado = 'ACTIVO') as negocios_visibles from negocio;
-- select email from perfil where es_supersu;

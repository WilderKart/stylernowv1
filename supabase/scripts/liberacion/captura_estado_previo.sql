-- CAPTURA DEL ESTADO PREVIO (solo lectura: únicamente SELECT; no cambia nada). Ejecutar en Supabase SQL Editor ANTES de aplicar 139/141/142 y guardar el resultado completo
-- (exportar a CSV o copiar a un archivo fuera del proyecto). Cada fila de la columna `sentencia` es SQL que devuelve ese objeto a su estado actual.
-- Las migraciones 139/141/142 no modifican ni borran filas; solo cambian privilegios, políticas y funciones, y esas tres cosas son lo que se captura aquí.
select 1 as orden, 'A. privilegios TRUNCATE/REFERENCES/TRIGGER por tabla (para revertir 141)' as seccion,
  format('grant %s on public.%I to %I;', string_agg(p.priv, ', ' order by p.priv), c.relname, r.rol) as sentencia
from pg_class c
join pg_namespace n on n.oid = c.relnamespace and n.nspname = 'public'
cross join (values ('anon'), ('authenticated')) r(rol)
cross join (values ('TRUNCATE'), ('REFERENCES'), ('TRIGGER')) p(priv)
where c.relkind in ('r', 'p') and has_table_privilege(r.rol, c.oid, p.priv)
group by c.relname, r.rol
union all
select 2, 'B. privilegios de tabla de ai_accion_costo (para revertir 139)',
  format('grant %s on public.ai_accion_costo to %I;', string_agg(p.priv, ', ' order by p.priv), r.rol)
from (values ('anon'), ('authenticated')) r(rol)
cross join (values ('SELECT'), ('INSERT'), ('UPDATE'), ('DELETE'), ('TRUNCATE'), ('REFERENCES'), ('TRIGGER'), ('MAINTAIN')) p(priv)
where case when p.priv = 'MAINTAIN' and current_setting('server_version_num')::int < 170000 then false
           else has_table_privilege(r.rol, 'public.ai_accion_costo'::regclass, p.priv) end
group by r.rol
union all
select 3, 'C. políticas referido_config_select / vip_nivel_select (para revertir 139)',
  format('drop policy if exists %I on public.%I; create policy %I on public.%I for select using (%s);', policyname, tablename, policyname, tablename, qual)
from pg_policies where schemaname = 'public' and policyname in ('referido_config_select', 'vip_nivel_select')
union all
select 4, 'D. funciones afectadas: definición (para revertir 139/142)', pg_get_functiondef(p.oid) || ';'
from pg_proc p join pg_namespace n on n.oid = p.pronamespace and n.nspname = 'public'
where p.proname in ('crear_grupo_familiar', 'registrar_evento_fraude')
union all
select 5, 'E. ejecución de funciones afectadas (para revertir 139/142)',
  format('grant execute on function %s to %s;', p.oid::regprocedure, case when a.grantee = 0 then 'public' else quote_ident(pg_get_userbyid(a.grantee)) end)
from pg_proc p join pg_namespace n on n.oid = p.pronamespace and n.nspname = 'public',
  lateral aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
where p.proname in ('crear_grupo_familiar', 'registrar_evento_fraude', 'agregar_miembro_familiar') and a.privilege_type = 'EXECUTE'
union all
select 6, 'F. constraints presentes hoy (informativo)', conname || ' -> ' || pg_get_constraintdef(oid)
from pg_constraint where conname in ('familia_grupo_limite_miembros_chk', 'oferta_negocio_porcentaje_max_chk')
union all
select 7, 'G. conteos de filas (informativo; deben ser idénticos después de aplicar)', t || ' = ' || n::text
from (select 'familia_grupo' t, count(*) n from public.familia_grupo union all select 'referido_config', count(*) from public.referido_config
      union all select 'vip_nivel', count(*) from public.vip_nivel union all select 'ai_accion_costo', count(*) from public.ai_accion_costo
      union all select 'lealtad_fraude_evento', count(*) from public.lealtad_fraude_evento union all select 'oferta_negocio', count(*) from public.oferta_negocio) q
union all
select 8, 'H. PRECHECK 141: tablas de public cuyo dueño NO es postgres (si aparece alguna, 141 puede emitir un aviso; avísame antes de aplicar)', c.relname || ' (dueño ' || pg_get_userbyid(c.relowner) || ')'
from pg_class c join pg_namespace n on n.oid = c.relnamespace and n.nspname = 'public'
where c.relkind in ('r', 'p') and pg_get_userbyid(c.relowner) <> 'postgres'
union all
select 9, 'I. informativo: versión de Postgres y tablas con MAINTAIN para anon (141 no lo revoca; solo existe en PG 17+)', current_setting('server_version') || ' | tablas con MAINTAIN para anon: ' ||
  case when current_setting('server_version_num')::int < 170000 then 'n/a'
       else (select count(*)::text from pg_class c join pg_namespace n on n.oid = c.relnamespace and n.nspname = 'public' where c.relkind in ('r', 'p') and has_table_privilege('anon', c.oid, 'MAINTAIN')) end
order by 1, 3;

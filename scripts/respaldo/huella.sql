-- Huella de una base: sirve para comparar origen y restauración. Solo lectura.
select 'tablas_public|'||count(*) from pg_tables where schemaname='public'
union all select 'funciones_public|'||count(*) from pg_proc where pronamespace='public'::regnamespace
union all select 'politicas_public|'||count(*) from pg_policies where schemaname='public'
union all select 'politicas_storage|'||count(*) from pg_policies where schemaname='storage'
union all select 'triggers_public|'||count(*) from pg_trigger t join pg_class c on c.oid=t.tgrelid where c.relnamespace='public'::regnamespace and not t.tgisinternal
union all select 'hash_funciones|'||md5(string_agg(p.oid::regprocedure::text||md5(replace(pg_get_functiondef(p.oid),E'\r','')),',' order by p.oid::regprocedure::text)) from pg_proc p where pronamespace='public'::regnamespace and prokind='f'
union all select 'hash_politicas|'||md5(string_agg(schemaname||tablename||policyname||cmd||coalesce(qual,'')||coalesce(with_check,''),',' order by schemaname,tablename,policyname)) from pg_policies where schemaname in ('public','storage')
union all select 'hash_columnas|'||md5(string_agg(table_name||column_name||data_type||is_nullable||coalesce(column_default,''),',' order by table_name,ordinal_position)) from information_schema.columns where table_schema='public'
union all select 'hash_privilegios_tabla|'||md5(string_agg(table_name||grantee||privilege_type,',' order by table_name,grantee,privilege_type)) from information_schema.table_privileges where table_schema='public' and grantee in ('anon','authenticated','service_role')
union all select 'filas_auth_users|'||count(*) from auth.users
union all select 'filas_auth_identities|'||count(*) from auth.identities
union all select 'filas_public_total|'||coalesce(sum((xpath('/row/c/text()', query_to_xml(format('select count(*) as c from public.%I', tablename), false, true, '')))[1]::text::bigint),0) from pg_tables where schemaname='public'
union all select 'filas_storage_objects|'||count(*) from storage.objects
order by 1;

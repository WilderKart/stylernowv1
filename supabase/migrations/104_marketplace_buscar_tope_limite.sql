-- H7 (informe de seguridad): la busqueda publica aceptaba p_limite arbitrariamente grande. Se limita a 100 filas
-- por llamada en marketplace_buscar y marketplace_buscar_filtrado (la vista de mapa usa 100). Misma firma y permisos.
do $$
declare
  f text; v_def text; v_nuevo text;
  v_viejo text := 'limit greatest(coalesce(p_limite, 20), 1)';
  v_reemp text := 'limit least(greatest(coalesce(p_limite, 20), 1), 100)';
begin
  for f in select p.oid::regprocedure::text from pg_proc p
           where p.pronamespace = 'public'::regnamespace and p.proname in ('marketplace_buscar', 'marketplace_buscar_filtrado')
  loop
    v_def := pg_get_functiondef(f::regprocedure);
    v_nuevo := replace(v_def, v_viejo, v_reemp);
    if v_nuevo = v_def then raise exception 'sin cambio en %', f; end if;
    execute v_nuevo;
  end loop;
end $$;

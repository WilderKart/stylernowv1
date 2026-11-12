-- 114: cierre de los bloqueantes de la auditoria de produccion (docs/AUDITORIA_PRODUCCION.md).
--  A) Las RPC de membresias / fidelizacion respetan el plan (antes solo la RLS directa lo hacia).
--  B) congelar_membresia: fila bloqueada (FOR UPDATE) -> sin carrera que difiera el cobro.
--  C) crear_pago_sena: candado por reserva -> sin pagos PENDIENTE duplicados bajo concurrencia.
--  D) negocio: columnas sensibles ya no son legibles por anon (ni NIT/comision por authenticated).
--  E) familia_grupo / familia_miembro: politicas sin recursion infinita.
--  F) Higiene: search_path fijo en 3 funciones, bucket avatars sin listado publico, MIME en soporte-adjuntos.
-- Aditiva y reversible. Todas las funciones tocadas conservan firma y permisos.

-- A) Gating por plan dentro de las RPC -------------------------------------------------------------------------------
do $$
declare
  r record; v_oid oid; v_def text; v_nuevo text; v_check text;
begin
  for r in select * from (values
    ('crear_plan_membresia',            'p_negocio_id',                                                                       'membresias'),
    ('actualizar_plan_membresia',       '(select mp.negocio_id from public.membresia_plan mp where mp.id = p_plan_id)',        'membresias'),
    ('alternar_plan_membresia',         '(select mp.negocio_id from public.membresia_plan mp where mp.id = p_plan_id)',        'membresias'),
    ('crear_campana_sellos',            'p_negocio_id',                                                                       'fidelizacion'),
    ('alternar_campana_sellos',         '(select sc.negocio_id from public.sello_campana sc where sc.id = p_campana_id)',      'fidelizacion'),
    ('crear_regla_cashback',            'p_negocio_id',                                                                       'fidelizacion'),
    ('alternar_regla_cashback',         '(select cr.negocio_id from public.cashback_regla cr where cr.id = p_regla_id)',       'fidelizacion'),
    ('crear_regla_recompensa',          'p_negocio_id',                                                                       'fidelizacion'),
    ('alternar_regla_recompensa',       '(select rr.negocio_id from public.recompensa_regla rr where rr.id = p_regla_id)',     'fidelizacion'),
    ('confirmar_sugerencia_recompensa', '(select rs.negocio_id from public.recompensa_sugerencia rs where rs.id = p_sugerencia_id)', 'fidelizacion'),
    ('crear_nivel_vip',                 'p_negocio_id',                                                                       'fidelizacion'),
    ('asignar_vip',                     'p_negocio_id',                                                                       'fidelizacion'),
    ('degradar_vip',                    '(select vm.negocio_id from public.vip_miembro vm where vm.id = p_vip_miembro_id)',    'fidelizacion'),
    ('sembrar_niveles_vip_default',     'p_negocio_id',                                                                       'fidelizacion')
  ) as x(fn, expr, clave)
  loop
    select p.oid into v_oid from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname = r.fn;
    if v_oid is null then raise exception 'Funcion no encontrada: %', r.fn; end if;
    v_def := pg_get_functiondef(v_oid);
    if position('FUNCION_NO_INCLUIDA' in v_def) > 0 then continue; end if;   -- idempotente
    v_check := format(E'    if not public.negocio_tiene_funcion(%s, %L) then raise exception ''FUNCION_NO_INCLUIDA''; end if;\n', r.expr, r.clave);
    v_nuevo := regexp_replace(v_def, E'\nbegin\n', E'\nbegin\n' || replace(v_check, '\', '\\'));
    if v_nuevo = v_def then raise exception 'No se pudo parchear %', r.fn; end if;
    execute v_nuevo;
  end loop;
end $$;

-- B) congelar_membresia sin carrera ----------------------------------------------------------------------------------
do $$
declare v_def text; v_nuevo text;
begin
  v_def := pg_get_functiondef('public.congelar_membresia(uuid, integer)'::regprocedure);
  if position('for update' in lower(v_def)) = 0 then
    v_nuevo := replace(v_def, 'from public.cliente_membresia where id = p_cliente_membresia_id;', 'from public.cliente_membresia where id = p_cliente_membresia_id for update;');
    if v_nuevo = v_def then raise exception 'No se pudo parchear congelar_membresia'; end if;
    execute v_nuevo;
  end if;
end $$;

-- C) crear_pago_sena idempotente bajo concurrencia -------------------------------------------------------------------
do $$
declare v_def text; v_nuevo text;
begin
  v_def := pg_get_functiondef('public.crear_pago_sena(uuid)'::regprocedure);
  if position('pg_advisory_xact_lock' in v_def) = 0 then
    v_nuevo := regexp_replace(v_def, E'\nbegin\n', E'\nbegin\n  -- Serializa por reserva: dos llamadas simultaneas no crean dos pagos PENDIENTE.\n  perform pg_advisory_xact_lock(hashtextextended(''sena:'' || p_reserva_id::text, 0));\n');
    if v_nuevo = v_def then raise exception 'No se pudo parchear crear_pago_sena'; end if;
    execute v_nuevo;
  end if;
end $$;

-- D) negocio: columnas sensibles fuera del alcance de anon --------------------------------------------------------------
-- anon: sin NIT, comision, id del dueño ni contacto privado. authenticated: sin NIT ni comision (el panel del dueño no los lee).
do $$
declare v_cols_anon text; v_cols_auth text;
begin
  select string_agg(quote_ident(column_name), ', ' order by ordinal_position) into v_cols_anon
    from information_schema.columns where table_schema = 'public' and table_name = 'negocio'
     and column_name not in ('identificacion_fiscal', 'comision_plataforma_pct', 'owner_user_id', 'email_contacto', 'telefono_contacto');
  select string_agg(quote_ident(column_name), ', ' order by ordinal_position) into v_cols_auth
    from information_schema.columns where table_schema = 'public' and table_name = 'negocio'
     and column_name not in ('identificacion_fiscal', 'comision_plataforma_pct');
  execute 'revoke select on public.negocio from anon';
  execute format('grant select (%s) on public.negocio to anon', v_cols_anon);
  execute 'revoke select on public.negocio from authenticated';
  execute format('grant select (%s) on public.negocio to authenticated', v_cols_auth);
end $$;

-- E) Familias: politicas sin recursion ----------------------------------------------------------------------------------
create or replace function public._familia_titular(p_familia_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.familia_grupo g where g.id = p_familia_id and g.titular_cliente_id = auth.uid());
$$;
create or replace function public._familia_miembro(p_familia_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.familia_miembro m where m.familia_id = p_familia_id and m.cliente_id = auth.uid());
$$;
revoke all on function public._familia_titular(uuid) from public, anon, authenticated;
revoke all on function public._familia_miembro(uuid) from public, anon, authenticated;
grant execute on function public._familia_titular(uuid) to authenticated;
grant execute on function public._familia_miembro(uuid) to authenticated;

drop policy if exists familia_grupo_select on public.familia_grupo;
create policy familia_grupo_select on public.familia_grupo for select to authenticated
  using (titular_cliente_id = auth.uid() or public._familia_miembro(id)
         or (negocio_id is not null and public.tiene_acceso_interno(negocio_id)) or public.is_supersu());
drop policy if exists familia_miembro_select on public.familia_miembro;
create policy familia_miembro_select on public.familia_miembro for select to authenticated
  using (cliente_id = auth.uid() or public._familia_titular(familia_id) or public.is_supersu());

-- F) Higiene ------------------------------------------------------------------------------------------------------------
alter function public.set_updated_at() set search_path = public;
alter function public.proteger_precio_servicio() set search_path = public;
alter function public.perfil_proteger_columnas_sensibles() set search_path = public;

-- avatars: los archivos se siguen sirviendo por URL publica (bucket publico); ya no se puede LISTAR la carpeta de otros.
drop policy if exists avatars_select_publico on storage.objects;
drop policy if exists avatars_select_propio on storage.objects;
create policy avatars_select_propio on storage.objects for select to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (auth.uid())::text);

update storage.buckets set allowed_mime_types = array['image/png', 'image/jpeg', 'image/webp', 'application/pdf']
 where id = 'soporte-adjuntos' and allowed_mime_types is null;

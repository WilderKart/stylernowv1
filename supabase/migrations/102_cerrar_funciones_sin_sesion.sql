-- 102 — P0 de seguridad: ninguna función privilegiada queda ejecutable sin sesión.
--
-- Hallazgo: 178 funciones SECURITY DEFINER eran ejecutables por `anon` (Postgres concede EXECUTE a PUBLIC por
-- defecto). 12 escribían datos SIN validar quién llamaba; entre ellas las 9 `_pipeline_*`, que otorgan
-- cashback, puntos, sellos y referidos a partir de un evento JSON arbitrario: cualquiera con la clave pública
-- podía invocarlas.
--
-- Se mantienen abiertas a `anon` SOLO: (a) las funciones que usan páginas públicas o el login antes de tener
-- sesión, y (b) las que citan las políticas RLS (se evalúan con el rol del llamante). Las demás pasan a
-- `authenticated` + `service_role`; las `_pipeline_*` quedan solo para `service_role` (las llaman otras
-- funciones del sistema, que corren como dueño y no necesitan el permiso).
-- Los GRANT a public / anon / authenticated son independientes: se revocan los tres explícitamente.
-- Reversible: `grant execute on function … to anon` para la función que hiciera falta.
do $$
declare
  r record;
  v_pol text;
  v_publicas text[] := array[
    'marketplace_buscar','marketplace_buscar_filtrado','marketplace_ciudades_disponibles',
    'negocio_resenas_publicas','negocio_staff_publico','staff_perfil_publico','staff_resenas_publicas',
    'registrar_clic_patrocinado','registrar_impresion_patrocinada','registrar_visita_perfil',
    'registrar_intento_auth','verificar_rate_limit_auth','slots_disponibles',
    'fundador_cupos_restantes','negocio_puede_recibir_reservas','negocio_visible_en_mapa',
    'estado_sistema','incrementar_session_version'
  ];
  v_cerradas int := 0; v_internas int := 0;
begin
  select string_agg(coalesce(qual, '') || ' ' || coalesce(with_check, ''), ' ') into v_pol
    from pg_policies where schemaname in ('public', 'storage');

  for r in
    select p.oid, p.proname, pg_get_function_identity_arguments(p.oid) as args
    from pg_proc p
    where p.pronamespace = 'public'::regnamespace and p.prokind = 'f' and p.prosecdef
      and p.prorettype <> 'trigger'::regtype
      and has_function_privilege('anon', p.oid, 'execute')
      and p.proname <> all (v_publicas)
      and v_pol !~ ('\m' || p.proname || '\(')
  loop
    if r.proname like '\_%' then
      execute format('revoke all on function public.%I(%s) from public, anon, authenticated', r.proname, r.args);
      execute format('grant execute on function public.%I(%s) to service_role', r.proname, r.args);
      v_internas := v_internas + 1;
    else
      execute format('revoke all on function public.%I(%s) from public, anon', r.proname, r.args);
      execute format('grant execute on function public.%I(%s) to authenticated, service_role', r.proname, r.args);
      v_cerradas := v_cerradas + 1;
    end if;
  end loop;
  raise notice 'funciones cerradas a anon: %, internas solo service_role: %', v_cerradas, v_internas;
end $$;

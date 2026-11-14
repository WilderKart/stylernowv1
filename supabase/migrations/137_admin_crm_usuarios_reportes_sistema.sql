-- 137 · CRM del Super Admin con información real (pedido del propietario, 2026-11-14).
-- Funciones de solo lectura para: Usuarios, Buscador global, Reportes por rango de fechas,
-- Estado del sistema, Comisiones y Marketing; y el registro auditado de acciones sobre usuarios.
-- Todas: SECURITY DEFINER, search_path fijo, exigen is_supersu() y solo `authenticated` puede invocarlas
-- (el guard interno rechaza a cualquiera que no sea Super Admin). Nada de anon ni public.

-- ── Usuarios: listado con roles derivados de los datos reales ───────────────────────────────
create or replace function public.admin_usuarios_listar(
  p_q text default null, p_rol text default null, p_limite int default 50, p_offset int default 0)
 returns jsonb
 language plpgsql stable security definer
 set search_path to 'public'
as $function$
declare v_q text; v_total int; v_filas jsonb;
begin
  if not coalesce(public.is_supersu(), false) then raise exception 'NO_AUTORIZADO'; end if;
  p_limite := least(greatest(coalesce(p_limite, 50), 1), 200);
  p_offset := greatest(coalesce(p_offset, 0), 0);
  v_q := nullif(btrim(coalesce(p_q, '')), '');
  if v_q is not null then
    v_q := '%' || replace(replace(replace(left(v_q, 80), '\', '\\'), '%', '\%'), '_', '\_') || '%';
  end if;

  with base as (
    select p.id, p.nombre, coalesce(u.email, p.email) email, p.telefono, p.telefono_verificado, p.pais,
           p.es_supersu, p.registro_pendiente, p.created_at, u.last_sign_in_at, u.banned_until,
           coalesce(u.raw_app_meta_data->>'provider', 'email') proveedor,
           (select count(*) from public.negocio n where n.owner_user_id = p.id) negocios,
           (select count(*) from public.vinculo_staff_negocio v where v.staff_id = p.id and v.estado in ('ACTIVO','INVITADO')) vinculos,
           (select count(*) from public.reserva r where r.cliente_id = p.id) reservas
    from public.perfil p
    left join auth.users u on u.id = p.id
    where v_q is null or p.nombre ilike v_q or coalesce(u.email, p.email) ilike v_q or coalesce(p.telefono, '') ilike v_q
  ), filtrado as (
    select b.*,
      case when b.es_supersu then 'SUPERSU' when b.negocios > 0 then 'NEGOCIO' when b.vinculos > 0 then 'STAFF' else 'CLIENTE' end rol,
      (b.banned_until is not null and b.banned_until > now()) suspendido
    from base b
  ), elegido as (
    select * from filtrado f
    where p_rol is null or p_rol = ''
       or (p_rol = 'SUSPENDIDO' and f.suspendido)
       or (p_rol = 'PENDIENTE' and f.registro_pendiente)
       or f.rol = p_rol
  )
  select (select count(*) from elegido),
         coalesce((select jsonb_agg(to_jsonb(e) - 'banned_until' order by e.created_at desc)
                   from (select * from elegido order by created_at desc limit p_limite offset p_offset) e), '[]'::jsonb)
    into v_total, v_filas;

  return jsonb_build_object(
    'total', v_total,
    'filas', v_filas,
    'conteo', (select jsonb_build_object(
        'todos', count(*),
        'supersu', count(*) filter (where p.es_supersu),
        'negocio', count(*) filter (where not p.es_supersu and exists (select 1 from public.negocio n where n.owner_user_id = p.id)),
        'staff', count(*) filter (where not p.es_supersu and not exists (select 1 from public.negocio n where n.owner_user_id = p.id)
                                   and exists (select 1 from public.vinculo_staff_negocio v where v.staff_id = p.id and v.estado in ('ACTIVO','INVITADO'))),
        'suspendido', count(*) filter (where u.banned_until > now()),
        'pendiente', count(*) filter (where p.registro_pendiente))
      from public.perfil p left join auth.users u on u.id = p.id)
  );
end
$function$;

-- ── Usuarios: ficha completa ───────────────────────────────────────────────────────────────
create or replace function public.admin_usuario_detalle(p_id uuid)
 returns jsonb
 language plpgsql stable security definer
 set search_path to 'public'
as $function$
declare v jsonb;
begin
  if not coalesce(public.is_supersu(), false) then raise exception 'NO_AUTORIZADO'; end if;
  select jsonb_build_object(
    'id', p.id, 'nombre', p.nombre, 'email', coalesce(u.email, p.email), 'telefono', p.telefono,
    'telefono_verificado', p.telefono_verificado, 'pais', p.pais, 'locale', p.locale,
    'es_supersu', p.es_supersu, 'registro_pendiente', p.registro_pendiente,
    'consentimiento_datos_at', p.consentimiento_datos_at, 'consentimiento_marketing', p.consentimiento_marketing,
    'created_at', p.created_at, 'last_sign_in_at', u.last_sign_in_at, 'email_confirmado', u.email_confirmed_at is not null,
    'proveedor', coalesce(u.raw_app_meta_data->>'provider', 'email'),
    'suspendido', (u.banned_until is not null and u.banned_until > now()),
    'negocios', coalesce((select jsonb_agg(jsonb_build_object('id', n.id, 'nombre', n.nombre, 'slug', n.slug, 'estado', n.estado,
                          'plan', n.plan_codigo, 'ciudad', n.ciudad) order by n.created_at)
                          from public.negocio n where n.owner_user_id = p.id), '[]'::jsonb),
    'vinculos', coalesce((select jsonb_agg(jsonb_build_object('negocio', n.nombre, 'estado', v.estado, 'guardian', v.es_guardian,
                          'desde', v.fecha_ingreso) order by v.created_at)
                          from public.vinculo_staff_negocio v join public.negocio n on n.id = v.negocio_id
                          where v.staff_id = p.id), '[]'::jsonb),
    'reservas_total', (select count(*) from public.reserva r where r.cliente_id = p.id),
    'reservas', coalesce((select jsonb_agg(x order by x->>'hora_inicio' desc) from (
                          select jsonb_build_object('id', r.id, 'negocio', n.nombre, 'hora_inicio', r.hora_inicio,
                                 'estado', r.estado, 'monto_total', r.monto_total) x
                          from public.reserva r join public.negocio n on n.id = r.negocio_id
                          where r.cliente_id = p.id order by r.hora_inicio desc limit 10) s), '[]'::jsonb),
    'eventos', coalesce((select jsonb_agg(x order by x->>'created_at' desc) from (
                          select jsonb_build_object('accion', e.accion, 'entidad', e.entidad_tipo, 'motivo', e.motivo,
                                 'created_at', e.created_at) x
                          from public.evento_auditoria e
                          where e.actor_id = p.id or (e.entidad_tipo in ('perfil','usuario') and e.entidad_id = p.id)
                          order by e.created_at desc limit 15) s), '[]'::jsonb)
  ) into v
  from public.perfil p left join auth.users u on u.id = p.id
  where p.id = p_id;
  if v is null then raise exception 'USUARIO_NO_ENCONTRADO'; end if;
  return v;
end
$function$;

-- ── Usuarios: registro auditado de acciones (la suspensión real la hace el servidor con Auth) ─
create or replace function public.admin_usuario_registrar_accion(p_id uuid, p_accion text, p_motivo text)
 returns void
 language plpgsql security definer
 set search_path to 'public'
as $function$
begin
  if not coalesce(public.is_supersu(), false) then raise exception 'NO_AUTORIZADO'; end if;
  if p_accion not in ('USUARIO_SUSPENDIDO', 'USUARIO_REACTIVADO', 'USUARIO_SESIONES_CERRADAS') then
    raise exception 'ACCION_INVALIDA';
  end if;
  if length(btrim(coalesce(p_motivo, ''))) < 5 then raise exception 'MOTIVO_REQUERIDO'; end if;
  if p_id = auth.uid() then raise exception 'NO_SOBRE_SI_MISMO'; end if;
  if coalesce((select es_supersu from public.perfil where id = p_id), false) then raise exception 'NO_SOBRE_SUPERSU'; end if;
  if not exists (select 1 from public.perfil where id = p_id) then raise exception 'USUARIO_NO_ENCONTRADO'; end if;

  if p_accion = 'USUARIO_SESIONES_CERRADAS' or p_accion = 'USUARIO_SUSPENDIDO' then
    update public.perfil set session_version = session_version + 1 where id = p_id;
    -- Revoca las sesiones reales (y en cascada sus refresh tokens): el usuario no puede renovar su acceso;
    -- el token de acceso vigente caduca solo (máx. 1 h).
    delete from auth.sessions where user_id = p_id;
  end if;

  insert into public.evento_auditoria (entidad_tipo, entidad_id, accion, actor_tipo, actor_id, motivo)
  values ('usuario', p_id, p_accion, 'SUPERSU', auth.uid(), btrim(p_motivo));
end
$function$;

-- ── Buscador global ────────────────────────────────────────────────────────────────────────
create or replace function public.admin_buscar(p_q text)
 returns jsonb
 language plpgsql stable security definer
 set search_path to 'public'
as $function$
declare v_q text; v_id uuid;
begin
  if not coalesce(public.is_supersu(), false) then raise exception 'NO_AUTORIZADO'; end if;
  if length(btrim(coalesce(p_q, ''))) < 2 then return jsonb_build_object('negocios', '[]'::jsonb, 'usuarios', '[]'::jsonb, 'reservas', '[]'::jsonb); end if;
  v_q := '%' || replace(replace(replace(left(btrim(p_q), 80), '\', '\\'), '%', '\%'), '_', '\_') || '%';
  begin v_id := btrim(p_q)::uuid; exception when others then v_id := null; end;

  return jsonb_build_object(
    'negocios', coalesce((select jsonb_agg(x) from (
        select jsonb_build_object('id', n.id, 'nombre', n.nombre, 'detalle', concat_ws(' · ', n.ciudad, n.estado::text, n.plan_codigo::text)) x
        from public.negocio n
        where n.nombre ilike v_q or n.slug ilike v_q or coalesce(n.email_contacto, '') ilike v_q or n.id = v_id
        order by n.created_at desc limit 6) s), '[]'::jsonb),
    'usuarios', coalesce((select jsonb_agg(x) from (
        select jsonb_build_object('id', p.id, 'nombre', p.nombre, 'detalle', coalesce(u.email, p.email)) x
        from public.perfil p left join auth.users u on u.id = p.id
        where p.nombre ilike v_q or coalesce(u.email, p.email) ilike v_q or coalesce(p.telefono, '') ilike v_q or p.id = v_id
        order by p.created_at desc limit 6) s), '[]'::jsonb),
    'reservas', coalesce((select jsonb_agg(x) from (
        select jsonb_build_object('id', r.id, 'nombre', n.nombre,
               'detalle', concat_ws(' · ', to_char(r.hora_inicio at time zone 'America/Bogota', 'DD/MM/YYYY HH24:MI'), r.estado::text)) x
        from public.reserva r join public.negocio n on n.id = r.negocio_id
        where r.id = v_id or r.id::text ilike (btrim(p_q) || '%')
        order by r.created_at desc limit 6) s), '[]'::jsonb)
  );
end
$function$;

-- ── Reportes por rango de fechas ───────────────────────────────────────────────────────────
create or replace function public.admin_reporte(p_desde timestamptz, p_hasta timestamptz)
 returns jsonb
 language plpgsql stable security definer
 set search_path to 'public'
as $function$
begin
  if not coalesce(public.is_supersu(), false) then raise exception 'NO_AUTORIZADO'; end if;
  if p_desde is null or p_hasta is null or p_hasta <= p_desde then raise exception 'RANGO_INVALIDO'; end if;
  if p_hasta - p_desde > interval '400 days' then raise exception 'RANGO_DEMASIADO_LARGO'; end if;

  return jsonb_build_object(
    'reservas', (select jsonb_build_object(
        'total', count(*),
        'completadas', count(*) filter (where estado = 'COMPLETADA'),
        'canceladas', count(*) filter (where estado = 'CANCELADA'),
        'no_show', count(*) filter (where estado = 'NO_SHOW'),
        'confirmadas', count(*) filter (where estado in ('CONFIRMADA','EN_CURSO')),
        'pendientes_pago', count(*) filter (where estado = 'PENDIENTE_PAGO'),
        'valor_completadas', coalesce(sum(monto_total) filter (where estado = 'COMPLETADA'), 0),
        'ticket_promedio', coalesce(round(avg(monto_total) filter (where estado = 'COMPLETADA')), 0))
      from public.reserva where created_at >= p_desde and created_at < p_hasta),
    'serie', coalesce((select jsonb_agg(jsonb_build_object('dia', d.dia, 'reservas', d.reservas, 'completadas', d.completadas,
                                                             'canceladas', d.canceladas, 'usuarios', d.usuarios) order by d.dia)
      from (
        select g.dia::date dia, coalesce(r.reservas, 0) reservas, coalesce(r.completadas, 0) completadas,
               coalesce(r.canceladas, 0) canceladas, coalesce(u.usuarios, 0) usuarios
        from generate_series((p_desde at time zone 'America/Bogota')::date, ((p_hasta - interval '1 second') at time zone 'America/Bogota')::date, interval '1 day') g(dia)
        left join (
          select (created_at at time zone 'America/Bogota')::date dia, count(*) reservas,
                 count(*) filter (where estado = 'COMPLETADA') completadas,
                 count(*) filter (where estado in ('CANCELADA','NO_SHOW')) canceladas
          from public.reserva where created_at >= p_desde and created_at < p_hasta group by 1) r on r.dia = g.dia::date
        left join (
          select (created_at at time zone 'America/Bogota')::date dia, count(*) usuarios
          from public.perfil where created_at >= p_desde and created_at < p_hasta group by 1) u on u.dia = g.dia::date
      ) d), '[]'::jsonb),
    'usuarios_nuevos', (select count(*) from public.perfil where created_at >= p_desde and created_at < p_hasta),
    'negocios_nuevos', (select count(*) from public.negocio where created_at >= p_desde and created_at < p_hasta),
    'pagos', (select jsonb_build_object(
        'aprobados', count(*) filter (where estado = 'APROBADO'),
        'monto_aprobado', coalesce(sum(monto) filter (where estado = 'APROBADO'), 0),
        'monto_reservas', coalesce(sum(monto) filter (where estado = 'APROBADO' and tipo in ('SENA','SALDO','PROPINA')), 0),
        'monto_suscripciones', coalesce(sum(monto) filter (where estado = 'APROBADO' and tipo = 'SUSCRIPCION'), 0),
        'reembolsado', coalesce(sum(monto_reembolsado), 0),
        'comision_plataforma', coalesce(sum(comision_plataforma_monto) filter (where estado = 'APROBADO'), 0),
        'rechazados', count(*) filter (where estado = 'RECHAZADO'))
      from public.pago where created_at >= p_desde and created_at < p_hasta and coalesce(entorno, 'produccion') <> 'sandbox'),
    'top_negocios', coalesce((select jsonb_agg(x) from (
        select jsonb_build_object('id', n.id, 'nombre', n.nombre, 'ciudad', n.ciudad, 'reservas', count(r.id),
               'completadas', count(r.id) filter (where r.estado = 'COMPLETADA'),
               'valor', coalesce(sum(r.monto_total) filter (where r.estado = 'COMPLETADA'), 0)) x
        from public.reserva r join public.negocio n on n.id = r.negocio_id
        where r.created_at >= p_desde and r.created_at < p_hasta
        group by n.id order by count(r.id) desc limit 10) s), '[]'::jsonb),
    'ciudades', coalesce((select jsonb_agg(x) from (
        select jsonb_build_object('ciudad', coalesce(n.ciudad, 'Sin ciudad'), 'reservas', count(r.id)) x
        from public.reserva r join public.negocio n on n.id = r.negocio_id
        where r.created_at >= p_desde and r.created_at < p_hasta
        group by coalesce(n.ciudad, 'Sin ciudad') order by count(r.id) desc limit 10) s), '[]'::jsonb),
    'suscripciones', coalesce((select jsonb_object_agg(estado, c) from (
        select estado::text, count(*) c from public.suscripcion group by estado) s), '{}'::jsonb),
    'planes', coalesce((select jsonb_object_agg(plan_codigo, c) from (
        select plan_codigo::text, count(*) c from public.suscripcion where estado in ('ACTIVA','TRIAL','EN_MORA') group by plan_codigo) s), '{}'::jsonb)
  );
end
$function$;

-- ── Estado del sistema (lo que la base sabe: avisos, webhooks, auditoría) ─────────────────────
create or replace function public.admin_estado_sistema()
 returns jsonb
 language plpgsql stable security definer
 set search_path to 'public'
as $function$
begin
  if not coalesce(public.is_supersu(), false) then raise exception 'NO_AUTORIZADO'; end if;
  return jsonb_build_object(
    'notificaciones', (select jsonb_build_object(
        'pendientes', count(*) filter (where estado in ('PENDIENTE','PROCESANDO','REINTENTANDO')),
        'fallidas_24h', count(*) filter (where estado = 'FALLIDO' and updated_at > now() - interval '24 hours'),
        'enviadas_24h', count(*) filter (where enviado_at > now() - interval '24 hours'),
        'ultimo_envio', max(enviado_at),
        'ultimo_error', (select ultimo_error from public.notificacion_outbox where ultimo_error is not null order by updated_at desc limit 1))
      from public.notificacion_outbox),
    'webhooks', (select jsonb_build_object(
        'recibidos_24h', count(*) filter (where recibido_at > now() - interval '24 hours'),
        'errores_24h', count(*) filter (where recibido_at > now() - interval '24 hours' and (error is not null or resultado ilike '%error%' or resultado ilike '%rechaz%')),
        'sin_procesar', count(*) filter (where procesado_at is null and recibido_at < now() - interval '10 minutes'),
        'ultimo', max(recibido_at))
      from public.webhook_evento),
    'pagos', (select jsonb_build_object(
        'pendientes_viejos', count(*) filter (where estado = 'PENDIENTE' and created_at < now() - interval '1 hour'),
        'huerfanos', count(*) filter (where es_huerfano))
      from public.pago),
    'auditoria', (select jsonb_build_object('ultimo', max(created_at), 'eventos_24h', count(*) filter (where created_at > now() - interval '24 hours'))
      from public.evento_auditoria),
    'base', jsonb_build_object('tamano', pg_size_pretty(pg_database_size(current_database())), 'hora', now())
  );
end
$function$;

-- ── Comisiones (la comisión vigente se edita en Reglas; aquí se ve el estado real) ───────────
create or replace function public.admin_comisiones_resumen()
 returns jsonb
 language plpgsql stable security definer
 set search_path to 'public'
as $function$
begin
  if not coalesce(public.is_supersu(), false) then raise exception 'NO_AUTORIZADO'; end if;
  return jsonb_build_object(
    'distribucion', coalesce((select jsonb_agg(jsonb_build_object('pct', pct, 'negocios', c) order by pct) from (
        select coalesce(comision_plataforma_pct, 0) pct, count(*) c from public.negocio group by 1) s), '[]'::jsonb),
    'programadas', coalesce((select jsonb_agg(x order by x->>'efectivo_desde' desc) from (
        select jsonb_build_object('id', c.id, 'negocio', n.nombre, 'pct', c.pct_nuevo, 'efectivo_desde', c.efectivo_desde,
               'motivo', c.motivo, 'aplicado_at', c.aplicado_at, 'anulado_at', c.anulado_at, 'afectados', c.negocios_afectados,
               'created_at', c.created_at) x
        from public.comision_cambio_programado c left join public.negocio n on n.id = c.negocio_id
        order by c.created_at desc limit 50) s), '[]'::jsonb),
    'cobrado', (select jsonb_build_object(
        'mes', coalesce(sum(comision_plataforma_monto) filter (where created_at >= date_trunc('month', now())), 0),
        'total', coalesce(sum(comision_plataforma_monto), 0),
        'pagos_con_comision', count(*) filter (where coalesce(comision_plataforma_monto, 0) > 0))
      from public.pago where estado = 'APROBADO' and coalesce(entorno, 'produccion') <> 'sandbox'),
    'por_negocio', coalesce((select jsonb_agg(x) from (
        select jsonb_build_object('nombre', n.nombre, 'pct', n.comision_plataforma_pct, 'cobrado', coalesce(sum(p.comision_plataforma_monto), 0)) x
        from public.negocio n left join public.pago p on p.negocio_id = n.id and p.estado = 'APROBADO'
        where coalesce(n.comision_plataforma_pct, 0) > 0
        group by n.id order by coalesce(sum(p.comision_plataforma_monto), 0) desc limit 20) s), '[]'::jsonb)
  );
end
$function$;

-- ── Marketing: audiencia con consentimiento y envíos reales ─────────────────────────────────
create or replace function public.admin_marketing_resumen()
 returns jsonb
 language plpgsql stable security definer
 set search_path to 'public'
as $function$
begin
  if not coalesce(public.is_supersu(), false) then raise exception 'NO_AUTORIZADO'; end if;
  return jsonb_build_object(
    'audiencia', (select jsonb_build_object(
        'total', count(*),
        'con_consentimiento', count(*) filter (where consentimiento_marketing),
        'con_telefono_verificado', count(*) filter (where consentimiento_marketing and telefono_verificado),
        'por_pais', coalesce((select jsonb_object_agg(coalesce(pais, 'SIN_PAIS'), c) from (
            select pais, count(*) c from public.perfil where consentimiento_marketing group by pais) s), '{}'::jsonb))
      from public.perfil where not es_supersu),
    'envios_30d', coalesce((select jsonb_agg(jsonb_build_object('canal', canal, 'categoria', categoria, 'enviados', enviados,
                                                               'fallidos', fallidos, 'pendientes', pendientes) order by enviados desc) from (
        select canal, categoria, count(*) filter (where enviado_at is not null) enviados,
               count(*) filter (where estado = 'FALLIDO') fallidos,
               count(*) filter (where estado in ('PENDIENTE','PROCESANDO','REINTENTANDO')) pendientes
        from public.notificacion_outbox where created_at > now() - interval '30 days' group by canal, categoria) s), '[]'::jsonb),
    'leidas_30d', (select jsonb_build_object('enviadas', count(*), 'leidas', count(*) filter (where leido_at is not null))
      from public.notificacion_envio where enviado_at > now() - interval '30 days')
  );
end
$function$;

do $$
declare f text;
begin
  foreach f in array array[
    'public.admin_usuarios_listar(text, text, int, int)',
    'public.admin_usuario_detalle(uuid)',
    'public.admin_usuario_registrar_accion(uuid, text, text)',
    'public.admin_buscar(text)',
    'public.admin_reporte(timestamptz, timestamptz)',
    'public.admin_estado_sistema()',
    'public.admin_comisiones_resumen()',
    'public.admin_marketing_resumen()'
  ] loop
    execute format('revoke all on function %s from public, anon, authenticated', f);
    execute format('grant execute on function %s to authenticated, service_role', f);
  end loop;
end $$;

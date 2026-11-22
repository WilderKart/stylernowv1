-- 148 — Fase 3: invitación de Staff, autorizaciones del profesional y visibilidad pública.
--
-- Decisiones del propietario (2026-11-16): A un solo vínculo activo; C invitación con un botón sin
-- revelar públicamente si un correo existe; D transición de 30 días para el Staff existente, sin
-- consentimientos retroactivos; E quien no tiene publicación vigente no recibe reservas por
-- asignación automática pero conserva sus funciones internas. Textos de Staff = BORRADORES.

-- ── Textos de autorización del Staff (borradores, pendientes de validación jurídica) ──────────
alter table public.texto_legal add column if not exists estado_juridico text not null default 'VIGENTE';
alter table public.texto_legal drop constraint if exists texto_legal_estado_juridico_chk;
alter table public.texto_legal add constraint texto_legal_estado_juridico_chk check (estado_juridico in ('VIGENTE', 'BORRADOR'));
do $$
declare r record;
begin
  for r in select conname from pg_constraint where conrelid = 'public.texto_legal'::regclass and contype = 'c'
           and pg_get_constraintdef(oid) ilike '%tipo%' loop
    execute format('alter table public.texto_legal drop constraint %I', r.conname);
  end loop;
end $$;
alter table public.texto_legal add constraint texto_legal_tipo_check check (tipo in
  ('TERMINOS', 'POLITICA_DATOS', 'AUTORIZACION_STAFF_TRATAMIENTO', 'AUTORIZACION_STAFF_PUBLICACION'));

insert into public.texto_legal (tipo, version, contenido, cambio_material, estado_juridico)
select 'AUTORIZACION_STAFF_TRATAMIENTO', 1,
  'Autorizo a StylerNow y a {negocio} a tratar mis datos personales (nombre, correo, celular y perfil profesional) para gestionar mi vínculo como profesional, mi agenda, mis turnos y mis comisiones, según la Política de Tratamiento de Datos. Puedo retirar esta autorización desde mi perfil.',
  false, 'BORRADOR'
where not exists (select 1 from public.texto_legal where tipo = 'AUTORIZACION_STAFF_TRATAMIENTO');
insert into public.texto_legal (tipo, version, contenido, cambio_material, estado_juridico)
select 'AUTORIZACION_STAFF_PUBLICACION', 1,
  'Autorizo a StylerNow y a {negocio} a publicar mi nombre, foto, especialidad y descripción en el perfil del negocio dentro de StylerNow para que los clientes me encuentren y reserven conmigo. Puedo retirar esta autorización desde mi perfil; al hacerlo, mi perfil deja de mostrarse.',
  false, 'BORRADOR'
where not exists (select 1 from public.texto_legal where tipo = 'AUTORIZACION_STAFF_PUBLICACION');

-- ── Transición de 30 días para el Staff que ya existía (decisión D) ─────────────────────────
alter table public.configuracion_plataforma add column if not exists staff_transicion_inicio timestamptz;
alter table public.configuracion_plataforma add column if not exists staff_transicion_fin timestamptz;
update public.configuracion_plataforma
   set staff_transicion_inicio = coalesce(staff_transicion_inicio, now()),
       staff_transicion_fin = coalesce(staff_transicion_fin, now() + interval '30 days');

-- Los BORRADORES no entran por `registrar_aceptacion_legal` (solo textos VIGENTES): el Staff los
-- acepta únicamente por `autorizar_staff`, que deja el texto exacto con el sufijo «-borrador».
do $$
declare v_def text;
begin
  v_def := pg_get_functiondef('public.registrar_aceptacion_legal(uuid[], text, text)'::regprocedure);
  if position('    and (p_tipo = ''EXPRESA'' or t.cambio_material = false)' in v_def) = 0 then
    raise exception 'ANCLA_NO_ENCONTRADA registrar_aceptacion_legal';
  end if;
  if position('t.estado_juridico = ''VIGENTE''' in v_def) = 0 then
    v_def := replace(v_def, '    and (p_tipo = ''EXPRESA'' or t.cambio_material = false)',
      '    and (p_tipo = ''EXPRESA'' or t.cambio_material = false)' || chr(10) || '    and t.estado_juridico = ''VIGENTE''');
    execute v_def;
  end if;
end $$;

-- ── Estado vigente de una autorización del Staff (último evento del repositorio) ────────────
create or replace function public._staff_ultima_autorizacion(p_staff uuid, p_negocio uuid, p_documento text)
returns public.evidencia_legal language sql stable security definer set search_path = public as $$
  select e.* from public.evidencia_legal e
   where e.usuario_id = p_staff and e.negocio_id = p_negocio and e.documento = p_documento
   order by e.secuencia desc limit 1;
$$;
revoke all on function public._staff_ultima_autorizacion(uuid, uuid, text) from public, anon, authenticated;

-- ¿Puede mostrarse al público y recibir reservas públicas?
--  · Con foto y autorización de publicación vigente (último evento = ACEPTA), o
--  · durante la transición, si su vínculo ya existía al iniciarla y no retiró la publicación.
create or replace function public.staff_es_publicable(p_staff uuid, p_negocio uuid)
returns boolean language plpgsql stable security definer set search_path = public as $$
declare
  v_foto text;
  v_pub public.evidencia_legal;
  v_cfg public.configuracion_plataforma;
  v_vinculo_desde timestamptz;
begin
  select s.foto_url into v_foto from public.staff s where s.usuario_id = p_staff;
  v_pub := public._staff_ultima_autorizacion(p_staff, p_negocio, 'AUTORIZACION_STAFF_PUBLICACION');
  if v_foto is not null and v_pub.accion = 'ACEPTA' then return true; end if;
  if v_pub.accion = 'REVOCA' then return false; end if;
  select * into v_cfg from public.configuracion_plataforma limit 1;
  if v_cfg.staff_transicion_fin is null or now() >= v_cfg.staff_transicion_fin then return false; end if;
  select min(v.created_at) into v_vinculo_desde from public.vinculo_staff_negocio v
   where v.staff_id = p_staff and v.negocio_id = p_negocio;
  return v_vinculo_desde is not null and v_vinculo_desde < v_cfg.staff_transicion_inicio;
end $$;
revoke all on function public.staff_es_publicable(uuid, uuid) from public, anon, authenticated;
grant execute on function public.staff_es_publicable(uuid, uuid) to anon, authenticated;

-- ── Otorgar / retirar autorizaciones (solo el titular; negocio derivado de SU vínculo) ──────
create or replace function public.autorizar_staff(p_documento text, p_canal text default 'perfil')
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_vinculo public.vinculo_staff_negocio;
  v_negocio text;
  v_texto public.texto_legal;
  v_ultima public.evidencia_legal;
begin
  if v_uid is null then raise exception 'NO_AUTENTICADO'; end if;
  if p_documento not in ('AUTORIZACION_STAFF_TRATAMIENTO', 'AUTORIZACION_STAFF_PUBLICACION') then raise exception 'DOCUMENTO_INVALIDO'; end if;
  if p_canal not in ('invitacion', 'perfil') then raise exception 'CANAL_INVALIDO'; end if;
  select * into v_vinculo from public.vinculo_staff_negocio
   where staff_id = v_uid and estado <> 'RETIRADO' order by created_at desc limit 1;
  if not found then raise exception 'SIN_VINCULO'; end if;
  if p_documento = 'AUTORIZACION_STAFF_PUBLICACION'
     and coalesce((public._staff_ultima_autorizacion(v_uid, v_vinculo.negocio_id, 'AUTORIZACION_STAFF_TRATAMIENTO')).accion, '') <> 'ACEPTA' then
    raise exception 'REQUIERE_TRATAMIENTO';
  end if;
  v_ultima := public._staff_ultima_autorizacion(v_uid, v_vinculo.negocio_id, p_documento);
  if v_ultima.accion = 'ACEPTA' then return v_ultima.id; end if; -- idempotente
  select n.nombre into v_negocio from public.negocio n where n.id = v_vinculo.negocio_id;
  select * into v_texto from public.texto_legal where tipo = p_documento order by version desc limit 1;
  if not found then raise exception 'TEXTO_NO_DISPONIBLE'; end if;
  return public._registrar_evidencia(
    v_uid, v_vinculo.negocio_id, v_vinculo.sede_activa_id,
    case when p_documento = 'AUTORIZACION_STAFF_TRATAMIENTO' then 'TRATAMIENTO_DATOS' else 'CONSENTIMIENTO_ESPECIFICO' end,
    p_documento,
    case when p_documento = 'AUTORIZACION_STAFF_TRATAMIENTO' then 'Gestionar el vínculo profesional, la agenda, los turnos y las comisiones'
         else 'Publicar nombre, foto, especialidad y descripción en el perfil público del negocio' end,
    'ACEPTA', replace(v_texto.contenido, '{negocio}', coalesce(v_negocio, 'el negocio')),
    v_texto.version::text || case when v_texto.estado_juridico = 'BORRADOR' then '-borrador' else '' end,
    v_texto.id, p_canal, 'vinculo_staff_negocio', v_vinculo.id, null,
    'autorizacion_staff', gen_random_uuid()::text, clock_timestamp(), false,
    case when v_vinculo.es_guardian then 'GUARDIAN' else 'STAFF' end);
end $$;
revoke all on function public.autorizar_staff(text, text) from public, anon, authenticated;
grant execute on function public.autorizar_staff(text, text) to authenticated;

-- Retirar la PUBLICACIÓN (voluntaria, sin soporte). La revocación es un evento nuevo ligado al
-- otorgamiento: no borra ni cambia la aceptación anterior. Las reservas ya hechas no se tocan.
create or replace function public.revocar_publicacion_staff()
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_vinculo public.vinculo_staff_negocio;
  v_ultima public.evidencia_legal;
begin
  if v_uid is null then raise exception 'NO_AUTENTICADO'; end if;
  select * into v_vinculo from public.vinculo_staff_negocio
   where staff_id = v_uid and estado <> 'RETIRADO' order by created_at desc limit 1;
  if not found then raise exception 'SIN_VINCULO'; end if;
  v_ultima := public._staff_ultima_autorizacion(v_uid, v_vinculo.negocio_id, 'AUTORIZACION_STAFF_PUBLICACION');
  if v_ultima.accion = 'REVOCA' then return v_ultima.id; end if; -- idempotente
  return public._registrar_evidencia(
    v_uid, v_vinculo.negocio_id, v_vinculo.sede_activa_id, 'CONSENTIMIENTO_ESPECIFICO',
    'AUTORIZACION_STAFF_PUBLICACION', 'Publicar nombre, foto, especialidad y descripción en el perfil público del negocio',
    'REVOCA', null, null, null, 'perfil', 'vinculo_staff_negocio', v_vinculo.id, v_ultima.id,
    'autorizacion_staff', gen_random_uuid()::text, clock_timestamp(), false,
    case when v_vinculo.es_guardian then 'GUARDIAN' else 'STAFF' end);
end $$;
revoke all on function public.revocar_publicacion_staff() from public, anon, authenticated;
grant execute on function public.revocar_publicacion_staff() to authenticated;

-- Estado de autorizaciones: el propio profesional o el dueño de SU negocio (solo lectura).
create or replace function public.estado_autorizaciones_staff(p_negocio uuid)
returns table (staff_id uuid, nombre text, tiene_foto boolean,
               tratamiento text, tratamiento_at timestamptz,
               publicacion text, publicacion_at timestamptz, publicacion_evidencia uuid,
               publicable boolean, en_transicion boolean, transicion_fin timestamptz)
language plpgsql stable security definer set search_path = public as $$
declare v_cfg public.configuracion_plataforma;
begin
  if auth.uid() is null then raise exception 'NO_AUTENTICADO'; end if;
  if not (coalesce(public.is_barberia_de(p_negocio), false)
          or exists (select 1 from public.vinculo_staff_negocio v where v.negocio_id = p_negocio and v.staff_id = auth.uid() and v.estado <> 'RETIRADO')) then
    raise exception 'NO_AUTORIZADO';
  end if;
  select * into v_cfg from public.configuracion_plataforma limit 1;
  return query
  select v.staff_id, s.nombre, s.foto_url is not null,
         t.accion, t.ocurrido_at, p.accion, p.ocurrido_at, p.id,
         public.staff_es_publicable(v.staff_id, p_negocio),
         (v_cfg.staff_transicion_fin is not null and now() < v_cfg.staff_transicion_fin and v.created_at < v_cfg.staff_transicion_inicio),
         v_cfg.staff_transicion_fin
  from public.vinculo_staff_negocio v
  join public.staff s on s.usuario_id = v.staff_id
  left join lateral (select * from public._staff_ultima_autorizacion(v.staff_id, p_negocio, 'AUTORIZACION_STAFF_TRATAMIENTO')) t on true
  left join lateral (select * from public._staff_ultima_autorizacion(v.staff_id, p_negocio, 'AUTORIZACION_STAFF_PUBLICACION')) p on true
  where v.negocio_id = p_negocio and v.estado <> 'RETIRADO'
    -- El profesional (sin ser dueño) solo ve su propia fila.
    and (coalesce(public.is_barberia_de(p_negocio), false) or v.staff_id = auth.uid())
  order by s.nombre;
end $$;
revoke all on function public.estado_autorizaciones_staff(uuid) from public, anon, authenticated;
grant execute on function public.estado_autorizaciones_staff(uuid) to authenticated;

-- ── Invitación: datos mínimos para la pantalla de bienvenida (sin sesión) ───────────────────
-- Solo nombre del negocio, correo ENMASCARADO y estado. El id es un UUID que solo conoce quien
-- recibió el correo; no expone empleados, otras invitaciones ni datos privados del negocio.
create or replace function public.invitacion_publica(p_invitacion_id uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  i public.invitacion_staff;
  v_negocio text;
  v_usuario text;
  v_dominio text;
begin
  select * into i from public.invitacion_staff where id = p_invitacion_id;
  if not found then return null; end if;
  select n.nombre into v_negocio from public.negocio n where n.id = i.negocio_id;
  v_usuario := split_part(i.email, '@', 1);
  v_dominio := split_part(i.email, '@', 2);
  return jsonb_build_object(
    'negocio', v_negocio,
    'email_enmascarado', left(v_usuario, 2) || repeat('•', greatest(3, length(v_usuario) - 2)) || '@' || v_dominio,
    'estado', case when i.estado = 'PENDIENTE' and i.expira_at < now() then 'EXPIRADA' else i.estado end);
end $$;
revoke all on function public.invitacion_publica(uuid) from public, anon, authenticated;
grant execute on function public.invitacion_publica(uuid) to anon, authenticated;

-- Correo de la invitación y si ya tiene cuenta: SOLO el servidor (service_role). Lo usa la acción
-- «Continuar con mi invitación» para enrutar a registro o ingreso sin mostrarlo a terceros.
create or replace function public.invitacion_para_enrutar(p_invitacion_id uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'email', i.email,
    'estado', case when i.estado = 'PENDIENTE' and i.expira_at < now() then 'EXPIRADA' else i.estado end,
    'tiene_cuenta', exists (select 1 from auth.users u where lower(u.email) = i.email))
  from public.invitacion_staff i where i.id = p_invitacion_id;
$$;
revoke all on function public.invitacion_para_enrutar(uuid) from public, anon, authenticated;
grant execute on function public.invitacion_para_enrutar(uuid) to service_role;

-- ── Aceptación transaccional, idempotente y con el correo VERIFICADO ────────────────────────
-- Bloquea la fila de la invitación (dos aceptaciones simultáneas se serializan), exige que el
-- correo de la sesión sea el invitado y esté verificado, y la autorización de tratamiento. Todo en
-- la misma transacción: si algo falla, no queda vínculo sin autorización ni autorización sin vínculo.
create or replace function public.aceptar_invitacion_staff(p_invitacion_id uuid, p_autoriza_tratamiento boolean)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  i public.invitacion_staff;
  v_email text;
  v_confirmado timestamptz;
  v_res jsonb;
begin
  if v_uid is null then raise exception 'NO_AUTENTICADO'; end if;
  select * into i from public.invitacion_staff where id = p_invitacion_id for update;
  if not found then raise exception 'INVITACION_NO_ENCONTRADA'; end if;
  select lower(u.email), u.email_confirmed_at into v_email, v_confirmado from auth.users u where u.id = v_uid;
  if v_email is distinct from i.email then raise exception 'NO_AUTORIZADO'; end if;
  if v_confirmado is null then raise exception 'CORREO_NO_VERIFICADO'; end if;
  -- Reintento de quien ya aceptó: mismo resultado, sin duplicar nada.
  if i.estado = 'ACEPTADA' and exists (select 1 from public.vinculo_staff_negocio v
       where v.staff_id = v_uid and v.negocio_id = i.negocio_id and v.estado <> 'RETIRADO') then
    return jsonb_build_object('aceptada', true, 'ya_aceptada', true, 'negocio_id', i.negocio_id);
  end if;
  if coalesce(p_autoriza_tratamiento, false) is not true then raise exception 'AUTORIZACION_TRATAMIENTO_REQUERIDA'; end if;
  perform set_config('stylernow.aceptacion_staff', 'on', true);
  v_res := public.responder_invitacion(p_invitacion_id, true);
  perform public.autorizar_staff('AUTORIZACION_STAFF_TRATAMIENTO', 'invitacion');
  return v_res;
end $$;
revoke all on function public.aceptar_invitacion_staff(uuid, boolean) from public, anon, authenticated;
grant execute on function public.aceptar_invitacion_staff(uuid, boolean) to authenticated;

-- `responder_invitacion` sigue sirviendo para RECHAZAR; aceptar solo es posible por la función de
-- arriba (que exige correo verificado y la autorización). Se parchea la definición vigente.
do $$
declare v_def text;
begin
  v_def := pg_get_functiondef('public.responder_invitacion(uuid, boolean)'::regprocedure);
  if position('stylernow.aceptacion_staff' in v_def) = 0 then
    if position('  if not p_aceptar then' in v_def) = 0 then raise exception 'ANCLA_NO_ENCONTRADA responder_invitacion'; end if;
    v_def := replace(v_def, '  if not p_aceptar then',
      '  if p_aceptar and coalesce(current_setting(''stylernow.aceptacion_staff'', true), '''') <> ''on'' then' || chr(10) ||
      '    raise exception ''USA_ACEPTAR_INVITACION_STAFF'';' || chr(10) ||
      '  end if;' || chr(10) || chr(10) || '  if not p_aceptar then');
    execute v_def;
  end if;
end $$;

-- ── Visibilidad pública (decisión E): solo Staff publicable ─────────────────────────────────
do $$
declare v_def text;
begin
  -- Listado público del negocio
  v_def := pg_get_functiondef('public.negocio_staff_publico(uuid)'::regprocedure);
  if position('staff_es_publicable' in v_def) = 0 then
    if position('    and n.estado = ''ACTIVO''' in v_def) = 0 then raise exception 'ANCLA_NO_ENCONTRADA negocio_staff_publico'; end if;
    v_def := replace(v_def, '    and n.estado = ''ACTIVO''',
      '    and n.estado = ''ACTIVO''' || chr(10) || '    and public.staff_es_publicable(v.staff_id, v.negocio_id)');
    execute v_def;
  end if;

  -- Perfil público del profesional
  v_def := pg_get_functiondef('public.staff_perfil_publico(uuid, uuid)'::regprocedure);
  if position('staff_es_publicable' in v_def) = 0 then
    if position('  select s.* into st from public.staff s where s.usuario_id = p_staff_id;' in v_def) = 0 then
      raise exception 'ANCLA_NO_ENCONTRADA staff_perfil_publico';
    end if;
    v_def := replace(v_def, '  select s.* into st from public.staff s where s.usuario_id = p_staff_id;',
      '  if not public.staff_es_publicable(p_staff_id, p_negocio_id) then return null; end if;' || chr(10) ||
      '  select s.* into st from public.staff s where s.usuario_id = p_staff_id;');
    execute v_def;
  end if;

  -- Horarios y asignación automática: el público (clientes) solo ve Staff publicable; el negocio y su
  -- equipo (agenda interna) siguen viendo a todos.
  v_def := pg_get_functiondef('public.slots_disponibles(uuid, uuid[], date, uuid, integer)'::regprocedure);
  if position('staff_es_publicable' in v_def) = 0 then
    if position('      and (p_staff_id is null or v.staff_id = p_staff_id)' in v_def) = 0 then
      raise exception 'ANCLA_NO_ENCONTRADA slots_disponibles';
    end if;
    v_def := replace(v_def, '      and (p_staff_id is null or v.staff_id = p_staff_id)',
      '      and (p_staff_id is null or v.staff_id = p_staff_id)' || chr(10) ||
      '      and (public.staff_es_publicable(v.staff_id, v_negocio.id) or coalesce(public.tiene_acceso_interno(v_negocio.id), false))');
    execute v_def;
  end if;
end $$;

-- ── Aviso al Staff existente (decisión D): una notificación interna por profesional ─────────
insert into public.notificacion_usuario (usuario_id, tipo, titulo, cuerpo, negocio_id, dedupe_key)
select v.staff_id, 'SISTEMA', 'Completa tu perfil profesional',
  'Ahora decides si tu perfil (nombre, foto, especialidad y descripción) se muestra a los clientes. Tienes hasta el '
    || to_char((select staff_transicion_fin from public.configuracion_plataforma limit 1) at time zone 'America/Bogota', 'DD/MM/YYYY')
    || ' para subir tu foto y autorizar la publicación desde tu perfil; si no lo haces, tu perfil dejará de mostrarse al público (tu cuenta y tu trabajo en el negocio no cambian).',
  v.negocio_id, 'staff_transicion_publicacion:' || v.id
from public.vinculo_staff_negocio v
where v.estado <> 'RETIRADO'
  and not exists (select 1 from public.notificacion_usuario n where n.dedupe_key = 'staff_transicion_publicacion:' || v.id);

-- StylerNow — Migración 015: Módulo 2.4 — Gestión de Staff (dominio completo)
-- Fuente: 03-Business-Rules/01_Roles.md (matriz "Gestión del Staff", "Promoción
-- a Guardian", "Degradación de Guardian", "Traslado de Staff"), ADR-006
-- (Guardian comparte el Panel Negocio), ADL-009 (un Staff nunca tiene dos
-- vínculos no-RETIRADO simultáneos).
--
-- `trasladar_staff` (013) y `staff_de_sede` (013) ya existen y no se tocan.
-- Esta migración cierra lo que faltaba: aceptar/rechazar una invitación real
-- (antes solo se registraba, con un TODO explícito en actions.ts), el ciclo
-- de vida completo de Guardian y de suspensión/retiro, y una vista de lectura
-- para listar/buscar/filtrar/paginar Staff respetando RLS por rol.

-- ════════════════════════════════════════════════════════════════════════
-- 1. Estados que faltaban
-- ════════════════════════════════════════════════════════════════════════

alter type invitacion_staff_estado add value if not exists 'RECHAZADA';

-- ════════════════════════════════════════════════════════════════════════
-- 2. Columnas que faltaban en invitacion_staff
-- ════════════════════════════════════════════════════════════════════════

alter table public.invitacion_staff
  add column if not exists sede_id uuid references public.sede(id),
  add column if not exists comision_pct numeric(5,2) check (comision_pct between 20 and 80),
  add column if not exists reenviada_at timestamptz,
  add column if not exists reenvios_count int not null default 0,
  add column if not exists respondida_at timestamptz;

-- Cancelar ya no es un DELETE directo — pasa a ser un estado auditado
-- (`cancelar_invitacion` más abajo). Sin política de DELETE, la única forma
-- de "borrar" una invitación desde el cliente deja de existir.
drop policy if exists invitacion_staff_delete_negocio on public.invitacion_staff;

-- Quien recibió una invitación pendiente necesita ver el nombre del negocio
-- que lo invitó (para /invitacion/[id]) aunque ese negocio todavía esté en
-- PENDIENTE_APROBACION (no pasa el filtro de negocio_select_publico) y el
-- invitado, obviamente, todavía no es Staff suyo (no pasa negocio_select_interno).
create policy negocio_select_invitado on public.negocio for select
  using (
    exists (
      select 1 from public.invitacion_staff i
      where i.negocio_id = negocio.id
        and i.estado = 'PENDIENTE'
        and i.email = (select email from public.perfil where id = auth.uid())
    )
  );

-- Barbería y Guardian (de la sede activa del Staff) necesitan ver el
-- teléfono/correo de su equipo para la ficha de Perfil del Staff (2.4.2) —
-- hasta ahora `perfil` solo era visible para uno mismo, SuperSU, o un
-- Negocio viendo a sus Clientes por CRM (no a su propio equipo).
create policy perfil_select_staff_interno on public.perfil for select
  using (
    exists (
      select 1 from public.vinculo_staff_negocio v
      where v.staff_id = perfil.id
        and (
          public.is_barberia_de(v.negocio_id)
          or (v.sede_activa_id is not null and public.is_guardian_de_sede(v.sede_activa_id))
        )
    )
  );

-- ════════════════════════════════════════════════════════════════════════
-- 3. RLS: el alcance de Guardian sobre `vinculo_staff_negocio` era el
--    negocio completo (is_guardian_de_negocio) — la matriz de Roles dice
--    que "Ver compañeros" es 🏢 (alcance de SEDE), no negocio entero.
--    Se corrige acá, dentro del mismo módulo que la necesita para no dejar
--    la matriz de permisos desalineada del código (Regla de Oro).
-- ════════════════════════════════════════════════════════════════════════

drop policy if exists vinculo_select_interno on public.vinculo_staff_negocio;
create policy vinculo_select_interno on public.vinculo_staff_negocio for select
  using (
    public.is_barberia_de(negocio_id)
    or public.is_supersu()
    or (sede_activa_id is not null and public.is_guardian_de_sede(sede_activa_id))
  );

-- ════════════════════════════════════════════════════════════════════════
-- 4. Vista de lectura para Listado de Staff (2.4.1) — security_invoker: se
--    ejecuta con los privilegios de quien consulta, así que RLS de las
--    tablas base sigue siendo la autoridad real. Permite búsqueda/filtro/
--    orden/paginación reales vía supabase-js (.ilike/.eq/.range/.order),
--    sin necesidad de un RPC de lectura a medida.
-- ════════════════════════════════════════════════════════════════════════

create or replace view public.vista_staff_negocio
with (security_invoker = true) as
select
  v.id as vinculo_id,
  v.negocio_id,
  v.staff_id,
  s.nombre,
  s.foto_url,
  s.especialidad,
  p.telefono,
  p.email,
  v.es_guardian,
  v.estado,
  v.sede_activa_id as sede_id,
  sd.nombre as sede_nombre,
  v.comision_pct,
  v.fecha_ingreso,
  v.created_at,
  (
    select nc.nivel from public.nivel_staff_consolidado nc
    join public.temporada t on t.id = nc.temporada_id
    where nc.vinculo_id = v.id
    order by t.fecha_fin desc
    limit 1
  ) as nivel
from public.vinculo_staff_negocio v
join public.staff s on s.usuario_id = v.staff_id
left join public.perfil p on p.id = v.staff_id
left join public.sede sd on sd.id = v.sede_activa_id;

grant select on public.vista_staff_negocio to authenticated;
comment on view public.vista_staff_negocio is
  'Lectura para el Módulo 2.4 (Gestión de Staff). security_invoker=true: NO es una puerta de autorización propia, hereda el RLS real de vinculo_staff_negocio/staff/perfil/sede.';

-- ════════════════════════════════════════════════════════════════════════
-- 5. Crear invitación (nueva o re-invitar tras CANCELADA/EXPIRADA/RECHAZADA
--    con el mismo correo — unique(negocio_id, email) obliga a upsert).
-- ════════════════════════════════════════════════════════════════════════

create or replace function public.crear_invitacion_staff(
  p_negocio_id uuid,
  p_email text,
  p_sede_id uuid,
  p_comision_pct numeric default null
)
returns public.invitacion_staff
language plpgsql security definer set search_path = public as $fn$
declare
  v_plan public.plan;
  v_conteo int;
  v_email text := lower(trim(p_email));
  v_invitacion public.invitacion_staff;
begin
  if not public.is_barberia_de(p_negocio_id) then
    raise exception 'NO_AUTORIZADO';
  end if;

  if not exists (select 1 from public.sede where id = p_sede_id and negocio_id = p_negocio_id) then
    raise exception 'SEDE_NO_PERTENECE_AL_NEGOCIO';
  end if;

  -- Tope duro del plan (staff_tope_absoluto — solo Raven lo define hoy):
  -- cuenta vínculos que ya ocupan un cupo + invitaciones pendientes de OTROS
  -- correos, para no permitir sobre-reservar el cupo invitando de más.
  select p.* into v_plan from public.plan p
  join public.negocio n on n.plan_codigo = p.codigo
  where n.id = p_negocio_id;

  select
    (select count(*) from public.vinculo_staff_negocio
      where negocio_id = p_negocio_id and estado in ('ACTIVO', 'SUSPENDIDO', 'INVITADO'))
    + (select count(*) from public.invitacion_staff
        where negocio_id = p_negocio_id and estado = 'PENDIENTE' and email <> v_email)
  into v_conteo;

  if v_plan.staff_tope_absoluto is not null and v_conteo >= v_plan.staff_tope_absoluto then
    raise exception 'PLAN_LIMIT_EXCEEDED';
  end if;

  insert into public.invitacion_staff (negocio_id, email, sede_id, comision_pct, invitado_por)
  values (p_negocio_id, v_email, p_sede_id, p_comision_pct, auth.uid())
  on conflict (negocio_id, email) do update
    set estado = 'PENDIENTE',
        sede_id = excluded.sede_id,
        comision_pct = excluded.comision_pct,
        expira_at = now() + interval '7 days',
        respondida_at = null
  returning * into v_invitacion;

  insert into public.evento_auditoria (entidad_tipo, entidad_id, accion, actor_tipo, actor_id, negocio_id, payload_despues)
  values ('invitacion_staff', v_invitacion.id, 'STAFF_INVITADO', 'BARBERIA', auth.uid(), p_negocio_id,
    jsonb_build_object('email', v_invitacion.email, 'sede_id', p_sede_id));

  return v_invitacion;
end;
$fn$;

-- ════════════════════════════════════════════════════════════════════════
-- 6. Reenviar / cancelar invitación pendiente
-- ════════════════════════════════════════════════════════════════════════

create or replace function public.reenviar_invitacion(p_invitacion_id uuid)
returns public.invitacion_staff
language plpgsql security definer set search_path = public as $fn$
declare
  v_invitacion public.invitacion_staff;
begin
  select * into v_invitacion from public.invitacion_staff where id = p_invitacion_id;
  if not found or not public.is_barberia_de(v_invitacion.negocio_id) then
    raise exception 'NO_AUTORIZADO';
  end if;
  if v_invitacion.estado <> 'PENDIENTE' then
    raise exception 'INVITACION_NO_PENDIENTE';
  end if;

  update public.invitacion_staff
  set expira_at = now() + interval '7 days',
      reenviada_at = now(),
      reenvios_count = reenvios_count + 1
  where id = p_invitacion_id
  returning * into v_invitacion;

  insert into public.evento_auditoria (entidad_tipo, entidad_id, accion, actor_tipo, actor_id, negocio_id)
  values ('invitacion_staff', p_invitacion_id, 'STAFF_INVITACION_REENVIADA', 'BARBERIA', auth.uid(), v_invitacion.negocio_id);

  return v_invitacion;
end;
$fn$;

create or replace function public.cancelar_invitacion(p_invitacion_id uuid)
returns void
language plpgsql security definer set search_path = public as $fn$
declare
  v_invitacion public.invitacion_staff;
begin
  select * into v_invitacion from public.invitacion_staff where id = p_invitacion_id;
  if not found or not public.is_barberia_de(v_invitacion.negocio_id) then
    raise exception 'NO_AUTORIZADO';
  end if;
  if v_invitacion.estado <> 'PENDIENTE' then
    raise exception 'INVITACION_NO_PENDIENTE';
  end if;

  update public.invitacion_staff set estado = 'CANCELADA', respondida_at = now() where id = p_invitacion_id;

  insert into public.evento_auditoria (entidad_tipo, entidad_id, accion, actor_tipo, actor_id, negocio_id)
  values ('invitacion_staff', p_invitacion_id, 'STAFF_INVITACION_CANCELADA', 'BARBERIA', auth.uid(), v_invitacion.negocio_id);
end;
$fn$;

-- ════════════════════════════════════════════════════════════════════════
-- 7. Aceptar / rechazar una invitación — el TODO que dejó pendiente
--    onboarding/actions.ts::invitarStaff. Acá nace de verdad el vínculo.
-- ════════════════════════════════════════════════════════════════════════

create or replace function public.responder_invitacion(p_invitacion_id uuid, p_aceptar boolean)
returns jsonb
language plpgsql security definer set search_path = public as $fn$
declare
  v_invitacion public.invitacion_staff;
  v_mi_email text;
  v_plan public.plan;
  v_conteo int;
  v_sede_id uuid;
  v_vinculo_existente public.vinculo_staff_negocio;
  v_vinculo public.vinculo_staff_negocio;
  v_perfil_nombre text;
begin
  select * into v_invitacion from public.invitacion_staff where id = p_invitacion_id;
  if not found then
    raise exception 'INVITACION_NO_ENCONTRADA';
  end if;

  select email into v_mi_email from public.perfil where id = auth.uid();
  if v_mi_email is null or lower(v_mi_email) <> v_invitacion.email then
    raise exception 'NO_AUTORIZADO';
  end if;

  if v_invitacion.estado <> 'PENDIENTE' then
    raise exception 'INVITACION_NO_PENDIENTE';
  end if;

  if v_invitacion.expira_at < now() then
    update public.invitacion_staff set estado = 'EXPIRADA' where id = p_invitacion_id;
    raise exception 'INVITACION_EXPIRADA';
  end if;

  if not p_aceptar then
    update public.invitacion_staff set estado = 'RECHAZADA', respondida_at = now() where id = p_invitacion_id;
    insert into public.evento_auditoria (entidad_tipo, entidad_id, accion, actor_tipo, actor_id, negocio_id)
    values ('invitacion_staff', p_invitacion_id, 'STAFF_INVITACION_RECHAZADA', 'STAFF', auth.uid(), v_invitacion.negocio_id);
    return jsonb_build_object('aceptada', false);
  end if;

  -- ADL-009: un Staff nunca tiene dos vínculos no-RETIRADO al mismo tiempo
  -- (índice único parcial en vinculo_staff_negocio). Se valida acá para un
  -- error legible en vez de que la caiga en la violación del índice.
  if exists (
    select 1 from public.vinculo_staff_negocio where staff_id = auth.uid() and estado <> 'RETIRADO'
  ) then
    raise exception 'YA_TIENE_VINCULO_ACTIVO';
  end if;

  select p.* into v_plan from public.plan p
  join public.negocio n on n.plan_codigo = p.codigo where n.id = v_invitacion.negocio_id;
  select count(*) into v_conteo from public.vinculo_staff_negocio
    where negocio_id = v_invitacion.negocio_id and estado in ('ACTIVO', 'SUSPENDIDO');
  if v_plan.staff_tope_absoluto is not null and v_conteo >= v_plan.staff_tope_absoluto then
    raise exception 'PLAN_LIMIT_EXCEEDED';
  end if;

  select coalesce(
    v_invitacion.sede_id,
    (select id from public.sede where negocio_id = v_invitacion.negocio_id and es_principal limit 1)
  ) into v_sede_id;

  select nombre into v_perfil_nombre from public.perfil where id = auth.uid();

  insert into public.staff (usuario_id, nombre)
  values (auth.uid(), coalesce(v_perfil_nombre, 'Staff'))
  on conflict (usuario_id) do nothing;

  -- Reingreso al mismo negocio tras haber sido retirado antes: se reactiva
  -- la MISMA fila de vínculo (no una nueva) para no perder el historial de
  -- nivel PRO/EXPERT/MASTER, que está indexado por vinculo_id.
  select * into v_vinculo_existente from public.vinculo_staff_negocio
    where staff_id = auth.uid() and negocio_id = v_invitacion.negocio_id
    order by created_at desc limit 1;

  if found then
    update public.vinculo_staff_negocio
    set estado = 'ACTIVO',
        sede_activa_id = v_sede_id,
        comision_pct = coalesce(v_invitacion.comision_pct, comision_pct),
        fecha_ingreso = coalesce(fecha_ingreso, now()),
        es_guardian = false
    where id = v_vinculo_existente.id
    returning * into v_vinculo;
  else
    insert into public.vinculo_staff_negocio (staff_id, negocio_id, sede_activa_id, comision_pct, estado, fecha_ingreso)
    values (auth.uid(), v_invitacion.negocio_id, v_sede_id, v_invitacion.comision_pct, 'ACTIVO', now())
    returning * into v_vinculo;
  end if;

  update public.invitacion_staff set estado = 'ACEPTADA', respondida_at = now() where id = p_invitacion_id;

  insert into public.evento_auditoria (entidad_tipo, entidad_id, accion, actor_tipo, actor_id, negocio_id, payload_despues)
  values ('vinculo_staff_negocio', v_vinculo.id, 'STAFF_VINCULADO', 'STAFF', auth.uid(), v_invitacion.negocio_id,
    jsonb_build_object('sede_id', v_sede_id, 'invitacion_id', p_invitacion_id));

  return jsonb_build_object('aceptada', true, 'vinculo_id', v_vinculo.id, 'negocio_id', v_invitacion.negocio_id);
end;
$fn$;

-- ════════════════════════════════════════════════════════════════════════
-- 8. Ciclo de vida de Guardian — Promoción / Degradación (todas exclusivas
--    de Barbería, 03-Business-Rules/01_Roles.md).
-- ════════════════════════════════════════════════════════════════════════

create or replace function public.promover_guardian(p_vinculo_id uuid)
returns public.vinculo_staff_negocio
language plpgsql security definer set search_path = public as $fn$
declare
  v_vinculo public.vinculo_staff_negocio;
begin
  select * into v_vinculo from public.vinculo_staff_negocio where id = p_vinculo_id;
  if not found or not public.is_barberia_de(v_vinculo.negocio_id) then
    raise exception 'NO_AUTORIZADO';
  end if;
  if v_vinculo.estado <> 'ACTIVO' then
    raise exception 'STAFF_NO_ACTIVO';
  end if;
  if v_vinculo.sede_activa_id is null then
    raise exception 'FALTA_SEDE_ACTIVA';
  end if;
  if v_vinculo.es_guardian then
    raise exception 'YA_ES_GUARDIAN';
  end if;

  update public.vinculo_staff_negocio set es_guardian = true where id = p_vinculo_id
  returning * into v_vinculo;

  insert into public.evento_auditoria (entidad_tipo, entidad_id, accion, actor_tipo, actor_id, negocio_id, payload_antes, payload_despues)
  values ('vinculo_staff_negocio', p_vinculo_id, 'STAFF_PROMOVIDO_GUARDIAN', 'BARBERIA', auth.uid(), v_vinculo.negocio_id,
    jsonb_build_object('es_guardian', false), jsonb_build_object('es_guardian', true, 'sede_id', v_vinculo.sede_activa_id));

  return v_vinculo;
end;
$fn$;

create or replace function public.revocar_guardian(p_vinculo_id uuid)
returns public.vinculo_staff_negocio
language plpgsql security definer set search_path = public as $fn$
declare
  v_vinculo public.vinculo_staff_negocio;
begin
  select * into v_vinculo from public.vinculo_staff_negocio where id = p_vinculo_id;
  if not found or not public.is_barberia_de(v_vinculo.negocio_id) then
    raise exception 'NO_AUTORIZADO';
  end if;
  if not v_vinculo.es_guardian then
    raise exception 'NO_ES_GUARDIAN';
  end if;

  update public.vinculo_staff_negocio set es_guardian = false where id = p_vinculo_id
  returning * into v_vinculo;

  insert into public.evento_auditoria (entidad_tipo, entidad_id, accion, actor_tipo, actor_id, negocio_id, payload_antes, payload_despues)
  values ('vinculo_staff_negocio', p_vinculo_id, 'STAFF_GUARDIAN_REVOCADO', 'BARBERIA', auth.uid(), v_vinculo.negocio_id,
    jsonb_build_object('es_guardian', true), jsonb_build_object('es_guardian', false));

  return v_vinculo;
end;
$fn$;

-- ════════════════════════════════════════════════════════════════════════
-- 9. Suspensión / reactivación / retiro (todas exclusivas de Barbería).
--    Ninguna borra fila — el historial completo queda íntegro en
--    evento_auditoria y en la propia fila de vinculo_staff_negocio.
-- ════════════════════════════════════════════════════════════════════════

create or replace function public.suspender_staff(p_vinculo_id uuid, p_motivo text default null)
returns public.vinculo_staff_negocio
language plpgsql security definer set search_path = public as $fn$
declare
  v_vinculo public.vinculo_staff_negocio;
begin
  select * into v_vinculo from public.vinculo_staff_negocio where id = p_vinculo_id;
  if not found or not public.is_barberia_de(v_vinculo.negocio_id) then
    raise exception 'NO_AUTORIZADO';
  end if;
  if v_vinculo.estado <> 'ACTIVO' then
    raise exception 'STAFF_NO_ACTIVO';
  end if;

  update public.vinculo_staff_negocio set estado = 'SUSPENDIDO' where id = p_vinculo_id
  returning * into v_vinculo;

  insert into public.evento_auditoria (entidad_tipo, entidad_id, accion, actor_tipo, actor_id, negocio_id, motivo)
  values ('vinculo_staff_negocio', p_vinculo_id, 'STAFF_SUSPENDIDO', 'BARBERIA', auth.uid(), v_vinculo.negocio_id, p_motivo);

  return v_vinculo;
end;
$fn$;

create or replace function public.reactivar_staff(p_vinculo_id uuid)
returns public.vinculo_staff_negocio
language plpgsql security definer set search_path = public as $fn$
declare
  v_vinculo public.vinculo_staff_negocio;
begin
  select * into v_vinculo from public.vinculo_staff_negocio where id = p_vinculo_id;
  if not found or not public.is_barberia_de(v_vinculo.negocio_id) then
    raise exception 'NO_AUTORIZADO';
  end if;
  if v_vinculo.estado <> 'SUSPENDIDO' then
    raise exception 'STAFF_NO_SUSPENDIDO';
  end if;

  update public.vinculo_staff_negocio set estado = 'ACTIVO' where id = p_vinculo_id
  returning * into v_vinculo;

  insert into public.evento_auditoria (entidad_tipo, entidad_id, accion, actor_tipo, actor_id, negocio_id)
  values ('vinculo_staff_negocio', p_vinculo_id, 'STAFF_REACTIVADO', 'BARBERIA', auth.uid(), v_vinculo.negocio_id);

  return v_vinculo;
end;
$fn$;

create or replace function public.retirar_staff(p_vinculo_id uuid, p_motivo text default null)
returns public.vinculo_staff_negocio
language plpgsql security definer set search_path = public as $fn$
declare
  v_vinculo public.vinculo_staff_negocio;
begin
  select * into v_vinculo from public.vinculo_staff_negocio where id = p_vinculo_id;
  if not found or not public.is_barberia_de(v_vinculo.negocio_id) then
    raise exception 'NO_AUTORIZADO';
  end if;
  if v_vinculo.estado = 'RETIRADO' then
    raise exception 'STAFF_YA_RETIRADO';
  end if;

  -- "Eliminar acceso" (matriz de Roles) — pierde el perfil Guardian si lo
  -- tenía (Degradación implícita: no hay Guardian sin vínculo activo) y
  -- todo permiso administrativo, sin período de gracia, conservando la fila
  -- y su historial completo (Reservas, Nivel, evento_auditoria).
  update public.vinculo_staff_negocio
  set estado = 'RETIRADO', es_guardian = false
  where id = p_vinculo_id
  returning * into v_vinculo;

  insert into public.evento_auditoria (entidad_tipo, entidad_id, accion, actor_tipo, actor_id, negocio_id, motivo)
  values ('vinculo_staff_negocio', p_vinculo_id, 'STAFF_RETIRADO', 'BARBERIA', auth.uid(), v_vinculo.negocio_id, p_motivo);

  return v_vinculo;
end;
$fn$;

-- ════════════════════════════════════════════════════════════════════════
-- 10. Grants
-- ════════════════════════════════════════════════════════════════════════

grant execute on function public.crear_invitacion_staff(uuid, text, uuid, numeric) to authenticated;
grant execute on function public.reenviar_invitacion(uuid) to authenticated;
grant execute on function public.cancelar_invitacion(uuid) to authenticated;
grant execute on function public.responder_invitacion(uuid, boolean) to authenticated;
grant execute on function public.promover_guardian(uuid) to authenticated;
grant execute on function public.revocar_guardian(uuid) to authenticated;
grant execute on function public.suspender_staff(uuid, text) to authenticated;
grant execute on function public.reactivar_staff(uuid) to authenticated;
grant execute on function public.retirar_staff(uuid, text) to authenticated;

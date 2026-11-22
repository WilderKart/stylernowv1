-- 158: modelo de roles por CAPACIDADES del equipo (FASE 1, 2026-11-18).
--
-- Problema: el modelo anterior era un enum rígido (BARBERIA = dueño; GUARDIAN/STAFF = vínculo). Un propietario no podía
-- atender ni delegar la administración sin duplicar cuentas, y "ser profesional" (consumir cupo) no se distinguía de
-- "ser administrador". Esta migración añade capacidades al vínculo y deriva el rol de ellas.
--
-- Nomenclatura (decisión del usuario; NO existe «OWNER»):
--   BUSINESS_OWNER  propietario del establecimiento (derivado de negocio.owner_user_id; no se guarda en el vínculo)
--   BUSINESS_ADMIN  administrador delegado, NO presta servicios: no ocupa cupo, no aparece en la agenda pública
--   ADMIN_BARBER    administrador que además presta servicios: ocupa cupo
--   BARBER          profesional operativo: ocupa cupo
--   SUPER_ADMIN     plataforma (perfil.es_supersu; sin cambios)
-- Capacidades en vinculo_staff_negocio:  es_admin (administra)  ·  presta_servicios (atiende; consume cupo).
--   check: al menos una. El propietario con perfil profesional es un vínculo con presta_servicios=true; sin él, no tiene vínculo.
--   `es_propietario` se DERIVA de negocio.owner_user_id (una sola fuente; una columna aparte podría desfasarse).
-- Relación con GUARDIAN (no se toca): es_guardian es un alcance por SEDE (ADR-006) ortogonal a es_admin, que es de NEGOCIO.
--   Un Guardian sigue siendo un profesional (BARBER) con permisos de sede; BUSINESS_ADMIN es la delegación de todo el negocio.
--
-- Esta migración NO cambia datos de negocios existentes (todos los vínculos actuales quedan BARBER: presta_servicios=true,
-- es_admin=false) ni el cupo (migración 159). Rollback: 158_modelo_roles_capacidades_REVERSION.sql.txt.

-- ── 1. Columnas y restricciones ─────────────────────────────────────────────────────────
alter table public.vinculo_staff_negocio
  add column if not exists es_admin boolean not null default false,
  add column if not exists presta_servicios boolean not null default true;
alter table public.vinculo_staff_negocio drop constraint if exists vinculo_capacidad_minima;
alter table public.vinculo_staff_negocio add constraint vinculo_capacidad_minima check (es_admin or presta_servicios);

alter table public.invitacion_staff add column if not exists rol_invitado text not null default 'BARBER';
alter table public.invitacion_staff drop constraint if exists invitacion_staff_rol_invitado_check;
alter table public.invitacion_staff add constraint invitacion_staff_rol_invitado_check
  check (rol_invitado in ('BARBER', 'BUSINESS_ADMIN', 'ADMIN_BARBER'));

-- Configurable (no hardcodeado en el código): qué planes arrancan con el propietario como profesional.
-- Configuración ÚNICA del perfil profesional del propietario por plan (la leen activar/desactivar, completar_onboarding_negocio, la
-- normalización y la interfaz; nadie la repite): por_defecto = el propietario atiende desde el inicio (la normalización lo aplica a las
-- altas completas); auto_alta = se activa solo al completar el alta; puede_activar / puede_desactivar = lo que el propietario puede hacer
-- por su cuenta. Valores iniciales: Essential por defecto y automático; el resto desactivado pero activable de forma voluntaria.
do $$ begin
  -- Los valores iniciales se siembran SOLO cuando las columnas se crean: re-ejecutar la migración no pisa lo que SuperSU haya configurado.
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'plan'
                  and column_name = 'propietario_perfil_auto_alta') then
    alter table public.plan
      add column if not exists propietario_profesional_por_defecto boolean not null default false,
      add column propietario_perfil_auto_alta boolean not null default false,
      add column propietario_puede_activar_perfil boolean not null default true,
      add column propietario_puede_desactivar_perfil boolean not null default true;
    update public.plan set propietario_profesional_por_defecto = (codigo = 'ESSENTIAL'),
      propietario_perfil_auto_alta = (codigo = 'ESSENTIAL'), updated_at = now();
  end if;
end $$;

-- Auditoría del vínculo: ahora también las capacidades.
drop trigger if exists trg_auditar_vinculo_staff_negocio on public.vinculo_staff_negocio;
create trigger trg_auditar_vinculo_staff_negocio after insert or delete or update on public.vinculo_staff_negocio
  for each row execute function public._trg_auditar_cambio(
    'vinculo_staff_negocio', 'negocio_id', 'staff_id,sede_activa_id,es_guardian,estado,comision_pct,es_admin,presta_servicios', '-');

-- ── 2. Helpers de autorización (is_barberia_de / is_staff_de NO cambian) ────────────────
-- is_barberia_de sigue significando "propietario" (facturación, propiedad, verificación). is_admin_de = propietario O
-- administrador delegado ACTIVO. Un NULL de auth.uid() no autoriza (coalesce a false).
create or replace function public.is_admin_de(p_negocio_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(
    exists (select 1 from public.negocio n where n.id = p_negocio_id and n.owner_user_id = auth.uid())
    or exists (select 1 from public.vinculo_staff_negocio v
               where v.staff_id = auth.uid() and v.negocio_id = p_negocio_id and v.estado = 'ACTIVO' and v.es_admin),
    false);
$$;
revoke all on function public.is_admin_de(uuid) from public, anon, authenticated;
-- anon también: las políticas RLS se evalúan con el rol del llamador y is_admin_de aparece en políticas de lectura (con auth.uid() nulo da false).
grant execute on function public.is_admin_de(uuid) to anon, authenticated;

-- Rol derivado (interno, sin autorización: solo lo usan otras funciones definer).
create or replace function public._rol_equipo(p_negocio_id uuid, p_usuario_id uuid)
returns text language sql stable security definer set search_path = public as $$
  select case
    when p_usuario_id is null then null
    when exists (select 1 from public.negocio n where n.id = p_negocio_id and n.owner_user_id = p_usuario_id) then 'BUSINESS_OWNER'
    else (select case when v.es_admin and v.presta_servicios then 'ADMIN_BARBER'
                      when v.es_admin then 'BUSINESS_ADMIN' else 'BARBER' end
          from public.vinculo_staff_negocio v
          where v.staff_id = p_usuario_id and v.negocio_id = p_negocio_id and v.estado <> 'RETIRADO' limit 1)
  end;
$$;
revoke all on function public._rol_equipo(uuid, uuid) from public, anon, authenticated;

-- Rol de un usuario en un negocio: uno mismo, quien tiene acceso interno al negocio o SuperSU. Sin vínculo: null.
create or replace function public.rol_equipo(p_negocio_id uuid, p_usuario_id uuid default null)
returns text language plpgsql stable security definer set search_path = public as $$
declare v_u uuid := coalesce(p_usuario_id, auth.uid());
begin
  if auth.uid() is null then raise exception 'NO_AUTENTICADO'; end if;
  if not (v_u = auth.uid() or public.tiene_acceso_interno(p_negocio_id) or coalesce(public.is_supersu(), false)) then
    raise exception 'NO_AUTORIZADO';
  end if;
  return public._rol_equipo(p_negocio_id, v_u);
end $$;
revoke all on function public.rol_equipo(uuid, uuid) from public, anon, authenticated;
grant execute on function public.rol_equipo(uuid, uuid) to authenticated;

-- ── 3. Quien no presta servicios no se asigna ni se publica ─────────────────────────────
-- Un administrador puro (presta_servicios=false) no recibe servicios ni citas aunque alguien escriba directo en la tabla.
create or replace function public.trg_staff_servicio_solo_profesionales()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from public.servicio sv
               join public.vinculo_staff_negocio v on v.negocio_id = sv.negocio_id and v.staff_id = new.staff_id and v.estado <> 'RETIRADO'
              where sv.id = new.servicio_id and not v.presta_servicios)
     and not exists (select 1 from public.servicio sv
               join public.vinculo_staff_negocio v on v.negocio_id = sv.negocio_id and v.staff_id = new.staff_id and v.estado <> 'RETIRADO'
              where sv.id = new.servicio_id and v.presta_servicios) then
    raise exception 'STAFF_NO_PRESTA_SERVICIOS';
  end if;
  return new;
end $$;
revoke all on function public.trg_staff_servicio_solo_profesionales() from public, anon, authenticated;
drop trigger if exists trg_staff_servicio_solo_profesionales on public.staff_servicio;
create trigger trg_staff_servicio_solo_profesionales before insert or update of staff_id, servicio_id on public.staff_servicio
  for each row execute function public.trg_staff_servicio_solo_profesionales();

create or replace function public.trg_reserva_solo_profesionales()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.staff_id is not null
     and exists (select 1 from public.vinculo_staff_negocio v
                 where v.staff_id = new.staff_id and v.negocio_id = new.negocio_id and v.estado <> 'RETIRADO')
     and not exists (select 1 from public.vinculo_staff_negocio v
                 where v.staff_id = new.staff_id and v.negocio_id = new.negocio_id and v.estado <> 'RETIRADO' and v.presta_servicios) then
    raise exception 'STAFF_NO_PRESTA_SERVICIOS';
  end if;
  return new;
end $$;
revoke all on function public.trg_reserva_solo_profesionales() from public, anon, authenticated;
drop trigger if exists trg_reserva_solo_profesionales on public.reserva;
create trigger trg_reserva_solo_profesionales before insert or update of staff_id on public.reserva
  for each row execute function public.trg_reserva_solo_profesionales();

-- Perfil público de staff y su búsqueda: solo vínculos que prestan servicios.
drop policy if exists staff_select_publico on public.staff;
create policy staff_select_publico on public.staff for select using (exists (
  select 1 from public.vinculo_staff_negocio v join public.negocio n on n.id = v.negocio_id
  where v.staff_id = staff.usuario_id and v.estado = 'ACTIVO' and v.presta_servicios and n.estado = 'ACTIVO'));

-- ── 4. Parches por ancla (se leen con pg_get_functiondef; si el ancla no existe, la migración falla) ──
do $$
declare v_def text; v_nuevo text;
  v_a1 constant text := E'    and v.estado = ''ACTIVO''\n    and n.estado = ''ACTIVO''';
begin
  v_def := pg_get_functiondef('public.negocio_staff_publico(uuid)'::regprocedure);
  if position(v_a1 in v_def) = 0 then raise exception 'ANCLA_NO_ENCONTRADA negocio_staff_publico'; end if;
  if position('v.presta_servicios' in v_def) = 0 then
    execute replace(v_def, v_a1, v_a1 || E'\n    and v.presta_servicios');
  end if;
end $$;

do $$
declare v_def text;
  v_a1 constant text := E'      and v.estado = ''ACTIVO''\n      and (v.sede_activa_id = p_sede_id or v.sede_activa_id is null)';
begin
  v_def := pg_get_functiondef('public.slots_disponibles(uuid,uuid[],date,uuid,integer)'::regprocedure);
  if position('v.presta_servicios' in v_def) = 0 and position(v_a1 in v_def) = 0 then raise exception 'ANCLA_NO_ENCONTRADA slots_disponibles'; end if;
  if position('v.presta_servicios' in v_def) = 0 then
    execute replace(v_def, v_a1, E'      and v.estado = ''ACTIVO''\n      and v.presta_servicios\n      and (v.sede_activa_id = p_sede_id or v.sede_activa_id is null)');
  end if;
end $$;

do $$
declare v_def text;
  v_a1 constant text := E'vv.staff_id = p_staff_id and vv.estado = ''ACTIVO'';';
begin
  v_def := pg_get_functiondef('public.staff_perfil_publico(uuid,uuid)'::regprocedure);
  if position('vv.presta_servicios' in v_def) = 0 and position(v_a1 in v_def) = 0 then raise exception 'ANCLA_NO_ENCONTRADA staff_perfil_publico'; end if;
  if position('vv.presta_servicios' in v_def) = 0 then
    execute replace(v_def, v_a1, E'vv.staff_id = p_staff_id and vv.estado = ''ACTIVO'' and vv.presta_servicios;');
  end if;
end $$;

do $$
declare v_def text;
  v_a1 constant text := E'where v.sede_activa_id = s.id and v.estado = ''ACTIVO'') as staff_total';
  v_a2 constant text := E'where v.sede_activa_id = s.id and v.estado = ''ACTIVO'' and nc.nivel in';
begin
  v_def := pg_get_functiondef('public.marketplace_buscar(text,text,text,text,integer,integer,double precision,double precision)'::regprocedure);
  if position('v.presta_servicios' in v_def) = 0 and (position(v_a1 in v_def) = 0 or position(v_a2 in v_def) = 0) then raise exception 'ANCLA_NO_ENCONTRADA marketplace_buscar'; end if;
  if position('v.presta_servicios' in v_def) = 0 then
    v_def := replace(v_def, v_a1, E'where v.sede_activa_id = s.id and v.estado = ''ACTIVO'' and v.presta_servicios) as staff_total');
    v_def := replace(v_def, v_a2, E'where v.sede_activa_id = s.id and v.estado = ''ACTIVO'' and v.presta_servicios and nc.nivel in');
    execute v_def;
  end if;
end $$;

-- ── 5. Lista del equipo: la vista añade las capacidades (columnas AL FINAL). El rol se deriva en la aplicación: la vista es
--    security_invoker y no debe depender de columnas de negocio con permisos por columna (owner_user_id). ──
create or replace view public.vista_staff_negocio with (security_invoker = true) as
 select v.id as vinculo_id, v.negocio_id, v.staff_id, s.nombre, s.foto_url, s.especialidad, p.telefono, p.email,
        v.es_guardian, v.estado, v.sede_activa_id as sede_id, sd.nombre as sede_nombre, v.comision_pct, v.fecha_ingreso, v.created_at,
        (select nc.nivel from public.nivel_staff_consolidado nc join public.temporada t on t.id = nc.temporada_id
          where nc.vinculo_id = v.id order by t.fecha_fin desc limit 1) as nivel,
        v.es_admin, v.presta_servicios
   from public.vinculo_staff_negocio v
   join public.staff s on s.usuario_id = v.staff_id
   left join public.perfil p on p.id = v.staff_id
   left join public.sede sd on sd.id = v.sede_activa_id;

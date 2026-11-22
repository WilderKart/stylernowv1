-- 159: UNA sola función central de capacidad profesional + unificación de los criterios de cupo (FASE 1, 2026-11-18).
--
-- Hoy había 4 criterios distintos de "cuántos profesionales tiene un negocio":
--   · crear_invitacion_staff (015+149):     vínculos ACTIVO/SUSPENDIDO/INVITADO + invitaciones PENDIENTE de OTROS correos
--   · responder_invitacion (015):           solo vínculos ACTIVO/SUSPENDIDO (ignoraba invitaciones y vencimiento)
--   · solicitar_downgrade_plan / ejecutar_downgrades_programados (049): solo ACTIVO
--   · src/app/panel/suscripcion/datos.ts:   solo ACTIVO (conteo en la interfaz)
-- y las invitaciones PENDIENTE contaban aunque estuvieran vencidas. Ahora todos usan _capacidad_profesional().
--
-- Regla de capacidad (decisión del usuario):
--   · OCUPA cupo: vínculo con presta_servicios=true en estado ACTIVO, SUSPENDIDO o INVITADO (el propietario con perfil profesional
--     incluido) + invitaciones PENDIENTES y VIGENTES (no vencidas) cuyo rol presta servicios (BARBER / ADMIN_BARBER).
--   · NO ocupa cupo: propietario o BUSINESS_ADMIN sin perfil profesional; invitaciones a BUSINESS_ADMIN; retirados; invitaciones
--     vencidas/canceladas/rechazadas/aceptadas.
--   · SUSPENDIDO sigue ocupando: si liberara el cupo, suspender -> invitar -> reactivar evadiría el tope.
--   · limite = tope absoluto del plan + adicionales contratados. `p_adicionales` queda como parámetro para la Fase 3 (add-on de
--     barberos adicionales): hoy siempre 0, porque ningún código lo cobra ni lo permite comprar.
--   · exceso = max(ocupados - limite, 0). Nunca se borra a nadie por exceso: solo se impide AGREGAR más.
-- Concurrencia: toda escritura que consume cupo toma _cupo_bloquear(negocio) (advisory lock por negocio, de transacción) antes de
-- contar; así dos invitaciones simultáneas no pueden ver el mismo cupo libre. Además, triggers en vinculo_staff_negocio e
-- invitacion_staff aplican el tope aunque alguien escriba directo en las tablas (el propietario tiene política FOR ALL).
--
-- Rollback: 159_funcion_central_de_cupo_REVERSION.sql.txt.

-- ── 1. Función central ──────────────────────────────────────────────────────────────────
create or replace function public._cupo_bloquear(p_negocio_id uuid)
returns void language sql security definer set search_path = public as $$
  select pg_advisory_xact_lock(hashtextextended('cupo_profesional:' || p_negocio_id::text, 0));
$$;
revoke all on function public._cupo_bloquear(uuid) from public, anon, authenticated;

-- p_plan_codigo: evaluar contra OTRO plan (downgrade). p_adicionales: cupos extra contratados (Fase 3).
-- p_excluir_email: no cuenta la invitación PENDIENTE de ese correo (reinvitar / aceptar no consume dos veces).
create or replace function public._capacidad_profesional(
  p_negocio_id uuid, p_plan_codigo text default null, p_adicionales int default 0, p_excluir_email text default null)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_plan public.plan;
  v_act int; v_susp int; v_pend int; v_inv int; v_ocup int; v_limite int;
begin
  select p.* into v_plan from public.plan p
   where p.codigo = coalesce(p_plan_codigo::public.plan_codigo, (select n.plan_codigo from public.negocio n where n.id = p_negocio_id));
  if not found then return null; end if;

  select count(*) filter (where estado = 'ACTIVO'),
         count(*) filter (where estado = 'SUSPENDIDO'),
         count(*) filter (where estado = 'INVITADO')
    into v_act, v_susp, v_pend
    from public.vinculo_staff_negocio where negocio_id = p_negocio_id and presta_servicios;

  select count(*) into v_inv from public.invitacion_staff i
   where i.negocio_id = p_negocio_id and i.estado = 'PENDIENTE' and i.expira_at > now()
     and i.rol_invitado in ('BARBER', 'ADMIN_BARBER')
     and (p_excluir_email is null or i.email <> lower(p_excluir_email));

  v_ocup := v_act + v_susp + v_pend + v_inv;
  v_limite := case when v_plan.staff_tope_absoluto is null then null
                   else v_plan.staff_tope_absoluto + greatest(coalesce(p_adicionales, 0), 0) end;
  return jsonb_build_object(
    'plan_codigo', v_plan.codigo, 'plan_nombre', v_plan.nombre,
    'incluidos', v_plan.staff_incluido,
    'adicionales_contratados', greatest(coalesce(p_adicionales, 0), 0),
    'limite', v_limite,
    'activos', v_act, 'suspendidos', v_susp, 'pendientes_activacion', v_pend,
    'invitaciones_pendientes', v_inv,
    'operativos', v_act + v_susp + v_pend,
    'ocupados', v_ocup,
    'disponibles', case when v_limite is null then null else greatest(v_limite - v_ocup, 0) end,
    'exceso', case when v_limite is null then 0 else greatest(v_ocup - v_limite, 0) end);
end $$;
revoke all on function public._capacidad_profesional(uuid, text, int, text) from public, anon, authenticated;

-- Lectura para la interfaz (propietario, administrador, equipo del negocio o SuperSU).
create or replace function public.capacidad_profesional_negocio(p_negocio_id uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if not (public.is_admin_de(p_negocio_id) or public.is_staff_de(p_negocio_id) or coalesce(public.is_supersu(), false)) then
    raise exception 'NO_AUTORIZADO';
  end if;
  return public._capacidad_profesional(p_negocio_id);
end $$;
revoke all on function public.capacidad_profesional_negocio(uuid) from public, anon, authenticated;
grant execute on function public.capacidad_profesional_negocio(uuid) to authenticated;

-- ── 2. Triggers de respaldo (cubren escrituras directas a las tablas) ───────────────────
create or replace function public.trg_vinculo_cupo()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_cap jsonb; v_email text;
begin
  -- Respaldo para clientes de la API (rol authenticated/anon, también cuando entran por un RPC definer). Las sesiones de confianza
  -- (migraciones, service_role, fixtures de prueba: rol de sesión distinto) no pasan por aquí; cada RPC valida su cupo de forma explícita.
  if coalesce(current_setting('role', true), '') not in ('authenticated', 'anon') then return new; end if;
  if new.presta_servicios and new.estado <> 'RETIRADO'
     and (tg_op = 'INSERT' or not (old.presta_servicios and old.estado <> 'RETIRADO') or old.negocio_id <> new.negocio_id) then
    perform public._cupo_bloquear(new.negocio_id);
    select lower(email) into v_email from public.perfil where id = new.staff_id;  -- su propia invitación PENDIENTE se está consumiendo
    v_cap := public._capacidad_profesional(new.negocio_id, null, 0, v_email);
    if v_cap is not null and (v_cap ->> 'disponibles') is not null and (v_cap ->> 'disponibles')::int < 1 then
      raise exception 'PLAN_LIMIT_EXCEEDED';
    end if;
  end if;
  return new;
end $$;
revoke all on function public.trg_vinculo_cupo() from public, anon, authenticated;
drop trigger if exists trg_vinculo_cupo on public.vinculo_staff_negocio;
create trigger trg_vinculo_cupo before insert or update of presta_servicios, estado, negocio_id on public.vinculo_staff_negocio
  for each row execute function public.trg_vinculo_cupo();

create or replace function public.trg_invitacion_cupo()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_cap jsonb;
begin
  if coalesce(current_setting('role', true), '') not in ('authenticated', 'anon') then return new; end if;  -- ver trg_vinculo_cupo
  if new.estado = 'PENDIENTE' and new.expira_at > now() and new.rol_invitado in ('BARBER', 'ADMIN_BARBER')
     and (tg_op = 'INSERT' or old.estado <> 'PENDIENTE' or old.expira_at <= now() or old.rol_invitado not in ('BARBER', 'ADMIN_BARBER')) then
    perform public._cupo_bloquear(new.negocio_id);
    v_cap := public._capacidad_profesional(new.negocio_id, null, 0, new.email);
    if v_cap is not null and (v_cap ->> 'disponibles') is not null and (v_cap ->> 'disponibles')::int < 1 then
      raise exception 'PLAN_LIMIT_EXCEEDED';
    end if;
  end if;
  return new;
end $$;
revoke all on function public.trg_invitacion_cupo() from public, anon, authenticated;
drop trigger if exists trg_invitacion_cupo on public.invitacion_staff;
create trigger trg_invitacion_cupo before insert or update of estado, expira_at, rol_invitado on public.invitacion_staff
  for each row execute function public.trg_invitacion_cupo();

-- ── 3. cupo_plan_negocio (149) ahora lee de la función central; mismas claves + las nuevas ──
create or replace function public.cupo_plan_negocio(p_negocio_id uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_plan public.plan; v_siguiente public.plan; v_cap jsonb; v_sedes int;
begin
  if not (public.is_admin_de(p_negocio_id) or public.is_staff_de(p_negocio_id) or public.is_supersu()) then
    raise exception 'NO_AUTORIZADO';
  end if;
  select p.* into v_plan from public.plan p join public.negocio n on n.plan_codigo = p.codigo where n.id = p_negocio_id;
  if not found then return null; end if;
  v_cap := public._capacidad_profesional(p_negocio_id);
  select count(*) into v_sedes from public.sede where negocio_id = p_negocio_id and not cerrada_permanente;
  select s.* into v_siguiente from public.plan s
   where s.codigo <> v_plan.codigo and coalesce(s.staff_incluido, 0) > coalesce(v_plan.staff_incluido, 0)
   order by s.staff_incluido asc limit 1;
  return jsonb_build_object(
    'plan_codigo', v_plan.codigo, 'plan_nombre', v_plan.nombre,
    'staff_tope', v_cap -> 'limite', 'staff_incluido', v_plan.staff_incluido, 'staff_usado', v_cap -> 'ocupados',
    'sedes_tope', v_plan.limite_sedes, 'sedes_usadas', v_sedes,
    'guardian_disponible', v_plan.guardian_disponible,
    'comisiones', public.negocio_tiene_funcion(p_negocio_id, 'comisiones_turnos'),
    'siguiente_codigo', v_siguiente.codigo, 'siguiente_nombre', v_siguiente.nombre, 'siguiente_staff', v_siguiente.staff_incluido,
    'capacidad', v_cap,
    'perfil_propietario', jsonb_build_object('por_defecto', v_plan.propietario_profesional_por_defecto, 'auto_alta', v_plan.propietario_perfil_auto_alta,
      'puede_activar', v_plan.propietario_puede_activar_perfil, 'puede_desactivar', v_plan.propietario_puede_desactivar_perfil));
end $$;
revoke all on function public.cupo_plan_negocio(uuid) from public, anon, authenticated;
grant execute on function public.cupo_plan_negocio(uuid) to authenticated;

-- ── 4. crear_invitacion_staff: rol invitado + cupo central + lock (firma NUEVA: se elimina la vieja) ──
do $$
declare v_def text; v_ancla text; v_nuevo text;
  v_a_cab constant text := 'p_comision_pct numeric DEFAULT NULL::numeric)';
  v_a_decl constant text := E'  v_invitacion public.invitacion_staff;\nbegin';
  v_a_auth constant text := E'  if not public.is_barberia_de(p_negocio_id) then\n    raise exception ''NO_AUTORIZADO'';\n  end if;';
  v_a_cupo constant text := E'  select\n    (select count(*) from public.vinculo_staff_negocio\n      where negocio_id = p_negocio_id and estado in (''ACTIVO'', ''SUSPENDIDO'', ''INVITADO''))\n    + (select count(*) from public.invitacion_staff\n        where negocio_id = p_negocio_id and estado = ''PENDIENTE'' and email <> v_email)\n  into v_conteo;\n\n  if v_plan.staff_tope_absoluto is not null and v_conteo >= v_plan.staff_tope_absoluto then\n    raise exception ''PLAN_LIMIT_EXCEEDED'';\n  end if;';
  v_a_ins constant text := E'insert into public.invitacion_staff (negocio_id, email, sede_id, comision_pct, invitado_por)\n  values (p_negocio_id, v_email, p_sede_id, p_comision_pct, auth.uid())\n  on conflict (negocio_id, email) do update\n    set estado = ''PENDIENTE'',';
  v_a_aud constant text := 'jsonb_build_object(''email'', v_invitacion.email, ''sede_id'', p_sede_id));';
begin
  if to_regprocedure('public.crear_invitacion_staff(uuid,text,uuid,numeric,text)') is not null then return; end if;  -- ya migrada
  v_def := pg_get_functiondef('public.crear_invitacion_staff(uuid,text,uuid,numeric)'::regprocedure);
  foreach v_ancla in array array[v_a_cab, v_a_decl, v_a_auth, v_a_cupo, v_a_ins, v_a_aud] loop
    if position(v_ancla in v_def) = 0 then raise exception 'ANCLA_NO_ENCONTRADA crear_invitacion_staff: %', left(v_ancla, 60); end if;
  end loop;
  v_nuevo := v_def;
  v_nuevo := replace(v_nuevo, v_a_cab, 'p_comision_pct numeric DEFAULT NULL::numeric, p_rol text DEFAULT ''BARBER''::text)');
  v_nuevo := replace(v_nuevo, v_a_decl, E'  v_invitacion public.invitacion_staff;\n  v_cap jsonb;\nbegin');
  v_nuevo := replace(v_nuevo, v_a_auth,
    E'  if p_rol is null or p_rol not in (''BARBER'', ''BUSINESS_ADMIN'', ''ADMIN_BARBER'') then\n    raise exception ''ROL_INVALIDO'';\n  end if;\n'
    || E'  -- El propietario invita cualquier rol; un administrador delegado solo invita BARBER (no puede crear otros administradores).\n'
    || E'  if not (public.is_barberia_de(p_negocio_id) or (p_rol = ''BARBER'' and public.is_admin_de(p_negocio_id))) then\n    raise exception ''NO_AUTORIZADO'';\n  end if;\n'
    || E'  if p_rol = ''BUSINESS_ADMIN'' and p_comision_pct is not null then\n    raise exception ''COMISION_NO_APLICA_A_ADMINISTRADOR'';\n  end if;');
  v_nuevo := replace(v_nuevo, v_a_cupo,
    E'  -- Cupo: función central + lock por negocio. Una invitación a BUSINESS_ADMIN (no presta servicios) no consume cupo.\n'
    || E'  if p_rol in (''BARBER'', ''ADMIN_BARBER'') then\n    perform public._cupo_bloquear(p_negocio_id);\n'
    || E'    v_cap := public._capacidad_profesional(p_negocio_id, null, 0, v_email);\n'
    || E'    if (v_cap ->> ''disponibles'') is not null and (v_cap ->> ''disponibles'')::int < 1 then\n      raise exception ''PLAN_LIMIT_EXCEEDED'';\n    end if;\n  end if;');
  v_nuevo := replace(v_nuevo, v_a_ins,
    E'insert into public.invitacion_staff (negocio_id, email, sede_id, comision_pct, invitado_por, rol_invitado)\n'
    || E'  values (p_negocio_id, v_email, p_sede_id, p_comision_pct, auth.uid(), p_rol)\n  on conflict (negocio_id, email) do update\n'
    || E'    set rol_invitado = excluded.rol_invitado,\n        estado = ''PENDIENTE'',');
  v_nuevo := replace(v_nuevo, v_a_aud, 'jsonb_build_object(''email'', v_invitacion.email, ''sede_id'', p_sede_id, ''rol'', p_rol));');
  execute v_nuevo;
  drop function public.crear_invitacion_staff(uuid, text, uuid, numeric);  -- sin esto, la llamada de 3 argumentos queda ambigua
end $$;
revoke all on function public.crear_invitacion_staff(uuid, text, uuid, numeric, text) from public, anon, authenticated;
grant execute on function public.crear_invitacion_staff(uuid, text, uuid, numeric, text) to authenticated;

-- ── 5. responder_invitacion: cupo central y capacidades según el rol invitado ───────────
do $$
declare v_def text; v_ancla text; v_nuevo text;
  v_a_decl constant text := E'  v_perfil_nombre text;\nbegin';
  v_a_cupo constant text := E'  select p.* into v_plan from public.plan p\n  join public.negocio n on n.plan_codigo = p.codigo where n.id = v_invitacion.negocio_id;\n  select count(*) into v_conteo from public.vinculo_staff_negocio\n    where negocio_id = v_invitacion.negocio_id and estado in (''ACTIVO'', ''SUSPENDIDO'');\n  if v_plan.staff_tope_absoluto is not null and v_conteo >= v_plan.staff_tope_absoluto then\n    raise exception ''PLAN_LIMIT_EXCEEDED'';\n  end if;';
  v_a_upd constant text := E'es_guardian = false\n    where id = v_vinculo_existente.id';
  v_a_ins constant text := E'insert into public.vinculo_staff_negocio (staff_id, negocio_id, sede_activa_id, comision_pct, estado, fecha_ingreso)\n    values (auth.uid(), v_invitacion.negocio_id, v_sede_id, v_invitacion.comision_pct, ''ACTIVO'', now())';
begin
  v_def := pg_get_functiondef('public.responder_invitacion(uuid,boolean)'::regprocedure);
  if position('rol_invitado' in v_def) > 0 then return; end if;  -- ya migrada
  foreach v_ancla in array array[v_a_decl, v_a_cupo, v_a_upd, v_a_ins] loop
    if position(v_ancla in v_def) = 0 then raise exception 'ANCLA_NO_ENCONTRADA responder_invitacion: %', left(v_ancla, 60); end if;
  end loop;
  v_nuevo := v_def;
  v_nuevo := replace(v_nuevo, v_a_decl, E'  v_perfil_nombre text;\n  v_cap jsonb;\nbegin');
  v_nuevo := replace(v_nuevo, v_a_cupo,
    E'  -- Cupo: misma función central que al invitar; la propia invitación (PENDIENTE) no cuenta dos veces. BUSINESS_ADMIN no consume.\n'
    || E'  if v_invitacion.rol_invitado in (''BARBER'', ''ADMIN_BARBER'') then\n    perform public._cupo_bloquear(v_invitacion.negocio_id);\n'
    || E'    v_cap := public._capacidad_profesional(v_invitacion.negocio_id, null, 0, v_invitacion.email);\n'
    || E'    if (v_cap ->> ''disponibles'') is not null and (v_cap ->> ''disponibles'')::int < 1 then\n      raise exception ''PLAN_LIMIT_EXCEEDED'';\n    end if;\n  end if;');
  v_nuevo := replace(v_nuevo, v_a_upd,
    E'es_guardian = false,\n        es_admin = (v_invitacion.rol_invitado in (''BUSINESS_ADMIN'', ''ADMIN_BARBER'')),\n'
    || E'        presta_servicios = (v_invitacion.rol_invitado in (''BARBER'', ''ADMIN_BARBER''))\n    where id = v_vinculo_existente.id');
  v_nuevo := replace(v_nuevo, v_a_ins,
    E'insert into public.vinculo_staff_negocio (staff_id, negocio_id, sede_activa_id, comision_pct, estado, fecha_ingreso, es_admin, presta_servicios)\n'
    || E'    values (auth.uid(), v_invitacion.negocio_id, v_sede_id, v_invitacion.comision_pct, ''ACTIVO'', now(),\n'
    || E'            v_invitacion.rol_invitado in (''BUSINESS_ADMIN'', ''ADMIN_BARBER''), v_invitacion.rol_invitado in (''BARBER'', ''ADMIN_BARBER''))');
  execute v_nuevo;
end $$;

-- ── 6. Downgrade (049): el mismo criterio que el resto ──────────────────────────────────
do $$
declare v_def text; v_ancla text; v_nuevo text;
  v_a_decl constant text := E'  v_staff_activo int;\nbegin';
  v_a_cnt constant text := E'  select count(*) into v_staff_activo from public.vinculo_staff_negocio\n  where negocio_id = p_negocio_id and estado = ''ACTIVO'';\n  if v_plan_destino.staff_tope_absoluto is not null and v_staff_activo > v_plan_destino.staff_tope_absoluto then';
begin
  v_def := pg_get_functiondef('public.solicitar_downgrade_plan(uuid,plan_codigo)'::regprocedure);
  if position('_capacidad_profesional' in v_def) > 0 then return; end if;
  foreach v_ancla in array array[v_a_decl, v_a_cnt] loop
    if position(v_ancla in v_def) = 0 then raise exception 'ANCLA_NO_ENCONTRADA solicitar_downgrade_plan: %', left(v_ancla, 60); end if;
  end loop;
  v_nuevo := replace(v_def, v_a_decl, E'  v_staff_activo int;\n  v_cap jsonb;\nbegin');
  v_nuevo := replace(v_nuevo, v_a_cnt,
    E'  -- Profesionales operativos (con perfil profesional, incluido el del propietario) frente al límite del plan DESTINO.\n'
    || E'  v_cap := public._capacidad_profesional(p_negocio_id, p_plan_codigo_destino::text);\n'
    || E'  v_staff_activo := (v_cap ->> ''operativos'')::int;\n'
    || E'  if (v_cap ->> ''limite'') is not null and v_staff_activo > (v_cap ->> ''limite'')::int then');
  execute v_nuevo;
end $$;

do $$
declare v_def text; v_ancla text; v_nuevo text;
  v_a_decl constant text := E'  v_staff_activo int;\n  v_ejecutados int := 0;';
  v_a_cnt constant text := E'    select count(*) into v_staff_activo from public.vinculo_staff_negocio\n    where negocio_id = v_row.negocio_id and estado = ''ACTIVO'';\n\n    if (v_plan_destino.limite_sedes is not null and v_sedes_activas > v_plan_destino.limite_sedes)\n       or (v_plan_destino.staff_tope_absoluto is not null and v_staff_activo > v_plan_destino.staff_tope_absoluto) then';
begin
  v_def := pg_get_functiondef('public.ejecutar_downgrades_programados()'::regprocedure);
  if position('_capacidad_profesional' in v_def) > 0 then return; end if;
  foreach v_ancla in array array[v_a_decl, v_a_cnt] loop
    if position(v_ancla in v_def) = 0 then raise exception 'ANCLA_NO_ENCONTRADA ejecutar_downgrades_programados: %', left(v_ancla, 60); end if;
  end loop;
  v_nuevo := replace(v_def, v_a_decl, E'  v_staff_activo int;\n  v_cap jsonb;\n  v_ejecutados int := 0;');
  v_nuevo := replace(v_nuevo, v_a_cnt,
    E'    v_cap := public._capacidad_profesional(v_row.negocio_id, v_row.plan_codigo_destino::text);\n'
    || E'    v_staff_activo := (v_cap ->> ''operativos'')::int;\n\n'
    || E'    if (v_plan_destino.limite_sedes is not null and v_sedes_activas > v_plan_destino.limite_sedes)\n'
    || E'       or ((v_cap ->> ''limite'') is not null and v_staff_activo > (v_cap ->> ''limite'')::int) then');
  execute v_nuevo;
end $$;

-- ── 7. Cambio de rol: no evade el tope ──────────────────────────────────────────────────
-- Solo el propietario. BUSINESS_ADMIN -> BARBER/ADMIN_BARBER pasa a ocupar cupo (se valida aquí y en trg_vinculo_cupo);
-- BARBER -> BUSINESS_ADMIN libera cupo pero se bloquea si tiene reservas futuras asignadas. El propietario no cambia de rol aquí.
create or replace function public.cambiar_rol_equipo(p_vinculo_id uuid, p_rol text)
returns public.vinculo_staff_negocio language plpgsql security definer set search_path = public as $$
declare
  v public.vinculo_staff_negocio; v_cap jsonb;
  v_admin boolean; v_presta boolean; v_futuras int;
begin
  if auth.uid() is null then raise exception 'NO_AUTENTICADO'; end if;
  if p_rol is null or p_rol not in ('BARBER', 'BUSINESS_ADMIN', 'ADMIN_BARBER') then raise exception 'ROL_INVALIDO'; end if;
  select * into v from public.vinculo_staff_negocio where id = p_vinculo_id;
  if not found or not public.is_barberia_de(v.negocio_id) then raise exception 'NO_AUTORIZADO'; end if;
  perform public._cupo_bloquear(v.negocio_id);
  select * into v from public.vinculo_staff_negocio where id = p_vinculo_id for update;
  if v.estado = 'RETIRADO' then raise exception 'STAFF_YA_RETIRADO'; end if;
  if exists (select 1 from public.negocio n where n.id = v.negocio_id and n.owner_user_id = v.staff_id) then
    raise exception 'ROL_PROPIETARIO_NO_CAMBIA';  -- el perfil del propietario se activa/desactiva con sus propias funciones
  end if;
  v_admin := p_rol in ('BUSINESS_ADMIN', 'ADMIN_BARBER');
  v_presta := p_rol in ('BARBER', 'ADMIN_BARBER');
  if v_admin = v.es_admin and v_presta = v.presta_servicios then return v; end if;  -- idempotente

  if v_presta and not v.presta_servicios then
    v_cap := public._capacidad_profesional(v.negocio_id);  -- este vínculo hoy no ocupa cupo: no se excluye nada
    if (v_cap ->> 'disponibles') is not null and (v_cap ->> 'disponibles')::int < 1 then raise exception 'PLAN_LIMIT_EXCEEDED'; end if;
  end if;
  if v.presta_servicios and not v_presta then
    select count(*) into v_futuras from public.reserva r
     where r.staff_id = v.staff_id and r.negocio_id = v.negocio_id
       and r.estado in ('PENDIENTE_PAGO', 'CONFIRMADA', 'EN_CURSO') and r.hora_inicio > now();
    if v_futuras > 0 then raise exception 'TIENE_RESERVAS_FUTURAS'; end if;
  end if;

  update public.vinculo_staff_negocio set es_admin = v_admin, presta_servicios = v_presta where id = p_vinculo_id returning * into v;
  -- No se llama a incrementar_session_version: el trigger perfil_proteger_columnas_sensibles lo rechaza dentro de funciones definer
  -- invocadas por un usuario (defecto preexistente, ver informe). El rol se resuelve en cada solicitud, sin caché de sesión.
  insert into public.evento_auditoria (entidad_tipo, entidad_id, accion, actor_tipo, actor_id, negocio_id, payload_despues)
  values ('vinculo_staff_negocio', p_vinculo_id, 'STAFF_ROL_CAMBIADO', 'BARBERIA', auth.uid(), v.negocio_id, jsonb_build_object('rol', p_rol));
  return v;
end $$;
revoke all on function public.cambiar_rol_equipo(uuid, text) from public, anon, authenticated;
grant execute on function public.cambiar_rol_equipo(uuid, text) to authenticated;

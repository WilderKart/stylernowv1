-- 160: perfil profesional del propietario (FASE 1, 2026-11-18).
--
-- El propietario NO es profesional por el solo hecho de ser propietario: administra. Si además atiende, activa su propio perfil
-- profesional: una fila staff + un vínculo ACTIVO con presta_servicios=true (consume cupo, como cualquier profesional). Así una misma
-- cuenta administra y atiende, sin duplicar correo, celular ni identidad.
-- TODO lo comercial sale de la configuración por plan (columnas de 158, editables por SuperSU en /admin/planes con motivo y auditoría):
--   · propietario_perfil_auto_alta        -> completar_onboarding_negocio lo activa al cerrar el alta (hoy solo Essential)
--   · propietario_puede_activar_perfil    -> activar_perfil_profesional_propietario lo permite
--   · propietario_puede_desactivar_perfil -> desactivar_perfil_profesional_propietario lo permite
--   · propietario_profesional_por_defecto -> lo usa la normalización de datos existentes (163)
-- Reglas: sin sede operativa NO se crea vínculo (estado SIN_SEDE); consume cupo; se bloquea si no hay; desactivar retira el vínculo
-- (conserva fila e historial, como retirar_staff) y se BLOQUEA si hay reservas futuras asignadas. Publicarse en la agenda pública es
-- OTRA cosa: exige foto profesional + consentimiento expreso (staff_es_publicable), ver el informe de la Fase 1.
-- Rollback: 160_perfil_profesional_del_propietario_REVERSION.sql.txt.

-- Interno: devuelve un estado en vez de lanzar, para que completar_onboarding_negocio no se caiga por un caso no crítico.
-- Estados: ACTIVADO | YA_ACTIVO | SIN_CUPO | SIN_SEDE | OMITIDO_VINCULO_EN_OTRO_NEGOCIO.  Lanza NO_AUTORIZADO si p_usuario no es el propietario.
-- p_ignorar_cupo: solo para la normalización de datos (163), que debe marcar el exceso en vez de rechazarlo; nunca se expone a clientes.
create or replace function public._activar_perfil_propietario(p_negocio_id uuid, p_usuario_id uuid, p_ignorar_cupo boolean default false)
returns text language plpgsql security definer set search_path = public as $$
declare
  v_vin public.vinculo_staff_negocio; v_ret public.vinculo_staff_negocio; v_cap jsonb; v_sede uuid; v_nombre text; v_tiene boolean;
begin
  if p_usuario_id is null or not exists (select 1 from public.negocio n where n.id = p_negocio_id and n.owner_user_id = p_usuario_id) then
    raise exception 'NO_AUTORIZADO';
  end if;
  perform public._cupo_bloquear(p_negocio_id);

  select * into v_vin from public.vinculo_staff_negocio where staff_id = p_usuario_id and estado <> 'RETIRADO' limit 1;
  v_tiene := found;  -- los SELECT siguientes pisan FOUND
  if v_tiene and v_vin.negocio_id <> p_negocio_id then return 'OMITIDO_VINCULO_EN_OTRO_NEGOCIO'; end if;  -- ADL-009: un solo vínculo vigente por persona
  if v_tiene and v_vin.presta_servicios and v_vin.estado = 'ACTIVO' then return 'YA_ACTIVO'; end if;

  -- Nunca se crea un vínculo sin una sede válida (operativa) a la que asignarlo.
  select s.id into v_sede from public.sede s
   where s.negocio_id = p_negocio_id and not s.cerrada_permanente and not s.cerrada_temporalmente
   order by s.es_principal desc, s.created_at asc limit 1;
  if v_sede is null then return 'SIN_SEDE'; end if;

  if v_tiene then
    if not v_vin.presta_servicios then  -- vínculo propio sin perfil profesional (no lo crea ninguna función; se corrige por seguridad)
      v_cap := public._capacidad_profesional(p_negocio_id);
      if not p_ignorar_cupo and (v_cap ->> 'disponibles') is not null and (v_cap ->> 'disponibles')::int < 1 then return 'SIN_CUPO'; end if;
    end if;
    update public.vinculo_staff_negocio set presta_servicios = true, estado = 'ACTIVO', sede_activa_id = coalesce(sede_activa_id, v_sede)
     where id = v_vin.id;
  else
    v_cap := public._capacidad_profesional(p_negocio_id);
    if not p_ignorar_cupo and v_cap is not null and (v_cap ->> 'disponibles') is not null and (v_cap ->> 'disponibles')::int < 1 then return 'SIN_CUPO'; end if;
    select coalesce(p.nombre, 'Propietario') into v_nombre from public.perfil p where p.id = p_usuario_id;
    insert into public.staff (usuario_id, nombre) values (p_usuario_id, coalesce(v_nombre, 'Propietario')) on conflict (usuario_id) do nothing;
    select * into v_ret from public.vinculo_staff_negocio where staff_id = p_usuario_id and negocio_id = p_negocio_id order by created_at desc limit 1;
    if found then  -- reingreso: se reactiva la MISMA fila para no perder historial de nivel (indexado por vinculo_id)
      update public.vinculo_staff_negocio
         set estado = 'ACTIVO', presta_servicios = true, es_admin = false, es_guardian = false,
             sede_activa_id = v_sede, fecha_ingreso = coalesce(fecha_ingreso, now())
       where id = v_ret.id;
    else
      insert into public.vinculo_staff_negocio (staff_id, negocio_id, sede_activa_id, estado, es_admin, presta_servicios, fecha_ingreso)
      values (p_usuario_id, p_negocio_id, v_sede, 'ACTIVO', false, true, now());
    end if;
  end if;
  insert into public.evento_auditoria (entidad_tipo, entidad_id, accion, actor_tipo, actor_id, negocio_id)
  values ('negocio', p_negocio_id, 'PERFIL_PROFESIONAL_PROPIETARIO_ACTIVADO', 'BARBERIA', p_usuario_id, p_negocio_id);
  return 'ACTIVADO';
end $$;
revoke all on function public._activar_perfil_propietario(uuid, uuid, boolean) from public, anon, authenticated;

create or replace function public.activar_perfil_profesional_propietario(p_negocio_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_estado text;
begin
  if auth.uid() is null then raise exception 'NO_AUTENTICADO'; end if;
  if not public.is_barberia_de(p_negocio_id) then raise exception 'NO_AUTORIZADO'; end if;  -- solo el propietario, no un administrador delegado
  if not coalesce((select p.propietario_puede_activar_perfil from public.plan p join public.negocio n on n.plan_codigo = p.codigo
                   where n.id = p_negocio_id), false) then
    raise exception 'PERFIL_NO_PERMITIDO_POR_PLAN';
  end if;
  v_estado := public._activar_perfil_propietario(p_negocio_id, auth.uid());
  if v_estado = 'SIN_CUPO' then raise exception 'PLAN_LIMIT_EXCEEDED'; end if;
  if v_estado = 'SIN_SEDE' then raise exception 'FALTA_SEDE'; end if;
  if v_estado = 'OMITIDO_VINCULO_EN_OTRO_NEGOCIO' then raise exception 'YA_TIENE_VINCULO_ACTIVO'; end if;
  return jsonb_build_object('estado', v_estado, 'capacidad', public._capacidad_profesional(p_negocio_id));
end $$;
revoke all on function public.activar_perfil_profesional_propietario(uuid) from public, anon, authenticated;
grant execute on function public.activar_perfil_profesional_propietario(uuid) to authenticated;

create or replace function public.desactivar_perfil_profesional_propietario(p_negocio_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v public.vinculo_staff_negocio; v_futuras int;
begin
  if auth.uid() is null then raise exception 'NO_AUTENTICADO'; end if;
  if not public.is_barberia_de(p_negocio_id) then raise exception 'NO_AUTORIZADO'; end if;
  if not coalesce((select p.propietario_puede_desactivar_perfil from public.plan p join public.negocio n on n.plan_codigo = p.codigo
                   where n.id = p_negocio_id), false) then
    raise exception 'DESACTIVAR_NO_PERMITIDO_POR_PLAN';
  end if;
  perform public._cupo_bloquear(p_negocio_id);
  select * into v from public.vinculo_staff_negocio
   where staff_id = auth.uid() and negocio_id = p_negocio_id and estado <> 'RETIRADO' for update;
  if not found then return jsonb_build_object('estado', 'YA_INACTIVO', 'capacidad', public._capacidad_profesional(p_negocio_id)); end if;
  select count(*) into v_futuras from public.reserva r
   where r.staff_id = auth.uid() and r.negocio_id = p_negocio_id
     and r.estado in ('PENDIENTE_PAGO', 'CONFIRMADA', 'EN_CURSO') and r.hora_inicio > now();
  if v_futuras > 0 then raise exception 'TIENE_RESERVAS_FUTURAS'; end if;  -- reasignarlas o cancelarlas primero
  update public.vinculo_staff_negocio set estado = 'RETIRADO', es_guardian = false where id = v.id;
  insert into public.evento_auditoria (entidad_tipo, entidad_id, accion, actor_tipo, actor_id, negocio_id)
  values ('negocio', p_negocio_id, 'PERFIL_PROFESIONAL_PROPIETARIO_DESACTIVADO', 'BARBERIA', auth.uid(), p_negocio_id);
  return jsonb_build_object('estado', 'DESACTIVADO', 'capacidad', public._capacidad_profesional(p_negocio_id));
end $$;
revoke all on function public.desactivar_perfil_profesional_propietario(uuid) from public, anon, authenticated;
grant execute on function public.desactivar_perfil_profesional_propietario(uuid) to authenticated;

-- SuperSU: configura el perfil del propietario de un plan. Motivo obligatorio y auditoría (con el valor anterior y el nuevo).
create or replace function public.admin_configurar_perfil_propietario_plan(
  p_plan public.plan_codigo, p_por_defecto boolean, p_auto_alta boolean, p_puede_activar boolean, p_puede_desactivar boolean, p_motivo text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_ant public.plan; v_nuevo public.plan;
begin
  if not coalesce(public.is_supersu(), false) then raise exception 'NO_AUTORIZADO'; end if;
  if length(btrim(coalesce(p_motivo, ''))) < 10 then raise exception 'MOTIVO_REQUERIDO'; end if;
  if p_por_defecto is null or p_auto_alta is null or p_puede_activar is null or p_puede_desactivar is null then raise exception 'CONFIGURACION_INVALIDA'; end if;
  -- Incoherente: obligar a un perfil que el propietario no puede activar.
  if (p_por_defecto or p_auto_alta) and not p_puede_activar then raise exception 'CONFIGURACION_INCOHERENTE'; end if;
  select * into v_ant from public.plan where codigo = p_plan for update;
  if not found then raise exception 'PLAN_NO_ENCONTRADO'; end if;
  update public.plan set propietario_profesional_por_defecto = p_por_defecto, propietario_perfil_auto_alta = p_auto_alta,
         propietario_puede_activar_perfil = p_puede_activar, propietario_puede_desactivar_perfil = p_puede_desactivar, updated_at = now()
   where codigo = p_plan returning * into v_nuevo;
  insert into public.evento_auditoria (entidad_tipo, entidad_id, accion, actor_tipo, actor_id, payload_antes, payload_despues, motivo, origen)
  values ('plan', md5('plan:' || p_plan::text)::uuid, 'PLAN_PERFIL_PROPIETARIO_CONFIGURADO', 'SUPERSU', auth.uid(),
          jsonb_build_object('plan', p_plan, 'por_defecto', v_ant.propietario_profesional_por_defecto, 'auto_alta', v_ant.propietario_perfil_auto_alta,
                             'puede_activar', v_ant.propietario_puede_activar_perfil, 'puede_desactivar', v_ant.propietario_puede_desactivar_perfil),
          jsonb_build_object('plan', p_plan, 'por_defecto', p_por_defecto, 'auto_alta', p_auto_alta,
                             'puede_activar', p_puede_activar, 'puede_desactivar', p_puede_desactivar),
          btrim(p_motivo), 'PANEL');
  return jsonb_build_object('plan', p_plan, 'por_defecto', p_por_defecto, 'auto_alta', p_auto_alta,
                            'puede_activar', p_puede_activar, 'puede_desactivar', p_puede_desactivar);
end $$;
revoke all on function public.admin_configurar_perfil_propietario_plan(public.plan_codigo, boolean, boolean, boolean, boolean, text) from public, anon, authenticated;
grant execute on function public.admin_configurar_perfil_propietario_plan(public.plan_codigo, boolean, boolean, boolean, boolean, text) to authenticated;  -- el cuerpo exige is_supersu()

-- completar_onboarding_negocio (157): si la configuración del plan lo indica, el propietario queda habilitado como profesional.
do $$
declare v_def text;
  v_ancla constant text := E'''ONBOARDING_COMPLETADO'', ''BARBERIA'', auth.uid(), p_negocio_id);';
begin
  v_def := pg_get_functiondef('public.completar_onboarding_negocio(uuid)'::regprocedure);
  if position('_activar_perfil_propietario' in v_def) > 0 then return; end if;  -- ya migrada
  if position(v_ancla in v_def) = 0 then raise exception 'ANCLA_NO_ENCONTRADA completar_onboarding_negocio'; end if;
  execute replace(v_def, v_ancla, v_ancla
    || E'\n  -- Perfil profesional del propietario según la configuración del plan. Un estado distinto de ACTIVADO no impide cerrar el alta.\n'
    || E'  if coalesce((select p.propietario_perfil_auto_alta from public.plan p where p.codigo = v_neg.plan_codigo), false) then\n'
    || E'    perform public._activar_perfil_propietario(p_negocio_id, auth.uid());\n  end if;');
end $$;

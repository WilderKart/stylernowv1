-- 163: NORMALIZACIÓN de los negocios existentes al modelo de roles (FASE 1, 2026-11-18). (Antes llamada 155.)
--
-- Autorizada por el usuario solo sobre la base LOCAL (todos los negocios son de prueba). Sin ningún DELETE. Idempotente.
-- Reglas (ajustadas por el usuario tras revisar el informe previo):
--   · Planes con plan.propietario_profesional_por_defecto (hoy Essential): el propietario queda habilitado como profesional SOLO si el alta
--     está COMPLETA (negocio.onboarding_completo) y el negocio tiene una sede operativa válida. Un negocio con el alta incompleta no se toca
--     (recibirá el perfil al completar el alta, según propietario_perfil_auto_alta). Un negocio completo pero SIN sede se OMITE y queda
--     registrado (evento NORMALIZACION_FASE1_OMITIDA con el motivo); nunca se crea un vínculo sin sede.
--   · Demás planes: el propietario es solo administrativo. Si hoy figura como profesional (vínculo propio no RETIRADO) se desvincula del
--     modelo antiguo (estado RETIRADO; fila, historial, reservas, servicios y disponibilidad se conservan) y puede reactivarse con
--     activar_perfil_profesional_propietario. Con reservas futuras asignadas NO se toca (queda avisado).
--   · El exceso NO se corrige: no se elimina ni se retira a ningún empleado, no se cancela ninguna invitación, nadie se desvincula para
--     «cuadrar». El exceso se REGISTRA (evento CUPO_EXCEDIDO_DETECTADO con ocupados y límite); desde entonces la función central lo reporta
--     (`exceso`), los disparadores bloquean cualquier invitación o vínculo que lo aumente, y el administrador puede normalizar el equipo
--     (retirar, cancelar invitaciones, cambiar a administrador puro o subir de plan).
-- Rollback: 163_normalizacion_roles_existentes_REVERSION.sql.txt (usa los eventos NORMALIZACION_FASE1_* como registro).

do $$
declare
  r record; v_estado text; v_vin uuid; v_cap jsonb; v_futuras int;
begin
  -- A. Planes donde el propietario atiende por defecto: solo altas completas.
  for r in
    select n.id as negocio_id, n.owner_user_id
      from public.negocio n join public.plan p on p.codigo = n.plan_codigo
     where p.propietario_profesional_por_defecto and n.onboarding_completo
     order by n.created_at
  loop
    v_estado := public._activar_perfil_propietario(r.negocio_id, r.owner_user_id, true);  -- true: marca el exceso, no lo rechaza
    if v_estado = 'ACTIVADO' then
      select id into v_vin from public.vinculo_staff_negocio
       where staff_id = r.owner_user_id and negocio_id = r.negocio_id and estado <> 'RETIRADO' limit 1;
      insert into public.evento_auditoria (entidad_tipo, entidad_id, accion, actor_tipo, negocio_id, payload_despues, motivo, origen)
      values ('negocio', r.negocio_id, 'NORMALIZACION_FASE1_PERFIL_PROPIETARIO', 'SISTEMA', r.negocio_id,
              jsonb_build_object('resultado', 'ACTIVADO', 'vinculo_id', v_vin),
              'Normalización al modelo de roles: propietario habilitado como profesional', 'SQL');
    elsif v_estado in ('SIN_SEDE', 'OMITIDO_VINCULO_EN_OTRO_NEGOCIO') then
      -- Una sola marca por negocio y motivo (idempotente).
      if not exists (select 1 from public.evento_auditoria e where e.negocio_id = r.negocio_id and e.accion = 'NORMALIZACION_FASE1_OMITIDA'
                      and e.payload_despues ->> 'motivo' = v_estado) then
        insert into public.evento_auditoria (entidad_tipo, entidad_id, accion, actor_tipo, negocio_id, payload_despues, motivo, origen)
        values ('negocio', r.negocio_id, 'NORMALIZACION_FASE1_OMITIDA', 'SISTEMA', r.negocio_id,
                jsonb_build_object('motivo', v_estado),
                case v_estado when 'SIN_SEDE' then 'Omitido: el negocio no tiene una sede operativa válida; no se crea vínculo sin sede'
                              else 'Omitido: el propietario ya es profesional de otro negocio (un solo vínculo vigente por persona)' end, 'SQL');
      end if;
      raise notice 'NORMALIZACION: negocio % omitido (%)', r.negocio_id, v_estado;
    end if;
  end loop;

  -- B. Planes donde el propietario solo administra: se desvincula el perfil profesional heredado del modelo antiguo.
  for r in
    select n.id as negocio_id, n.owner_user_id, v.id as vinculo_id
      from public.negocio n
      join public.plan p on p.codigo = n.plan_codigo and not p.propietario_profesional_por_defecto
      join public.vinculo_staff_negocio v on v.negocio_id = n.id and v.staff_id = n.owner_user_id and v.estado <> 'RETIRADO'
  loop
    select count(*) into v_futuras from public.reserva x
     where x.staff_id = r.owner_user_id and x.negocio_id = r.negocio_id
       and x.estado in ('PENDIENTE_PAGO', 'CONFIRMADA', 'EN_CURSO') and x.hora_inicio > now();
    if v_futuras > 0 then
      raise notice 'NORMALIZACION: el propietario del negocio % tiene % reservas futuras asignadas; NO se desvincula', r.negocio_id, v_futuras;
      continue;
    end if;
    update public.vinculo_staff_negocio set estado = 'RETIRADO', es_guardian = false where id = r.vinculo_id;
    insert into public.evento_auditoria (entidad_tipo, entidad_id, accion, actor_tipo, negocio_id, payload_despues, motivo, origen)
    values ('negocio', r.negocio_id, 'NORMALIZACION_FASE1_PERFIL_PROPIETARIO', 'SISTEMA', r.negocio_id,
            jsonb_build_object('resultado', 'RETIRADO_DEL_MODELO_ANTIGUO', 'vinculo_id', r.vinculo_id),
            'Normalización: propietario de plan superior solo administra; puede reactivar su perfil profesional', 'SQL');
  end loop;

  -- C. Registro de exceso (no corrige nada: ver reglas arriba).
  for r in select n.id as negocio_id from public.negocio n order by n.created_at loop
    v_cap := public._capacidad_profesional(r.negocio_id);
    if v_cap is not null and (v_cap ->> 'exceso')::int > 0
       and not exists (select 1 from public.evento_auditoria e where e.negocio_id = r.negocio_id and e.accion = 'CUPO_EXCEDIDO_DETECTADO'
                       and e.payload_despues -> 'capacidad' = v_cap) then
      insert into public.evento_auditoria (entidad_tipo, entidad_id, accion, actor_tipo, negocio_id, payload_despues, motivo, origen)
      values ('negocio', r.negocio_id, 'CUPO_EXCEDIDO_DETECTADO', 'SISTEMA', r.negocio_id,
              jsonb_build_object('capacidad', v_cap, 'ocupados', v_cap -> 'ocupados', 'limite', v_cap -> 'limite'),
              'Exceso de cupo: no se retira a nadie ni se cancela ninguna invitación; se bloquea todo lo que lo aumente', 'SQL');
    end if;
  end loop;
end $$;

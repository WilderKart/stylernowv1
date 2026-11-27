-- 206 — La barbería (propietaria) puede definir el horario semanal de una persona de su equipo.
-- Motivo: si el barbero no configura su horario, no hay disponibilidad y no se puede reservar con él. La propietaria debe poder prestarle la asistencia.
-- Reutiliza _validar_semana / _aplicar_semana (las mismas del horario que propone el barbero), exige ser PROPIETARIA del negocio (is_barberia_de:
-- el SuperSU y el soporte no entran), valida sede/vínculo, deja auditoría y cancela cualquier propuesta pendiente del barbero para esa sede.
-- No toca slots_disponibles ni ninguna regla de disponibilidad.

create or replace function public.propietario_definir_horario_staff(p_vinculo_id uuid, p_sede_id uuid, p_dias jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v public.vinculo_staff_negocio;
  v_antes jsonb;
begin
  if auth.uid() is null then raise exception 'NO_AUTENTICADO'; end if;

  select * into v from public.vinculo_staff_negocio where id = p_vinculo_id for update;
  -- Mismo mensaje si no existe o si no es suyo: no se revela la existencia de vínculos ajenos.
  if not found or v.estado <> 'ACTIVO' or not coalesce(public.is_barberia_de(v.negocio_id), false) then
    raise exception 'NO_AUTORIZADO';
  end if;
  if not v.presta_servicios then raise exception 'NO_PRESTA_SERVICIOS'; end if;
  if not exists (select 1 from public.sede where id = p_sede_id and negocio_id = v.negocio_id) then raise exception 'SEDE_INVALIDA'; end if;
  if v.sede_activa_id is not null and v.sede_activa_id <> p_sede_id then raise exception 'SEDE_INVALIDA'; end if;

  perform public._validar_semana(p_dias);
  -- Un solo tramo por día (la pantalla trabaja así); evita filas duplicadas que confundirían la agenda.
  if (select count(distinct d ->> 'dia_semana') from jsonb_array_elements(p_dias) d) <> jsonb_array_length(p_dias) then
    raise exception 'HORARIO_INVALIDO';
  end if;
  perform public._exigir_operativo(v.negocio_id);

  select coalesce(jsonb_agg(jsonb_build_object('dia_semana', d.dia_semana, 'hora_inicio', d.hora_inicio, 'hora_fin', d.hora_fin) order by d.dia_semana), '[]'::jsonb)
    into v_antes from public.disponibilidad d where d.vinculo_id = p_vinculo_id and d.sede_id = p_sede_id;

  perform public._aplicar_semana(p_vinculo_id, p_sede_id, p_dias);

  update public.solicitud_horario set estado = 'CANCELADA', decidido_at = now()
   where vinculo_id = p_vinculo_id and sede_id = p_sede_id and estado = 'PENDIENTE';

  perform public._auditar('horario_staff', p_vinculo_id, 'HORARIO_DEFINIDO_POR_BARBERIA', v.negocio_id, v_antes, p_dias, null);
end $$;

revoke all on function public.propietario_definir_horario_staff(uuid, uuid, jsonb) from public, anon, authenticated;
grant execute on function public.propietario_definir_horario_staff(uuid, uuid, jsonb) to authenticated;

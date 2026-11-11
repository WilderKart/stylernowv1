-- ADR-015, Fase 6 (Session Version): trasladar/suspender/revocar-Guardian ya
-- afectan el alcance del Staff en su siguiente request vía RLS (Fase 1.5 de
-- la auditoría de identidad ya lo verificó), pero cualquier sesión ya abierta
-- del propio Staff sigue "viva" hasta que su JWT expire. Se incrementa
-- `perfil.session_version` en la misma transacción para que, una vez que el
-- Custom Access Token Hook esté habilitado en el Dashboard de Supabase, esas
-- sesiones queden lógicamente inválidas de inmediato. Cuerpo idéntico a las
-- funciones originales (013/015) salvo la línea `perform incrementar_session_version`.

create or replace function public.trasladar_staff(p_vinculo_id uuid, p_nueva_sede_id uuid)
returns public.vinculo_staff_negocio
language plpgsql security definer set search_path = public as $fn$
declare
  v_vinculo public.vinculo_staff_negocio;
  v_sede_nueva public.sede;
  v_sede_anterior_id uuid;
begin
  select * into v_vinculo from public.vinculo_staff_negocio where id = p_vinculo_id;
  if not found or not public.is_barberia_de(v_vinculo.negocio_id) then
    raise exception 'NO_AUTORIZADO';
  end if;

  select * into v_sede_nueva from public.sede where id = p_nueva_sede_id;
  if not found or v_sede_nueva.negocio_id <> v_vinculo.negocio_id then
    raise exception 'SEDE_NO_PERTENECE_AL_NEGOCIO';
  end if;
  if v_sede_nueva.cerrada_permanente or v_sede_nueva.cerrada_temporalmente then
    raise exception 'SEDE_DESTINO_NO_OPERATIVA';
  end if;

  v_sede_anterior_id := v_vinculo.sede_activa_id;

  update public.vinculo_staff_negocio
  set sede_activa_id = p_nueva_sede_id
  where id = p_vinculo_id
  returning * into v_vinculo;

  perform public.incrementar_session_version(v_vinculo.staff_id);

  insert into public.evento_auditoria (entidad_tipo, entidad_id, accion, actor_tipo, actor_id, negocio_id, payload_antes, payload_despues)
  values (
    'vinculo_staff_negocio', p_vinculo_id, 'STAFF_TRASLADADO', 'BARBERIA', auth.uid(), v_vinculo.negocio_id,
    jsonb_build_object('sede_id', v_sede_anterior_id),
    jsonb_build_object('sede_id', p_nueva_sede_id)
  );

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

  perform public.incrementar_session_version(v_vinculo.staff_id);

  insert into public.evento_auditoria (entidad_tipo, entidad_id, accion, actor_tipo, actor_id, negocio_id, payload_antes, payload_despues)
  values ('vinculo_staff_negocio', p_vinculo_id, 'STAFF_GUARDIAN_REVOCADO', 'BARBERIA', auth.uid(), v_vinculo.negocio_id,
    jsonb_build_object('es_guardian', true), jsonb_build_object('es_guardian', false));

  return v_vinculo;
end;
$fn$;

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

  perform public.incrementar_session_version(v_vinculo.staff_id);

  insert into public.evento_auditoria (entidad_tipo, entidad_id, accion, actor_tipo, actor_id, negocio_id, motivo)
  values ('vinculo_staff_negocio', p_vinculo_id, 'STAFF_SUSPENDIDO', 'BARBERIA', auth.uid(), v_vinculo.negocio_id, p_motivo);

  return v_vinculo;
end;
$fn$;

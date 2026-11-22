-- 162: invalidación de sesiones CONTROLADA (FASE 1, 2026-11-18). Corrige un defecto preexistente sin abrir la columna protegida.
--
-- Problema: perfil_proteger_columnas_sensibles (084) rechaza cualquier cambio de perfil.session_version cuando auth.uid() no es nulo y el
-- actor no es SuperSU. suspender_staff, trasladar_staff y revocar_guardian (083) lo cambian DENTRO de una función definer invocada por el
-- propietario, así que el trigger lo rechazaba y la acción entera fallaba (verificado: «NO_AUTORIZADO: session_version no se puede
-- modificar directamente»). La salida «fácil» (dejar pasar a toda función definer) habría convertido la columna en escribible.
--
-- Solución: UNA vía autorizada, mínima y auditada, y la protección intacta para todo lo demás.
--   1. invalidar_sesion_usuario(usuario, negocio, motivo): interna (sin grants para ningún rol de la API; solo la llaman funciones definer ya
--      autorizadas). Valida QUIÉN llama (propietario, administrador delegado o SuperSU del negocio) y SOBRE QUIÉN (alguien con vínculo con ese
--      negocio; el propietario solo lo invalida él mismo o SuperSU), marca la transacción, incrementa y deja evento de auditoría.
--   2. El trigger conserva TODAS sus reglas. Solo se añade una excepción de dos factores: la marca de transacción
--      `stylernow.sv_autorizado` (que solo escribe la función de arriba y vuelve a limpiar) Y que el UPDATE no lo ejecute un rol de cliente
--      (current_user distinto de authenticated/anon). Un cliente que intente set_config él mismo sigue bloqueado por el segundo factor.
--   3. Las acciones que cambian permisos pasan por esa función: suspender, trasladar, retirar, promover/revocar Guardian y cambiar rol.
-- incrementar_session_version(uuid) (082) no cambia: sigue siendo solo para el servidor (service_role, auth.uid() nulo).
-- Alcance real: hoy ningún consumidor VERIFICA session_version (ni el proxy ni el JWT): los permisos se resuelven contra la base en cada
-- solicitud, así que cambian al instante; el contador deja la señal lista y auditada para cuando se exija en sesión.
-- Rollback: 162_invalidar_sesion_controlada_REVERSION.sql.txt.

create or replace function public.invalidar_sesion_usuario(p_usuario_id uuid, p_negocio_id uuid, p_motivo text)
returns void language plpgsql security definer set search_path = public as $$
declare v_actor uuid := auth.uid(); v_super boolean := coalesce(public.is_supersu(), false);
begin
  if v_actor is null then raise exception 'NO_AUTENTICADO'; end if;
  if not (public.is_admin_de(p_negocio_id) or v_super) then raise exception 'NO_AUTORIZADO'; end if;
  if not (exists (select 1 from public.vinculo_staff_negocio v where v.staff_id = p_usuario_id and v.negocio_id = p_negocio_id)
          or exists (select 1 from public.negocio n where n.id = p_negocio_id and n.owner_user_id = p_usuario_id)) then
    raise exception 'USUARIO_AJENO_AL_NEGOCIO';
  end if;
  -- El propietario solo lo invalida él mismo (o SuperSU): un administrador delegado no puede tocar la sesión del dueño.
  if exists (select 1 from public.negocio n where n.id = p_negocio_id and n.owner_user_id = p_usuario_id)
     and v_actor <> p_usuario_id and not v_super then
    raise exception 'NO_AUTORIZADO';
  end if;
  perform set_config('stylernow.sv_autorizado', 'on', true);
  update public.perfil set session_version = session_version + 1 where id = p_usuario_id;
  perform set_config('stylernow.sv_autorizado', '', true);
  insert into public.evento_auditoria (entidad_tipo, entidad_id, accion, actor_tipo, actor_id, negocio_id, motivo, origen)
  values ('perfil', p_usuario_id, 'SESION_INVALIDADA', case when v_super then 'SUPERSU' else 'BARBERIA' end, v_actor, p_negocio_id,
          left(coalesce(p_motivo, 'cambio de permisos'), 200), 'PANEL');
end $$;
revoke all on function public.invalidar_sesion_usuario(uuid, uuid, text) from public, anon, authenticated;

-- Trigger: misma regla de siempre + la excepción de dos factores.
do $$
declare v_def text;
  v_ancla constant text := E'  if tg_op = ''UPDATE'' and auth.uid() is not null and not public.is_supersu()\n     and new.session_version is distinct from old.session_version then';
begin
  v_def := pg_get_functiondef('public.perfil_proteger_columnas_sensibles()'::regprocedure);
  if position('stylernow.sv_autorizado' in v_def) > 0 then return; end if;  -- ya migrada
  if position(v_ancla in v_def) = 0 then raise exception 'ANCLA_NO_ENCONTRADA perfil_proteger_columnas_sensibles'; end if;
  execute replace(v_def, v_ancla,
    E'  if tg_op = ''UPDATE'' and auth.uid() is not null and not public.is_supersu()\n'
    || E'     and not (coalesce(current_setting(''stylernow.sv_autorizado'', true), '''') = ''on'' and current_user not in (''authenticated'', ''anon''))\n'
    || E'     and new.session_version is distinct from old.session_version then');
end $$;

-- Las acciones que cambian permisos invalidan la sesión por la vía autorizada.
do $$
declare
  v_firma text; v_def text; v_motivo text;
  v_a_inc constant text := 'perform public.incrementar_session_version(v_vinculo.staff_id);';
  v_a_fin constant text := E'  return v_vinculo;\nend;';
begin
  foreach v_firma in array array['public.suspender_staff(uuid,text)', 'public.trasladar_staff(uuid,uuid)', 'public.revocar_guardian(uuid)',
                                 'public.retirar_staff(uuid,text)', 'public.promover_guardian(uuid)'] loop
    v_def := pg_get_functiondef(v_firma::regprocedure);
    if position('invalidar_sesion_usuario' in v_def) > 0 then continue; end if;  -- ya migrada
    v_motivo := case split_part(split_part(v_firma, '.', 2), '(', 1)
                  when 'suspender_staff' then 'suspension' when 'trasladar_staff' then 'traslado de sede' when 'revocar_guardian' then 'Guardian revocado'
                  when 'retirar_staff' then 'acceso retirado' else 'Guardian promovido' end;
    if position(v_a_inc in v_def) > 0 then
      v_def := replace(v_def, v_a_inc, 'perform public.invalidar_sesion_usuario(v_vinculo.staff_id, v_vinculo.negocio_id, ''' || v_motivo || ''');');
    elsif position(v_a_fin in v_def) > 0 then
      v_def := replace(v_def, v_a_fin, E'  perform public.invalidar_sesion_usuario(v_vinculo.staff_id, v_vinculo.negocio_id, ''' || v_motivo || E''');\n' || v_a_fin);
    else
      raise exception 'ANCLA_NO_ENCONTRADA %', v_firma;
    end if;
    execute v_def;
  end loop;
end $$;

-- cambiar_rol_equipo (152): reemplaza el comentario provisional por la llamada.
do $$
declare v_def text;
  v_a constant text := E'  -- No se llama a incrementar_session_version: el trigger perfil_proteger_columnas_sensibles lo rechaza dentro de funciones definer\n  -- invocadas por un usuario (defecto preexistente, ver informe). El rol se resuelve en cada solicitud, sin caché de sesión.';
begin
  v_def := pg_get_functiondef('public.cambiar_rol_equipo(uuid,text)'::regprocedure);
  if position('invalidar_sesion_usuario' in v_def) > 0 then return; end if;
  if position(v_a in v_def) = 0 then raise exception 'ANCLA_NO_ENCONTRADA cambiar_rol_equipo'; end if;
  execute replace(v_def, v_a, E'  perform public.invalidar_sesion_usuario(v.staff_id, v.negocio_id, ''cambio de rol'');');
end $$;

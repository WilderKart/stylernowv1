-- 100: Ejecucion de la eliminacion de cuenta (C15): anonimizacion por proceso del sistema (cron, service_role).
-- Ver el diseno completo en 099. Solo service_role puede ejecutar estas funciones.
-- Interna: anonimiza a un cliente. Lanza ante cualquier fallo (el llamador revierte esa cuenta y registra el error).
create or replace function public._anonimizar_cliente(p_usuario uuid)
returns void language plpgsql security definer set search_path = public as $$
declare r record; v_saldo numeric; c record;
begin
  -- 1) Citas futuras: cancelar (reembolso 100% auditado para el proceso de pagos).
  for r in select re.id, re.negocio_id,
             (select p.id from public.pago p where p.reserva_id = re.id and p.tipo = 'SENA' and p.estado = 'APROBADO'
               order by p.created_at desc limit 1) as pago_id
           from public.reserva re
           where re.cliente_id = p_usuario and re.estado in ('PENDIENTE_PAGO','CONFIRMADA') and re.hora_inicio > now()
  loop
    update public.reserva set estado = 'CANCELADA', cancelado_por = 'CLIENTE',
           cancelado_motivo = 'CUENTA_ELIMINADA', updated_at = now() where id = r.id;
    insert into public.evento_auditoria (entidad_tipo, entidad_id, accion, actor_tipo, actor_id, negocio_id, motivo, payload_despues)
    values ('reserva', r.id, 'RESERVA_CANCELADA_CUENTA_ELIMINADA', 'SISTEMA', null, r.negocio_id, 'CUENTA_ELIMINADA',
            jsonb_build_object('reembolso_pct', 100, 'pago_id', r.pago_id));
  end loop;
  -- 2) Saldo a favor: solicitud de devolucion (no se borra el libro de movimientos).
  select coalesce(w.saldo_disponible, 0) into v_saldo from public.lealtad_wallet w where w.cliente_id = p_usuario;
  if coalesce(v_saldo, 0) > 0 and not exists (select 1 from public.solicitud_devolucion_saldo s
        where s.cliente_id = p_usuario and s.estado = 'PENDIENTE') then
    insert into public.solicitud_devolucion_saldo (cliente_id, monto, origen) values (p_usuario, v_saldo, 'ELIMINACION_CUENTA');
  end if;
  -- 3) Datos personales propios: fotos My Look (y sus archivos), notificaciones, favoritos, preferencias.
  insert into public.purga_storage_pendiente (bucket, ruta)
    select 'crm-fotos', f.url from public.reserva_foto f where f.cliente_id = p_usuario;
  delete from public.reserva_foto where cliente_id = p_usuario;
  delete from public.notificacion_usuario where usuario_id = p_usuario;
  delete from public.favorito_negocio where cliente_id = p_usuario;
  delete from public.cliente_preferencia where usuario_id = p_usuario;
  -- 4) Retirar consentimientos vigentes (evento nuevo, el historial se conserva).
  for c in select distinct e.proposito from public.consentimiento_evento e where e.usuario_id = p_usuario loop
    perform public._consentimiento_registrar(p_usuario, c.proposito, false, 'sistema');
  end loop;
  -- 5) Perfil anonimo (las resenas muestran 'Cliente anonimo').
  update public.perfil set nombre = 'Cliente anónimo', email = null, telefono = null, avatar_url = null,
         fecha_nacimiento = null, categorias_interes = '{}', pais = null, consentimiento_marketing = false
   where id = p_usuario;
  -- 6) La cuenta de acceso (auth.users) NO se toca desde SQL: el cron la inhabilita con la Admin API de Auth
  --    (solicitud_cuenta.auth_cerrada = false mientras tanto) y luego llama a marcar_auth_cerrada().
end $$;
revoke all on function public._anonimizar_cliente(uuid) from public, anon, authenticated;
grant execute on function public._anonimizar_cliente(uuid) to service_role;

-- Cron (service_role): ejecuta las eliminaciones vencidas. Cada cuenta en su propio sub-bloque.
create or replace function public.procesar_eliminaciones_cuenta(p_limite integer default 20)
returns jsonb language plpgsql security definer set search_path = public as $$
declare s record; v_ok int := 0; v_err int := 0; v_msg text;
begin
  for s in select sc.id, sc.usuario_id from public.solicitud_cuenta sc
           where sc.tipo = 'ELIMINACION' and sc.estado = 'PENDIENTE' and sc.programada_para <= now()
           order by sc.programada_para limit least(greatest(coalesce(p_limite, 20), 1), 100)
           for update skip locked
  loop
    begin
      -- No ejecutar si en el intertanto se volvio dueno/staff de un negocio.
      if exists (select 1 from public.negocio n where n.owner_user_id = s.usuario_id and n.estado::text <> 'CANCELADO')
         or exists (select 1 from public.vinculo_staff_negocio v where v.staff_id = s.usuario_id and v.estado = 'ACTIVO')
         or exists (select 1 from public.perfil p where p.id = s.usuario_id and p.es_supersu) then
        raise exception 'BLOQUEADA_POR_ROL';
      end if;
      perform public._anonimizar_cliente(s.usuario_id);
      update public.solicitud_cuenta set estado = 'EJECUTADA', ejecutada_at = now() where id = s.id;
      insert into public.evento_auditoria (entidad_tipo, entidad_id, accion, actor_tipo, payload_despues)
      values ('perfil', s.usuario_id, 'CUENTA_ANONIMIZADA', 'SISTEMA', jsonb_build_object('solicitud_id', s.id));
      v_ok := v_ok + 1;
    exception when others then
      get stacked diagnostics v_msg = message_text;
      update public.solicitud_cuenta set intentos = intentos + 1, error = left(v_msg, 300),
             estado = case when intentos + 1 >= 5 or v_msg = 'BLOQUEADA_POR_ROL' then 'ERROR' else estado end
       where id = s.id;
      v_err := v_err + 1;
    end;
  end loop;
  return jsonb_build_object('ejecutadas', v_ok, 'errores', v_err);
end $$;
revoke all on function public.procesar_eliminaciones_cuenta(integer) from public, anon, authenticated;
grant execute on function public.procesar_eliminaciones_cuenta(integer) to service_role;

-- Cron (service_role): confirma que la cuenta de acceso ya fue inhabilitada via Admin API.
create or replace function public.marcar_auth_cerrada(p_solicitud_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.solicitud_cuenta set auth_cerrada = true
   where id = p_solicitud_id and tipo = 'ELIMINACION' and estado = 'EJECUTADA';
end $$;
revoke all on function public.marcar_auth_cerrada(uuid) from public, anon, authenticated;
grant execute on function public.marcar_auth_cerrada(uuid) to service_role;

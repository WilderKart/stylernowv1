-- 125 · Índices de FK/filtros frecuentes y endurecimiento del aislamiento entre negocios.
--
-- Fase 5 de la Directiva (aislamiento multiempresa). Hallazgos reproducidos en local con
-- tests/sql/aislamiento_multiempresa.sql (antes de esta migración las verificaciones marcadas
-- con [125] fallaban). Todo es aditivo y re-ejecutable: CREATE OR REPLACE con la MISMA firma,
-- `create index if not exists`, `drop policy if exists` + `create policy`.
--
-- Cero confianza: cada término de autorización va con coalesce(..., false). Las funciones
-- DEFINER llevan `set search_path = public` y se revocan de public/anon/authenticated antes
-- de otorgar solo lo necesario. Los triggers de protección son INVOKER a propósito: deciden
-- con `current_user` (rol de API vs. función DEFINER), igual que 108 y 116.
--
-- No toca la lógica de pagos, anticipos ni reembolsos.

-- ════════════════════════════════════════════════════════════════════════════
-- 1. [P0] iniciar/finalizar_atencion_reserva: autorización NULL con reserva sin staff
-- ════════════════════════════════════════════════════════════════════════════
-- `if v_reserva.staff_id <> auth.uid()` es NULL cuando la reserva no tiene staff, y un IF con
-- NULL no entra: cualquier autenticado pasaba a EN_CURSO una reserva ajena (que ya no se puede
-- cancelar, T3) y recibía la fila completa. Mismo patrón del P0 de cancelar_reserva.

create or replace function public.iniciar_atencion_reserva(p_reserva_id uuid)
returns public.reserva
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_reserva public.reserva;
  v_vinculo_id uuid;
  v_minutos_tarde numeric;
begin
  select * into v_reserva from public.reserva where id = p_reserva_id for update;
  if not found then raise exception 'RESERVA_NO_ENCONTRADA'; end if;
  if not coalesce(v_reserva.staff_id = auth.uid(), false) then raise exception 'NO_AUTORIZADO'; end if;
  if v_reserva.estado <> 'CONFIRMADA' then raise exception 'RESERVA_NO_INICIABLE'; end if;

  update public.reserva set estado = 'EN_CURSO', checkin_at = now(), updated_at = now()
  where id = p_reserva_id
  returning * into v_reserva;

  -- Puntualidad (03-Business-Rules/05_Staff_Rewards.md): llegada tarde >5min,
  -- -10 puntos. El bono "día/semana 100% puntual" es un agregado que
  -- requiere un cierre periódico — no se calcula acá (ver TECH_DEBT_REGISTER).
  select id into v_vinculo_id from public.vinculo_staff_negocio
    where staff_id = v_reserva.staff_id and negocio_id = v_reserva.negocio_id and estado <> 'RETIRADO'
    limit 1;
  v_minutos_tarde := extract(epoch from (now() - v_reserva.hora_inicio)) / 60;
  if v_vinculo_id is not null and public.temporada_actual_id() is not null and v_minutos_tarde > 5 then
    insert into public.puntaje_staff_evento (vinculo_id, temporada_id, evento, puntos_delta, referencia_tipo, referencia_id, actor_tipo, motivo)
    values (v_vinculo_id, public.temporada_actual_id(), 'LLEGADA_TARDE', -10, 'reserva', p_reserva_id, 'SISTEMA',
      format('Check-in %s minutos tarde', round(v_minutos_tarde)));
  end if;

  insert into public.evento_auditoria (entidad_tipo, entidad_id, accion, actor_tipo, actor_id, negocio_id)
  values ('reserva', p_reserva_id, 'CHECKIN_STAFF', 'STAFF', auth.uid(), v_reserva.negocio_id);

  return v_reserva;
end;
$function$;
revoke all on function public.iniciar_atencion_reserva(uuid) from public, anon, authenticated;
grant execute on function public.iniciar_atencion_reserva(uuid) to authenticated, service_role;

create or replace function public.finalizar_atencion_reserva(p_reserva_id uuid)
returns public.reserva
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_reserva public.reserva;
begin
  select * into v_reserva from public.reserva where id = p_reserva_id for update;
  if not found then raise exception 'RESERVA_NO_ENCONTRADA'; end if;
  if not coalesce(v_reserva.staff_id = auth.uid(), false) then raise exception 'NO_AUTORIZADO'; end if;
  if v_reserva.estado <> 'EN_CURSO' then raise exception 'RESERVA_NO_FINALIZABLE'; end if;
  if v_reserva.checkout_at is not null then raise exception 'RESERVA_NO_FINALIZABLE'; end if;

  update public.reserva set checkout_at = now(), updated_at = now()
  where id = p_reserva_id
  returning * into v_reserva;

  insert into public.evento_auditoria (entidad_tipo, entidad_id, accion, actor_tipo, actor_id, negocio_id)
  values ('reserva', p_reserva_id, 'CHECKOUT_STAFF', 'STAFF', auth.uid(), v_reserva.negocio_id);

  return v_reserva;
end;
$function$;
revoke all on function public.finalizar_atencion_reserva(uuid) from public, anon, authenticated;
grant execute on function public.finalizar_atencion_reserva(uuid) to authenticated, service_role;

-- ════════════════════════════════════════════════════════════════════════════
-- 2. [P1] Cuentas corporativas: autorización NULL cuando la cuenta no tiene admin
-- ════════════════════════════════════════════════════════════════════════════
-- crear_cuenta_corporativa deja admin_user_id en NULL hasta asignar_admin_corporativo. Con NULL,
-- `admin_user_id <> auth.uid()` es NULL y el IF no rechaza: cualquier autenticado que conociera
-- el id podía crear hasta 500 gift cards ACTIVAS del negocio, agregar/retirar empleados y leer el
-- reporte de la cuenta.

create or replace function public.agregar_empleado_corporativo(p_cuenta_id uuid, p_cliente_id uuid)
returns public.corporativo_miembro
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_cuenta public.corporativo_cuenta;
  v_conteo int;
  v_miembro public.corporativo_miembro;
begin
  select * into v_cuenta from public.corporativo_cuenta where id = p_cuenta_id;
  if not found or not coalesce(v_cuenta.admin_user_id = auth.uid(), false) then raise exception 'NO_AUTORIZADO'; end if;
  if not v_cuenta.activo or v_cuenta.vigencia_fin < current_date then raise exception 'CUENTA_NO_VIGENTE'; end if;

  select count(*) into v_conteo from public.corporativo_miembro where cuenta_id = p_cuenta_id and activo = true;
  if v_conteo >= v_cuenta.cupos_totales then raise exception 'CUPOS_AGOTADOS'; end if;

  insert into public.corporativo_miembro (cuenta_id, cliente_id) values (p_cuenta_id, p_cliente_id)
  on conflict (cuenta_id, cliente_id) do update set activo = true
  returning * into v_miembro;

  return v_miembro;
end;
$function$;
revoke all on function public.agregar_empleado_corporativo(uuid, uuid) from public, anon, authenticated;
grant execute on function public.agregar_empleado_corporativo(uuid, uuid) to authenticated, service_role;

create or replace function public.retirar_empleado_corporativo(p_cuenta_id uuid, p_cliente_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_cuenta public.corporativo_cuenta;
begin
  select * into v_cuenta from public.corporativo_cuenta where id = p_cuenta_id;
  if not found or not coalesce(v_cuenta.admin_user_id = auth.uid(), false) then raise exception 'NO_AUTORIZADO'; end if;

  update public.corporativo_miembro set activo = false where cuenta_id = p_cuenta_id and cliente_id = p_cliente_id;
end;
$function$;
revoke all on function public.retirar_empleado_corporativo(uuid, uuid) from public, anon, authenticated;
grant execute on function public.retirar_empleado_corporativo(uuid, uuid) to authenticated, service_role;

create or replace function public.crear_lote_gift_cards_corporativo(p_cuenta_id uuid, p_cantidad integer, p_monto_cada_una numeric)
returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_cuenta public.corporativo_cuenta;
  v_lote_id uuid := gen_random_uuid();
  v_codigo text;
  v_pin text;
  i int;
begin
  select * into v_cuenta from public.corporativo_cuenta where id = p_cuenta_id;
  if not found or not (coalesce(v_cuenta.admin_user_id = auth.uid(), false) or coalesce(public.is_supersu(), false)) then
    raise exception 'NO_AUTORIZADO';
  end if;
  if p_cantidad <= 0 or p_cantidad > 500 then raise exception 'CANTIDAD_INVALIDA'; end if;
  if p_monto_cada_una <= 0 then raise exception 'MONTO_INVALIDO'; end if;
  if v_cuenta.negocio_id is null then raise exception 'CUENTA_SIN_NEGOCIO_ASOCIADO'; end if;

  for i in 1..p_cantidad loop
    v_codigo := upper(substr(encode(extensions.gen_random_bytes(6), 'hex'), 1, 10));
    v_pin := lpad((floor(random() * 10000))::text, 4, '0');
    insert into public.gift_card (codigo, pin_hash, negocio_id, comprador_id, monto_original, saldo_actual, estado, fecha_expiracion, corporativo_cuenta_id, lote_id)
    values (v_codigo, extensions.crypt(v_pin, extensions.gen_salt('bf')), v_cuenta.negocio_id, auth.uid(), p_monto_cada_una, p_monto_cada_una, 'ACTIVA', v_cuenta.vigencia_fin::timestamptz, p_cuenta_id, v_lote_id);
  end loop;

  insert into public.evento_auditoria (entidad_tipo, entidad_id, accion, actor_tipo, actor_id, negocio_id, payload_despues)
  values ('corporativo_cuenta', p_cuenta_id, 'LOTE_GIFT_CARDS_CREADO', 'SUPERSU', auth.uid(), v_cuenta.negocio_id,
    jsonb_build_object('lote_id', v_lote_id, 'cantidad', p_cantidad, 'monto_cada_una', p_monto_cada_una));

  return jsonb_build_object('lote_id', v_lote_id, 'cantidad', p_cantidad);
end;
$function$;
revoke all on function public.crear_lote_gift_cards_corporativo(uuid, integer, numeric) from public, anon, authenticated;
grant execute on function public.crear_lote_gift_cards_corporativo(uuid, integer, numeric) to authenticated, service_role;

create or replace function public.reportes_corporativo(p_cuenta_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $function$
declare
  v_cuenta public.corporativo_cuenta;
  v_resultado jsonb;
begin
  select * into v_cuenta from public.corporativo_cuenta where id = p_cuenta_id;
  if not found or not (
       coalesce(v_cuenta.admin_user_id = auth.uid(), false)
    or coalesce(public.is_supersu(), false)
    or (v_cuenta.negocio_id is not null and coalesce(public.is_barberia_de(v_cuenta.negocio_id), false))
  ) then
    raise exception 'NO_AUTORIZADO';
  end if;

  select jsonb_build_object(
    'empleadosActivos', (select count(*) from public.corporativo_miembro where cuenta_id = p_cuenta_id and activo = true),
    'cuposTotales', v_cuenta.cupos_totales,
    'consumoTotal', (select coalesce(sum(cc.monto), 0) from public.corporativo_consumo cc join public.corporativo_miembro cm on cm.id = cc.miembro_id where cm.cuenta_id = p_cuenta_id),
    'reservasConsumidas', (select count(*) from public.corporativo_consumo cc join public.corporativo_miembro cm on cm.id = cc.miembro_id where cm.cuenta_id = p_cuenta_id)
  ) into v_resultado;

  return v_resultado;
end;
$function$;
revoke all on function public.reportes_corporativo(uuid) from public, anon, authenticated;
grant execute on function public.reportes_corporativo(uuid) to authenticated, service_role;

-- ════════════════════════════════════════════════════════════════════════════
-- 3. [P1] perfil.email editable por el propio usuario → robo de invitaciones de staff
-- ════════════════════════════════════════════════════════════════════════════
-- responder_invitacion, invitacion_staff_select_propia y negocio_select_invitado comparan contra
-- perfil.email, y perfil_update_propio deja al usuario cambiarlo por PostgREST. Bastaba con poner
-- el correo del invitado en el propio perfil para ver y aceptar la invitación y entrar como staff
-- al negocio ajeno (CRM, agenda, pagos). La app nunca escribe perfil.email: lo crea
-- handle_new_user desde auth.users. Se bloquea para los roles de API; las funciones DEFINER
-- (anonimización por eliminación de cuenta) siguen pudiendo.
create or replace function public.perfil_proteger_columnas_sensibles()
returns trigger
language plpgsql
set search_path = public
as $function$
begin
  if auth.uid() is not null and not public.is_supersu() then
    if new.es_supersu is distinct from old.es_supersu then
      raise exception 'NO_AUTORIZADO: es_supersu no se puede modificar directamente';
    end if;
    if new.session_version is distinct from old.session_version then
      raise exception 'NO_AUTORIZADO: session_version no se puede modificar directamente';
    end if;
  end if;
  if current_user in ('authenticated', 'anon') and new.email is distinct from old.email then
    raise exception 'NO_AUTORIZADO: el correo del perfil se toma de la cuenta y no se edita directamente';
  end if;
  return new;
end;
$function$;
revoke all on function public.perfil_proteger_columnas_sensibles() from public, anon, authenticated;

-- ════════════════════════════════════════════════════════════════════════════
-- 4. [P1] negocio: el dueño podía autoactivarse (estado) y nacer con cualquier plan
-- ════════════════════════════════════════════════════════════════════════════
-- trg_negocio_proteger_comercial (108) no cubría `estado`: un UPDATE directo pasaba de
-- PENDIENTE_APROBACION/SUSPENDIDO a ACTIVO sin aprobar_negocio. Y en el INSERT (onboarding)
-- no había protección: se podía nacer ACTIVO y con plan SIGNATURE. La app no envía estas
-- columnas; los cambios legítimos los hacen funciones DEFINER (current_user = postgres).
create or replace function public.trg_negocio_proteger_comercial()
returns trigger
language plpgsql
set search_path = public
as $function$
begin
  if current_user not in ('authenticated', 'anon') then return new; end if;
  if public.is_supersu() then return new; end if;
  if new.plan_codigo is distinct from old.plan_codigo
     or new.comision_plataforma_pct is distinct from old.comision_plataforma_pct
     or new.elegibilidad_marketplace is distinct from old.elegibilidad_marketplace
     or new.pais_codigo is distinct from old.pais_codigo
     or new.owner_user_id is distinct from old.owner_user_id
     or new.estado is distinct from old.estado then
    raise exception 'NEGOCIO_COLUMNA_PROTEGIDA';
  end if;
  return new;
end
$function$;
revoke all on function public.trg_negocio_proteger_comercial() from public, anon, authenticated;

create or replace function public.trg_negocio_alta_protegida()
returns trigger
language plpgsql
set search_path = public
as $function$
begin
  if current_user not in ('authenticated', 'anon') then return new; end if;
  if public.is_supersu() then return new; end if;
  -- Mismos valores que los DEFAULT de la columna: el alta por la API nunca elige su estado ni su plan.
  new.estado := 'PENDIENTE_APROBACION';
  new.plan_codigo := 'ESSENTIAL';
  new.elegibilidad_marketplace := true;
  return new;
end
$function$;
revoke all on function public.trg_negocio_alta_protegida() from public, anon, authenticated;

drop trigger if exists trg_negocio_alta_protegida on public.negocio;
create trigger trg_negocio_alta_protegida before insert on public.negocio
  for each row execute function public.trg_negocio_alta_protegida();

-- ════════════════════════════════════════════════════════════════════════════
-- 5. [P1] reserva: buffers/bloqueo editables por cliente o staff → bloqueo de agenda ajena
-- ════════════════════════════════════════════════════════════════════════════
-- reserva_update_cliente / reserva_update_staff permiten UPDATE de la propia fila y 116 protege
-- horas, estado y montos, pero no los buffers. trg_reserva_bloqueo recalcula bloqueo_fin desde
-- buffer_posterior_minutos y `rango` (exclusión por staff) sale de ahí: un cliente podía poner
-- 100000 minutos y dejar al profesional del negocio sin turnos por meses. La app no escribe
-- estas columnas en reserva (los buffers se configuran en `servicio`).
create or replace function public.trg_reserva_proteger_directo()
returns trigger
language plpgsql
set search_path = public
as $function$
begin
  if current_user not in ('authenticated', 'anon') then return new; end if;
  if public.is_supersu() then return new; end if;

  if tg_op = 'INSERT' then
    -- Toda reserva nace en crear_reserva / crear_reserva_manual (valida slot, anticipo, plan y precio).
    raise exception 'RESERVA_SOLO_POR_FUNCION';
  end if;

  if new.id is distinct from old.id or new.cliente_id is distinct from old.cliente_id
     or new.negocio_id is distinct from old.negocio_id or new.sede_id is distinct from old.sede_id
     or new.staff_id is distinct from old.staff_id or new.recurso_id is distinct from old.recurso_id
     or new.hora_inicio is distinct from old.hora_inicio or new.hora_fin is distinct from old.hora_fin
     or new.estado is distinct from old.estado or new.monto_total is distinct from old.monto_total
     or new.monto_sena is distinct from old.monto_sena or new.checkin_at is distinct from old.checkin_at
     or new.checkout_at is distinct from old.checkout_at or new.cancelado_por is distinct from old.cancelado_por
     or new.cancelado_motivo is distinct from old.cancelado_motivo or new.expira_at is distinct from old.expira_at
     or new.idempotency_key is distinct from old.idempotency_key or new.created_at is distinct from old.created_at
     or new.buffer_previo_minutos is distinct from old.buffer_previo_minutos
     or new.buffer_posterior_minutos is distinct from old.buffer_posterior_minutos
     or new.bloqueo_inicio is distinct from old.bloqueo_inicio
     or new.bloqueo_fin is distinct from old.bloqueo_fin then
    raise exception 'RESERVA_EDICION_DIRECTA_NO_PERMITIDA';
  end if;
  return new;
end $function$;
revoke all on function public.trg_reserva_proteger_directo() from public, anon, authenticated;

-- ════════════════════════════════════════════════════════════════════════════
-- 6. [P1] reserva_servicio: el cliente podía insertar líneas con precio y servicio a elección
-- ════════════════════════════════════════════════════════════════════════════
-- La política reserva_servicio_insert dejaba al cliente agregar filas a SU reserva con cualquier
-- servicio_id (incluso de otro negocio) y cualquier precio_congelado_unitario. completar_venta_pos
-- usa esas filas para el beneficio de membresía y el consumo de inventario, y los pipelines de
-- sellos/cashback para otorgar beneficios. Las líneas solo las crean crear_reserva,
-- crear_reserva_manual, reprogramar_reserva y reasignar_staff_reserva (DEFINER). La app no escribe
-- la tabla directamente.
drop policy if exists reserva_servicio_insert on public.reserva_servicio;
revoke insert, update, delete, truncate on public.reserva_servicio from public, anon, authenticated;

-- ════════════════════════════════════════════════════════════════════════════
-- 7. [P2] sede: un guardián podía mover su sede a otro negocio
-- ════════════════════════════════════════════════════════════════════════════
-- sede_update_barberia_guardian autoriza por is_guardian_de_sede(id), que sigue siendo verdadero
-- después de cambiar negocio_id. La política restrictiva exige que la fila NUEVA siga en un
-- negocio del que la persona es dueña o guardiana.
drop policy if exists sede_update_mismo_negocio on public.sede;
create policy sede_update_mismo_negocio on public.sede as restrictive for update to anon, authenticated
  using (true)
  with check (
       coalesce(public.is_barberia_de(negocio_id), false)
    or coalesce(public.is_guardian_de_negocio(negocio_id), false)
    or coalesce(public.is_supersu(), false)
  );

-- ════════════════════════════════════════════════════════════════════════════
-- 8. [P3] saldo_creditos_ia: devolvía el saldo de IA de cualquier negocio
-- ════════════════════════════════════════════════════════════════════════════
-- Solo personas del negocio o SuperSU. Sin sesión (auth.uid() NULL) es un contexto de servidor
-- (service_role, o consumir_creditos_ia, que ya validó el acceso); anon no tiene EXECUTE.
create or replace function public.saldo_creditos_ia(p_negocio_id uuid)
returns integer
language plpgsql
stable
security definer
set search_path = public
as $function$
begin
  if auth.uid() is not null
     and not (coalesce(public.tiene_acceso_interno(p_negocio_id), false) or coalesce(public.is_supersu(), false)) then
    raise exception 'NO_AUTORIZADO';
  end if;
  return (
    select coalesce(sum(cantidad_disponible), 0)::int
    from public.credito_ia_lote
    where negocio_id = p_negocio_id and fecha_expiracion > now() and cantidad_disponible > 0
  );
end;
$function$;
revoke all on function public.saldo_creditos_ia(uuid) from public, anon, authenticated;
grant execute on function public.saldo_creditos_ia(uuid) to authenticated, service_role;

-- ════════════════════════════════════════════════════════════════════════════
-- 8b. [P3] crear_ticket_soporte: cualquiera abría tickets "a nombre" de otro negocio
-- ════════════════════════════════════════════════════════════════════════════
-- p_negocio_id no se validaba: el ticket quedaba asociado al negocio ajeno y Soporte lo veía como
-- suyo (vector de ingeniería social). Los llamadores del panel siempre pertenecen al negocio y
-- cliente_crear_ticket pasa NULL.
create or replace function public.crear_ticket_soporte(p_asunto text, p_mensaje text, p_negocio_id uuid default null)
returns public.ticket_soporte
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_ticket public.ticket_soporte;
  v_actor_tipo text;
begin
  if p_asunto is null or length(trim(p_asunto)) = 0 then raise exception 'ASUNTO_REQUERIDO'; end if;
  if p_mensaje is null or length(trim(p_mensaje)) = 0 then raise exception 'MENSAJE_REQUERIDO'; end if;
  if p_negocio_id is not null
     and not (coalesce(public.tiene_acceso_interno(p_negocio_id), false) or coalesce(public.is_supersu(), false)) then
    raise exception 'NO_AUTORIZADO';
  end if;

  insert into public.ticket_soporte (creado_por, negocio_id, asunto)
  values (auth.uid(), p_negocio_id, p_asunto)
  returning * into v_ticket;

  v_actor_tipo := public.actor_tipo_soporte(p_negocio_id);
  insert into public.ticket_mensaje (ticket_id, autor_id, actor_tipo, mensaje)
  values (v_ticket.id, auth.uid(), v_actor_tipo, p_mensaje);

  return v_ticket;
end;
$function$;
revoke all on function public.crear_ticket_soporte(text, text, uuid) from public, anon, authenticated;
grant execute on function public.crear_ticket_soporte(text, text, uuid) to authenticated, service_role;

-- ════════════════════════════════════════════════════════════════════════════
-- 9. Higiene: funciones de trigger SECURITY DEFINER ejecutables por anon/authenticated
-- ════════════════════════════════════════════════════════════════════════════
-- Llamarlas por RPC falla ("trigger functions can only be called as triggers"), pero no tienen
-- por qué estar expuestas. Los triggers siguen funcionando sin EXECUTE del rol que dispara.
revoke all on function public.handle_new_user() from public, anon, authenticated;
revoke all on function public.handle_new_negocio() from public, anon, authenticated;
revoke all on function public.otorgar_puntos_resena_calidad() from public, anon, authenticated;

-- ════════════════════════════════════════════════════════════════════════════
-- 10. Índices: FK y filtros frecuentes sin índice (RLS, listados y cascadas)
-- ════════════════════════════════════════════════════════════════════════════
-- pago_select_cliente evalúa staff_destino_id en cada lectura de pagos.
create index if not exists pago_staff_destino_idx on public.pago (staff_destino_id) where staff_destino_id is not null;
create index if not exists pago_conexion_idx on public.pago (conexion_pago_id) where conexion_pago_id is not null;
-- Reportes de servicios top, pipelines y borrado de servicios.
create index if not exists reserva_servicio_servicio_idx on public.reserva_servicio (servicio_id);
create index if not exists notificacion_usuario_reserva_idx on public.notificacion_usuario (reserva_id) where reserva_id is not null;
create index if not exists notificacion_usuario_negocio_idx on public.notificacion_usuario (negocio_id) where negocio_id is not null;
-- Reembolsos: búsquedas por pago/reserva (worker, cancelación) y política por cliente.
create index if not exists reembolso_pago_idx on public.reembolso (pago_id);
create index if not exists reembolso_reserva_idx on public.reembolso (reserva_id) where reserva_id is not null;
create index if not exists reembolso_cliente_idx on public.reembolso (cliente_id) where cliente_id is not null;
create index if not exists reembolso_evento_reembolso_idx on public.reembolso_evento (reembolso_id);
create index if not exists aceptacion_politica_cliente_idx on public.aceptacion_politica_reserva (cliente_id);
-- Reseñas por profesional (staff_resenas_publicas) y "mis reseñas".
create index if not exists resena_negocio_staff_idx on public.resena (negocio_id, staff_id) where staff_id is not null;
create index if not exists resena_cliente_idx on public.resena (cliente_id);
create index if not exists reserva_foto_cliente_solo_idx on public.reserva_foto (cliente_id);
create index if not exists gift_card_redencion_gift_card_idx on public.gift_card_redencion (gift_card_id);
create index if not exists chat_conversacion_cliente_idx on public.chat_conversacion (cliente_id);
create index if not exists chat_conversacion_negocio_idx on public.chat_conversacion (negocio_id);
create index if not exists egreso_caja_sede_idx on public.egreso_caja (sede_id);
create index if not exists whatsapp_mensaje_cliente_idx on public.whatsapp_mensaje (cliente_id);
create index if not exists whatsapp_plantilla_negocio_idx on public.whatsapp_plantilla (negocio_id) where negocio_id is not null;
create index if not exists staff_servicio_servicio_idx on public.staff_servicio (servicio_id);
create index if not exists venta_producto_producto_idx on public.venta_producto (producto_id);
create index if not exists corporativo_cuenta_negocio_idx on public.corporativo_cuenta (negocio_id) where negocio_id is not null;
create index if not exists corporativo_cuenta_admin_idx on public.corporativo_cuenta (admin_user_id) where admin_user_id is not null;
create index if not exists corporativo_miembro_cliente_idx on public.corporativo_miembro (cliente_id);
create index if not exists vip_miembro_negocio_idx on public.vip_miembro (negocio_id);
create index if not exists ticket_soporte_negocio_idx on public.ticket_soporte (negocio_id) where negocio_id is not null;

-- ════════════════════════════════════════════════════════════════════════════
-- 11. [P3] Reportes con sede: el guardián de una sede pasaba la autorización con otro negocio
-- ════════════════════════════════════════════════════════════════════════════
-- `is_barberia_de(p_negocio_id) or is_guardian_de_sede(p_sede_id)` no exigía que la sede fuera
-- de ese negocio. Las consultas filtran por negocio Y sede, así que el resultado venía vacío (no
-- había fuga), pero la RPC no rechazaba. Cero confianza: se exige que la sede pertenezca al negocio.
-- Cuerpos copiados sin cambios salvo la línea de autorización.

CREATE OR REPLACE FUNCTION public.cierre_caja_dia(p_negocio_id uuid, p_sede_id uuid DEFAULT NULL::uuid, p_fecha date DEFAULT NULL::date)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public
AS $function$
declare
  v_autorizado boolean;
  v_fecha date := coalesce(p_fecha, (now() at time zone 'America/Bogota')::date);
  v_inicio timestamptz; v_fin timestamptz;
  v_efectivo numeric; v_digital numeric; v_total numeric; v_egresos numeric; v_lista jsonb;
begin
  if p_sede_id is not null then
    v_autorizado := coalesce(public.is_barberia_de(p_negocio_id), false)
      or (coalesce(public.is_guardian_de_sede(p_sede_id), false)
          and exists (select 1 from public.sede s where s.id = p_sede_id and s.negocio_id = p_negocio_id));
  else
    v_autorizado := coalesce(public.is_barberia_de(p_negocio_id), false);
  end if;
  if not v_autorizado then raise exception 'NO_AUTORIZADO'; end if;

  v_inicio := v_fecha::timestamp at time zone 'America/Bogota';
  v_fin := (v_fecha + 1)::timestamp at time zone 'America/Bogota';

  select coalesce(sum(p.monto) filter (where p.pasarela = 'EFECTIVO'), 0),
         coalesce(sum(p.monto) filter (where p.pasarela <> 'EFECTIVO'), 0),
         coalesce(sum(p.monto), 0)
    into v_efectivo, v_digital, v_total
  from public.pago p join public.reserva r on r.id = p.reserva_id
  where p.negocio_id = p_negocio_id and p.estado = 'APROBADO' and p.tipo in ('SALDO', 'PROPINA', 'SENA')
    and p.created_at >= v_inicio and p.created_at < v_fin and (p_sede_id is null or r.sede_id = p_sede_id);

  select coalesce(sum(e.monto) filter (where not e.anulado), 0),
         coalesce(jsonb_agg(jsonb_build_object('id', e.id, 'monto', e.monto, 'concepto', e.concepto, 'categoria', e.categoria,
                  'anulado', e.anulado, 'anulado_motivo', e.anulado_motivo, 'hora', e.created_at) order by e.created_at), '[]'::jsonb)
    into v_egresos, v_lista
  from public.egreso_caja e
  where e.negocio_id = p_negocio_id and e.fecha = v_fecha and (p_sede_id is null or e.sede_id = p_sede_id);

  return jsonb_build_object('fecha', v_fecha, 'efectivo', v_efectivo, 'digital', v_digital, 'total', v_total,
                            'egresos', v_egresos, 'efectivo_esperado', v_efectivo - v_egresos, 'egresos_lista', v_lista);
end $function$;

revoke all on function public.cierre_caja_dia(uuid, uuid, date) from public, anon, authenticated;
grant execute on function public.cierre_caja_dia(uuid, uuid, date) to authenticated, service_role;

CREATE OR REPLACE FUNCTION public.dashboard_resumen_dia(p_negocio_id uuid, p_sede_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path = public
AS $function$
declare
  v_autorizado boolean;
  v_hoy date;
  v_inicio_dia timestamptz;
  v_fin_dia timestamptz;
  v_dia_semana int;
  v_citas_hoy int;
  v_ingresos_hoy numeric;
  v_capacidad_min numeric;
  v_reservado_min numeric;
  v_ocupacion_pct numeric;
  v_proxima jsonb;
begin
  if p_sede_id is not null then
    v_autorizado := coalesce(public.is_barberia_de(p_negocio_id), false)
      or (coalesce(public.is_guardian_de_sede(p_sede_id), false)
          and exists (select 1 from public.sede s where s.id = p_sede_id and s.negocio_id = p_negocio_id));
  else
    v_autorizado := coalesce(public.is_barberia_de(p_negocio_id), false);
  end if;
  if not v_autorizado and not public.is_supersu() then
    raise exception 'NO_AUTORIZADO';
  end if;

  v_hoy := (now() at time zone 'America/Bogota')::date;
  v_inicio_dia := v_hoy::timestamp at time zone 'America/Bogota';
  v_fin_dia := (v_hoy + 1)::timestamp at time zone 'America/Bogota';
  v_dia_semana := extract(dow from v_hoy)::int; -- 0=domingo, coincide con disponibilidad.dia_semana

  select count(*), coalesce(sum(monto_total) filter (where estado = 'COMPLETADA'), 0)
  into v_citas_hoy, v_ingresos_hoy
  from public.reserva
  where negocio_id = p_negocio_id
    and (p_sede_id is null or sede_id = p_sede_id)
    and hora_inicio >= v_inicio_dia and hora_inicio < v_fin_dia
    and estado <> 'CANCELADA';

  -- Minutos reservados hoy — un NO_SHOW igual ocupó la agenda, cuenta.
  select coalesce(sum(extract(epoch from (hora_fin - hora_inicio)) / 60), 0)
  into v_reservado_min
  from public.reserva
  where negocio_id = p_negocio_id
    and (p_sede_id is null or sede_id = p_sede_id)
    and hora_inicio >= v_inicio_dia and hora_inicio < v_fin_dia
    and estado <> 'CANCELADA';

  -- Capacidad: minutos de disponibilidad configurada hoy por Staff ACTIVO,
  -- descontando la franja completa si se solapa con un bloqueo de ausencia
  -- (simplificación V1 documentada en 01-PRD/05_KPIs.md).
  select coalesce(sum(extract(epoch from (d.hora_fin - d.hora_inicio)) / 60), 0)
  into v_capacidad_min
  from public.disponibilidad d
  join public.vinculo_staff_negocio v on v.id = d.vinculo_id
  where v.negocio_id = p_negocio_id
    and v.estado = 'ACTIVO'
    and (p_sede_id is null or v.sede_activa_id = p_sede_id)
    and d.dia_semana = v_dia_semana
    and not exists (
      select 1 from public.bloqueo_ausencia b
      where b.vinculo_id = d.vinculo_id
        and b.fecha_inicio < ((v_hoy::timestamp + d.hora_fin) at time zone 'America/Bogota')
        and b.fecha_fin > ((v_hoy::timestamp + d.hora_inicio) at time zone 'America/Bogota')
    );

  v_ocupacion_pct := case when v_capacidad_min > 0 then round((v_reservado_min / v_capacidad_min) * 100, 1) else null end;

  select jsonb_build_object(
    'reserva_id', r.id, 'hora_inicio', r.hora_inicio, 'staff_nombre', s.nombre, 'sede_id', r.sede_id
  )
  into v_proxima
  from public.reserva r
  left join public.staff s on s.usuario_id = r.staff_id
  where r.negocio_id = p_negocio_id
    and (p_sede_id is null or r.sede_id = p_sede_id)
    and r.estado = 'CONFIRMADA'
    and r.hora_inicio >= now()
  order by r.hora_inicio asc
  limit 1;

  return jsonb_build_object(
    'citas_hoy', v_citas_hoy,
    'ingresos_hoy', v_ingresos_hoy,
    'ocupacion_pct', v_ocupacion_pct,
    'capacidad_minutos', v_capacidad_min,
    'reservado_minutos', v_reservado_min,
    'proxima_cita', v_proxima
  );
end;
$function$;

revoke all on function public.dashboard_resumen_dia(uuid, uuid) from public, anon, authenticated;
grant execute on function public.dashboard_resumen_dia(uuid, uuid) to authenticated, service_role;

CREATE OR REPLACE FUNCTION public.reportes_ingresos_periodo(p_negocio_id uuid, p_sede_id uuid DEFAULT NULL::uuid, p_desde date DEFAULT NULL::date, p_hasta date DEFAULT NULL::date, p_agrupacion text DEFAULT 'semana'::text)
 RETURNS TABLE(periodo date, ingresos numeric, citas_completadas integer)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path = public
AS $function$
declare
  v_autorizado boolean;
  v_desde date := coalesce(p_desde, (now() at time zone 'America/Bogota')::date - interval '12 weeks');
  v_hasta date := coalesce(p_hasta, (now() at time zone 'America/Bogota')::date);
  v_unidad text := case when p_agrupacion = 'mes' then 'month' else 'week' end;
begin
  if p_agrupacion not in ('semana', 'mes') then
    raise exception 'AGRUPACION_INVALIDA';
  end if;
  if p_sede_id is not null then
    v_autorizado := coalesce(public.is_barberia_de(p_negocio_id), false)
      or (coalesce(public.is_guardian_de_sede(p_sede_id), false)
          and exists (select 1 from public.sede s where s.id = p_sede_id and s.negocio_id = p_negocio_id));
  else
    v_autorizado := coalesce(public.is_barberia_de(p_negocio_id), false);
  end if;
  if not v_autorizado and not public.is_supersu() then
    raise exception 'NO_AUTORIZADO';
  end if;

  return query
  select
    date_trunc(v_unidad, r.hora_inicio at time zone 'America/Bogota')::date as periodo,
    coalesce(sum(r.monto_total), 0) as ingresos,
    count(*)::int as citas_completadas
  from public.reserva r
  where r.negocio_id = p_negocio_id
    and (p_sede_id is null or r.sede_id = p_sede_id)
    and r.estado = 'COMPLETADA'
    and (r.hora_inicio at time zone 'America/Bogota')::date >= v_desde
    and (r.hora_inicio at time zone 'America/Bogota')::date <= v_hasta
  group by 1
  order by 1;
end;
$function$;

revoke all on function public.reportes_ingresos_periodo(uuid, uuid, date, date, text) from public, anon, authenticated;
grant execute on function public.reportes_ingresos_periodo(uuid, uuid, date, date, text) to authenticated, service_role;

CREATE OR REPLACE FUNCTION public.reportes_servicios_top(p_negocio_id uuid, p_sede_id uuid DEFAULT NULL::uuid, p_desde date DEFAULT NULL::date, p_hasta date DEFAULT NULL::date)
 RETURNS TABLE(servicio_id uuid, nombre text, veces_vendido integer, ingresos numeric)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path = public
AS $function$
declare
  v_autorizado boolean;
  v_desde date := coalesce(p_desde, (now() at time zone 'America/Bogota')::date - interval '90 days');
  v_hasta date := coalesce(p_hasta, (now() at time zone 'America/Bogota')::date);
begin
  if p_sede_id is not null then
    v_autorizado := coalesce(public.is_barberia_de(p_negocio_id), false)
      or (coalesce(public.is_guardian_de_sede(p_sede_id), false)
          and exists (select 1 from public.sede s where s.id = p_sede_id and s.negocio_id = p_negocio_id));
  else
    v_autorizado := coalesce(public.is_barberia_de(p_negocio_id), false);
  end if;
  if not v_autorizado and not public.is_supersu() then
    raise exception 'NO_AUTORIZADO';
  end if;

  return query
  select
    sv.id as servicio_id,
    sv.nombre,
    count(*)::int as veces_vendido,
    coalesce(sum(rs.precio_congelado_unitario), 0) as ingresos
  from public.reserva_servicio rs
  join public.reserva r on r.id = rs.reserva_id
  join public.servicio sv on sv.id = rs.servicio_id
  where r.negocio_id = p_negocio_id
    and (p_sede_id is null or r.sede_id = p_sede_id)
    and r.estado = 'COMPLETADA'
    and (r.hora_inicio at time zone 'America/Bogota')::date >= v_desde
    and (r.hora_inicio at time zone 'America/Bogota')::date <= v_hasta
  group by sv.id, sv.nombre
  order by veces_vendido desc, ingresos desc
  limit 20;
end;
$function$;

revoke all on function public.reportes_servicios_top(uuid, uuid, date, date) from public, anon, authenticated;
grant execute on function public.reportes_servicios_top(uuid, uuid, date, date) to authenticated, service_role;

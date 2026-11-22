-- 166 · FASE 2B · Disparadores de bloqueo operativo en las tablas que crean o modifican la operación (depende de 160).
--
-- Cubren las escrituras directas (RLS del propietario, Server Actions con el JWT del usuario) Y las RPC SECURITY DEFINER que escriban
-- en esas tablas, porque auth.uid() sigue siendo quien llama. NO se aplican al sistema (service_role, cron, webhooks: auth.uid() nulo)
-- ni al SuperSU. Un negocio en alta (PENDIENTE_APROBACION) se considera operativo (160), así que el alta guiada no se ve afectada.
--
-- Tablas guardadas (cada una con su forma de llegar al negocio):
--   negocio_id directo: servicio, servicio_combo, oferta_negocio, membresia_plan, cashback_regla, recompensa_regla, sello_campana,
--     campana_publicitaria, vip_nivel, producto, invitacion_staff, referido_config, corporativo_cuenta, familia_grupo, sede,
--     negocio_marca (Mi Marca), ai_memoria_negocio y ai_prompt (IA del negocio; el motor de IA con clave de servicio no pasa por aquí)
--   vía sede: sede_horario_excepcion, recurso · vía vínculo: disponibilidad, bloqueo_ausencia · vía servicio: staff_servicio,
--     servicio_producto_consumo · vía combo: servicio_combo_item · vía reserva: reserva_servicio
--   vinculo_staff_negocio: crear siempre bloqueado; cambiar/borrar bloqueado salvo que el vínculo sea del propio usuario.
--   negocio: bloqueado cambiar datos del negocio (nombre, marca, anticipos, políticas…); NO se bloquean estado, plan, país ni propietario.
--   reserva: NO se bloquea el cambio de estado (completar/cancelar/no-show); SÍ se bloquea mover una cita (hora, sede, recurso).
--
-- NO se guardan por disparador (se hace por RPC en 163) las tablas que el cumplimiento de una cita sí toca: movimiento_inventario,
-- producto_stock, venta_producto, wallet, puntos, etc.
-- Reversión: 162_..._REVERSION.sql.txt.

begin;
set local lock_timeout = '5s';

create or replace function public.trg_guardia_operativa()
 returns trigger language plpgsql security definer set search_path to 'public'
as $function$
declare v_fila jsonb; v_neg uuid; v_tipo text := tg_argv[0];
begin
  if auth.uid() is null then return case when tg_op = 'DELETE' then old else new end; end if;   -- sistema
  if coalesce(public.is_supersu(), false) then return case when tg_op = 'DELETE' then old else new end; end if;
  v_fila := to_jsonb(case when tg_op = 'DELETE' then old else new end);
  v_neg := case v_tipo
    when 'negocio'  then (v_fila->>'negocio_id')::uuid
    when 'sede'     then (select s.negocio_id from public.sede s where s.id = (v_fila->>'sede_id')::uuid)
    when 'vinculo'  then (select v.negocio_id from public.vinculo_staff_negocio v where v.id = (v_fila->>'vinculo_id')::uuid)
    when 'servicio' then (select s.negocio_id from public.servicio s where s.id = (v_fila->>'servicio_id')::uuid)
    when 'combo'    then (select c.negocio_id from public.servicio_combo c where c.id = (v_fila->>'combo_id')::uuid)
    when 'reserva'  then (select r.negocio_id from public.reserva r where r.id = (v_fila->>'reserva_id')::uuid)
    else null end;
  if v_tipo not in ('negocio', 'sede', 'vinculo', 'servicio', 'combo', 'reserva') then raise exception 'GUARDIA_TIPO_DESCONOCIDO: %', v_tipo; end if;
  -- Filas sin negocio (p. ej. un grupo familiar global) no pertenecen a ninguna suscripción: no se guardan.
  if v_neg is null then return case when tg_op = 'DELETE' then old else new end; end if;
  perform public._exigir_operativo(v_neg);
  return case when tg_op = 'DELETE' then old else new end;
end $function$;
revoke all on function public.trg_guardia_operativa() from public, anon, authenticated;

-- Equipo: el propio usuario puede tocar su vínculo (p. ej. dejar de atender); el resto del equipo, no.
create or replace function public.trg_guardia_operativa_equipo()
 returns trigger language plpgsql security definer set search_path to 'public'
as $function$
begin
  if auth.uid() is null or coalesce(public.is_supersu(), false) then return case when tg_op = 'DELETE' then old else new end; end if;
  if tg_op <> 'INSERT' and old.staff_id = auth.uid() then return case when tg_op = 'DELETE' then old else new end; end if;
  perform public._exigir_operativo(case when tg_op = 'DELETE' then old.negocio_id else new.negocio_id end);
  return case when tg_op = 'DELETE' then old else new end;
end $function$;
revoke all on function public.trg_guardia_operativa_equipo() from public, anon, authenticated;

-- Datos del negocio: cualquier cambio salvo estado/plan/país/propietario/alta (los usan flujos de pago, cancelación y alta).
create or replace function public.trg_guardia_operativa_negocio()
 returns trigger language plpgsql security definer set search_path to 'public'
as $function$
declare v_ign text[] := array['estado', 'plan_codigo', 'pais_codigo', 'updated_at', 'onboarding_completo', 'owner_user_id'];
begin
  if auth.uid() is null or coalesce(public.is_supersu(), false) then return new; end if;
  if (to_jsonb(new) - v_ign) is distinct from (to_jsonb(old) - v_ign) then perform public._exigir_operativo(old.id); end if;
  return new;
end $function$;
revoke all on function public.trg_guardia_operativa_negocio() from public, anon, authenticated;

-- Mover una cita confirmada a otra fecha/sede/recurso cuenta como evasión del bloqueo (aplica a cualquier llamador salvo SuperSU).
create or replace function public.trg_guardia_reprogramacion()
 returns trigger language plpgsql security definer set search_path to 'public'
as $function$
begin
  if coalesce(public.is_supersu(), false) then return new; end if;
  if new.hora_inicio is distinct from old.hora_inicio or new.hora_fin is distinct from old.hora_fin
     or new.sede_id is distinct from old.sede_id or new.recurso_id is distinct from old.recurso_id then
    perform public._exigir_operativo(old.negocio_id);
  end if;
  return new;
end $function$;
revoke all on function public.trg_guardia_reprogramacion() from public, anon, authenticated;

do $$
declare r record;
begin
  for r in select * from (values
    ('servicio','negocio'),('servicio_combo','negocio'),('oferta_negocio','negocio'),('membresia_plan','negocio'),
    ('cashback_regla','negocio'),('recompensa_regla','negocio'),('sello_campana','negocio'),('campana_publicitaria','negocio'),
    ('vip_nivel','negocio'),('producto','negocio'),('invitacion_staff','negocio'),('referido_config','negocio'),
    ('corporativo_cuenta','negocio'),('familia_grupo','negocio'),('sede','negocio'),
    ('negocio_marca','negocio'),('ai_memoria_negocio','negocio'),('ai_prompt','negocio'),
    ('sede_horario_excepcion','sede'),('recurso','sede'),('disponibilidad','vinculo'),('bloqueo_ausencia','vinculo'),
    ('staff_servicio','servicio'),('servicio_producto_consumo','servicio'),('servicio_combo_item','combo'),('reserva_servicio','reserva')
  ) t(tabla, tipo)
  loop
    execute format('drop trigger if exists trg_guardia_operativa on public.%I', r.tabla);
    execute format('create trigger trg_guardia_operativa before insert or update or delete on public.%I for each row execute function public.trg_guardia_operativa(%L)', r.tabla, r.tipo);
  end loop;
end $$;

drop trigger if exists trg_guardia_operativa on public.vinculo_staff_negocio;
create trigger trg_guardia_operativa before insert or update or delete on public.vinculo_staff_negocio
  for each row execute function public.trg_guardia_operativa_equipo();
drop trigger if exists trg_guardia_operativa on public.negocio;
create trigger trg_guardia_operativa before update on public.negocio
  for each row execute function public.trg_guardia_operativa_negocio();
drop trigger if exists trg_guardia_reprogramacion on public.reserva;
create trigger trg_guardia_reprogramacion before update of hora_inicio, hora_fin, sede_id, recurso_id on public.reserva
  for each row execute function public.trg_guardia_reprogramacion();

commit;

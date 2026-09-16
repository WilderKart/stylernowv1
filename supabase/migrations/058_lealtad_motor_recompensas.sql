-- StylerNow — Migración 058: Dominio LEALTAD (ADR-011) — Módulo 12: Motor
-- de recompensas automáticas.
-- "Implementarlo desde ahora. NO la IA completa. Sí el motor." — se
-- construye: (1) detección de candidatos 100% SQL (Nivel 0, reglas
-- fijas, igual criterio que Horarios muertos, Fase 6/Módulo 6.4), (2) el
-- motor de reglas configurable por Negocio, (3) el enganche a IA real
-- (OpenRouter, ADR-011) para redactar la justificación de Nivel 1/2 desde
-- la capa TypeScript (Postgres no puede llamar una API HTTP externa),
-- (4) confirmación humana obligatoria antes de cualquier efecto de dinero
-- — "La IA en StylerNow V1 recomienda, nunca actúa de forma autónoma
-- sobre datos de negocio o dinero" (09-CRM-Intelligence/04_AI_Business.md,
-- principio ya vigente, aplicado acá también).

create or replace function public.crear_regla_recompensa(p_negocio_id uuid, p_disparador text, p_nivel_ia int, p_condicion jsonb, p_accion jsonb, p_requiere_confirmacion boolean default true)
returns public.recompensa_regla
language plpgsql security definer set search_path = public as $fn$
declare
  v_regla public.recompensa_regla;
begin
  if not public.is_barberia_de(p_negocio_id) then raise exception 'NO_AUTORIZADO'; end if;
  if p_disparador not in ('CLIENTE_INACTIVO', 'CUMPLEANOS', 'OBJETIVO_LOGRADO', 'RIESGO_ABANDONO', 'MEJOR_HORARIO') then
    raise exception 'DISPARADOR_INVALIDO';
  end if;
  if p_nivel_ia not in (0, 1, 2) then raise exception 'NIVEL_IA_INVALIDO'; end if;

  insert into public.recompensa_regla (negocio_id, disparador, nivel_ia, condicion, accion, requiere_confirmacion)
  values (p_negocio_id, p_disparador, p_nivel_ia, p_condicion, p_accion, p_requiere_confirmacion)
  returning * into v_regla;

  return v_regla;
end;
$fn$;
grant execute on function public.crear_regla_recompensa(uuid, text, int, jsonb, jsonb, boolean) to authenticated;

create or replace function public.alternar_regla_recompensa(p_regla_id uuid, p_activo boolean)
returns public.recompensa_regla
language plpgsql security definer set search_path = public as $fn$
declare
  v_regla public.recompensa_regla;
begin
  select * into v_regla from public.recompensa_regla where id = p_regla_id;
  if not found or not public.is_barberia_de(v_regla.negocio_id) then raise exception 'NO_AUTORIZADO'; end if;

  update public.recompensa_regla set activo = p_activo where id = p_regla_id returning * into v_regla;
  return v_regla;
end;
$fn$;
grant execute on function public.alternar_regla_recompensa(uuid, boolean) to authenticated;

-- Detección de candidatos — Nivel 0 puro, sin IA. Reusa exactamente el
-- mismo criterio ya verificado de detectar_horarios_muertos() para
-- MEJOR_HORARIO (Módulo 6.4), en vez de duplicar esa lógica.
create or replace function public.evaluar_candidatos_recompensa(p_regla_id uuid)
returns table (cliente_id uuid, contexto jsonb)
language plpgsql stable security definer set search_path = public as $fn$
declare
  v_regla public.recompensa_regla;
  v_dias_inactividad int;
begin
  select * into v_regla from public.recompensa_regla where id = p_regla_id;
  if not found or not public.is_barberia_de(v_regla.negocio_id) then raise exception 'NO_AUTORIZADO'; end if;

  if v_regla.disparador = 'CLIENTE_INACTIVO' or v_regla.disparador = 'RIESGO_ABANDONO' then
    v_dias_inactividad := coalesce((v_regla.condicion->>'dias_inactividad')::int, 30);
    return query
      select r.cliente_id,
        jsonb_build_object(
          'dias_desde_ultima_visita', extract(day from now() - max(r.hora_inicio))::int,
          'visitas_totales', count(*)
        )
      from public.reserva r
      where r.negocio_id = v_regla.negocio_id and r.estado = 'COMPLETADA'
      group by r.cliente_id
      having max(r.hora_inicio) < now() - make_interval(days => v_dias_inactividad);

  elsif v_regla.disparador = 'CUMPLEANOS' then
    return query
      select p.id,
        jsonb_build_object('nombre', p.nombre, 'fecha_nacimiento', p.fecha_nacimiento)
      from public.perfil p
      join public.reserva r on r.cliente_id = p.id and r.negocio_id = v_regla.negocio_id and r.estado = 'COMPLETADA'
      where p.fecha_nacimiento is not null
        and extract(month from p.fecha_nacimiento) = extract(month from current_date)
        and extract(day from p.fecha_nacimiento) = extract(day from current_date)
        and not exists (
          select 1 from public.recompensa_sugerencia s
          where s.regla_id = p_regla_id and s.cliente_id = p.id and s.created_at >= date_trunc('year', now())
        )
      group by p.id;

  elsif v_regla.disparador = 'OBJETIVO_LOGRADO' then
    return query
      select sc.cliente_id,
        jsonb_build_object('campana', c.nombre, 'sellos_actuales', sc.sellos_actuales, 'sellos_requeridos', c.sellos_requeridos)
      from public.sello_cliente sc
      join public.sello_campana c on c.id = sc.campana_id
      where c.negocio_id = v_regla.negocio_id and sc.sellos_actuales >= c.sellos_requeridos
        and not exists (
          select 1 from public.recompensa_sugerencia s
          where s.regla_id = p_regla_id and s.cliente_id = sc.cliente_id and s.created_at >= now() - interval '7 days'
        );

  elsif v_regla.disparador = 'MEJOR_HORARIO' then
    return query
      select null::uuid, jsonb_build_object('franja', to_jsonb(h))
      from public.detectar_horarios_muertos(v_regla.negocio_id) h;
  end if;

  return;
end;
$fn$;
grant execute on function public.evaluar_candidatos_recompensa(uuid) to authenticated;

-- Inserta la sugerencia final (Nivel 0: descripción de plantilla fija;
-- Nivel 1/2: descripción + justificación ya generadas por OpenRouter en
-- la capa TypeScript, ver src/lib/ia/recompensas.ts) — nunca ejecuta
-- ningún efecto de dinero por sí sola.
create or replace function public.crear_sugerencia_recompensa(p_regla_id uuid, p_cliente_id uuid, p_descripcion text, p_justificacion text default null, p_costo_credito_ia int default 0)
returns public.recompensa_sugerencia
language plpgsql security definer set search_path = public as $fn$
declare
  v_regla public.recompensa_regla;
  v_sugerencia public.recompensa_sugerencia;
begin
  select * into v_regla from public.recompensa_regla where id = p_regla_id;
  if not found then raise exception 'REGLA_NO_ENCONTRADA'; end if;
  -- Llamada de sistema (desde el server de Next.js con service_role) o la
  -- propia Barbería probando su regla manualmente — ambos casos válidos.
  if auth.uid() is not null and not public.is_barberia_de(v_regla.negocio_id) then raise exception 'NO_AUTORIZADO'; end if;

  insert into public.recompensa_sugerencia (regla_id, negocio_id, cliente_id, descripcion, justificacion, costo_credito_ia)
  values (p_regla_id, v_regla.negocio_id, p_cliente_id, p_descripcion, p_justificacion, p_costo_credito_ia)
  returning * into v_sugerencia;

  return v_sugerencia;
end;
$fn$;
grant execute on function public.crear_sugerencia_recompensa(uuid, uuid, text, text, int) to authenticated;

create or replace function public.listar_sugerencias_recompensa(p_negocio_id uuid)
returns setof public.recompensa_sugerencia
language sql stable security definer set search_path = public as $fn$
  select * from public.recompensa_sugerencia
  where negocio_id = p_negocio_id and public.tiene_acceso_interno(p_negocio_id)
  order by created_at desc;
$fn$;
grant execute on function public.listar_sugerencias_recompensa(uuid) to authenticated;

-- Confirmar ejecuta el ÚNICO efecto de dinero soportado en V1 (crédito
-- directo a StylerWallet, accion = {"tipo":"CREDITO_WALLET","monto":N}) —
-- cualquier otra acción (ej. activar una campaña) queda como sugerencia
-- confirmada para que la Barbería la ejecute a mano desde su propio panel,
-- nunca automático.
create or replace function public.confirmar_sugerencia_recompensa(p_sugerencia_id uuid)
returns public.recompensa_sugerencia
language plpgsql security definer set search_path = public as $fn$
declare
  v_sugerencia public.recompensa_sugerencia;
  v_regla public.recompensa_regla;
  v_monto numeric;
begin
  select * into v_sugerencia from public.recompensa_sugerencia where id = p_sugerencia_id for update;
  if not found or not public.is_barberia_de(v_sugerencia.negocio_id) then raise exception 'NO_AUTORIZADO'; end if;
  if v_sugerencia.estado <> 'PENDIENTE' then raise exception 'TRANSICION_INVALIDA'; end if;

  select * into v_regla from public.recompensa_regla where id = v_sugerencia.regla_id;

  if v_regla.accion->>'tipo' = 'CREDITO_WALLET' and v_sugerencia.cliente_id is not null then
    v_monto := (v_regla.accion->>'monto')::numeric;
    if v_monto > 0 then
      perform public._lealtad_acreditar(
        v_sugerencia.cliente_id, 'PROMOCION', v_monto, v_sugerencia.negocio_id, null,
        'recompensa_sugerencia', v_sugerencia.id, v_sugerencia.descripcion
      );
    end if;
  end if;

  update public.recompensa_sugerencia set estado = 'CONFIRMADA', resuelta_at = now() where id = p_sugerencia_id
  returning * into v_sugerencia;

  insert into public.evento_auditoria (entidad_tipo, entidad_id, accion, actor_tipo, actor_id, negocio_id, payload_despues)
  values ('recompensa_sugerencia', p_sugerencia_id, 'SUGERENCIA_CONFIRMADA', 'BARBERIA', auth.uid(), v_sugerencia.negocio_id, jsonb_build_object('monto', v_monto));

  return v_sugerencia;
end;
$fn$;
grant execute on function public.confirmar_sugerencia_recompensa(uuid) to authenticated;

create or replace function public.descartar_sugerencia_recompensa(p_sugerencia_id uuid)
returns public.recompensa_sugerencia
language plpgsql security definer set search_path = public as $fn$
declare
  v_sugerencia public.recompensa_sugerencia;
begin
  select * into v_sugerencia from public.recompensa_sugerencia where id = p_sugerencia_id;
  if not found or not public.is_barberia_de(v_sugerencia.negocio_id) then raise exception 'NO_AUTORIZADO'; end if;
  if v_sugerencia.estado <> 'PENDIENTE' then raise exception 'TRANSICION_INVALIDA'; end if;

  update public.recompensa_sugerencia set estado = 'DESCARTADA', resuelta_at = now() where id = p_sugerencia_id
  returning * into v_sugerencia;

  return v_sugerencia;
end;
$fn$;
grant execute on function public.descartar_sugerencia_recompensa(uuid) to authenticated;

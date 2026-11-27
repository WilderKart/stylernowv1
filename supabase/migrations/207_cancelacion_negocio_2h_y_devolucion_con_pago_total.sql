-- 207 · Cancelación por parte del negocio con mínimo 2 h y devolución cuando el cliente pagó el servicio completo
--
-- Dos reglas nuevas, ambas aplicadas en la base de datos (la interfaz solo las muestra):
--
--  1. El NEGOCIO (propietario, guardián de sede o staff de la cita) solo puede cancelar una reserva con 2 horas o más de
--     anticipación. Con menos, `cancelar_reserva` lanza CANCELACION_NEGOCIO_MUY_TARDE. No aplica al Super Admin ni a las
--     cascadas por suspensión/baja del negocio (motivo «Negocio suspendido…» / «Negocio dado de baja…»), que siguen igual.
--
--  2. Cuando el negocio cobra el servicio completo en la app (negocio.pago_completo_en_app), lo pagado es:
--         pagado = anticipo + excedente del servicio
--     El anticipo sigue definido por la configuración de anticipo del negocio y es lo ÚNICO que la política de cancelación
--     (100 % / parcial / 0 %) puede retener. El excedente (servicio − anticipo) siempre se devuelve si la cita no se presta:
--         devolución = excedente + anticipo × pct / 100
--     Ejemplo: servicio 30.000, anticipo 10.000 →  pct 100: 30.000 · pct 50: 25.000 · pct 0: 20.000.
--     Si cancela el negocio, el pct es 100 y se devuelve todo lo pagado.
--
-- Cómo se conoce el anticipo cuando se pagó el total: `reserva.monto_anticipo_base`, calculado al crear la reserva con
-- `calcular_anticipo_base_servicios` (mismo motor de la 129 pero sin el atajo «pago completo»). Es una foto: si el negocio
-- cambia su configuración después, las reservas ya creadas conservan su anticipo. NULL (reservas anteriores, o negocios que
-- no cobran el total) = anticipo igual a lo pagado, es decir, el comportamiento de siempre.
--
-- También se aplica la devolución del excedente a la no presentación (`marcar_no_show`): el negocio se queda con el anticipo
-- y devuelve el resto. Con pago directo (transferencia al negocio) la plataforma no mueve dinero: `cancelar_reserva` informa
-- en `devolver_directo` cuánto debe devolver el negocio.

-- ════════════════════════════════════════════════════════════════════════
-- 1. Anticipo de política por reserva
-- ════════════════════════════════════════════════════════════════════════

alter table public.reserva add column if not exists monto_anticipo_base numeric(12,2)
  check (monto_anticipo_base is null or monto_anticipo_base >= 0);
comment on column public.reserva.monto_anticipo_base is
  'Anticipo según la configuración del negocio al reservar, aparte de lo pagado. Solo se llena cuando se cobra el servicio completo; NULL = el anticipo es lo pagado.';

-- Igual que calcular_sena_servicios (129) pero ignorando pago_completo_en_app. Incluye la regla del negocio de calcular_sena (008).
create or replace function public.calcular_anticipo_base_servicios(p_negocio_id uuid, p_servicio_ids uuid[], p_monto_total numeric)
returns numeric language plpgsql stable security definer set search_path = public as $$
declare
  n public.negocio;
  v_override numeric := 0;
  v_subtotal_sin_regla numeric := 0;
  v_hay_override boolean := false;
  v numeric;
begin
  select * into n from public.negocio where id = p_negocio_id;
  if not found then raise exception 'NEGOCIO_NO_DISPONIBLE'; end if;
  if n.anticipo_modo = 'NINGUNO' then return 0; end if;
  if not public.negocio_cobra_en_linea(p_negocio_id) then return 0; end if;

  select coalesce(sum(case when s.anticipo_monto_fijo is not null then least(s.anticipo_monto_fijo, s.precio_base)
                           when s.anticipo_pct is not null then round(s.precio_base * s.anticipo_pct / 100) end), 0),
         coalesce(sum(case when s.anticipo_monto_fijo is null and s.anticipo_pct is null then s.precio_base end), 0),
         bool_or(s.anticipo_monto_fijo is not null or s.anticipo_pct is not null)
    into v_override, v_subtotal_sin_regla, v_hay_override
    from public.servicio s
   where s.id = any(coalesce(p_servicio_ids, '{}')) and s.negocio_id = p_negocio_id;

  if not coalesce(v_hay_override, false) then
    v := coalesce(n.sena_monto_fijo, round(p_monto_total * coalesce(n.sena_pct, 20) / 100));
    v := greatest(v, n.sena_minimo);
    v := least(v, n.sena_maximo);
    return least(v, p_monto_total);
  end if;

  v := v_override;
  if v_subtotal_sin_regla > 0 then
    v := v + coalesce(n.sena_monto_fijo, round(v_subtotal_sin_regla * coalesce(n.sena_pct, 20) / 100));
  end if;
  v := greatest(v, n.sena_minimo);
  v := least(v, n.sena_maximo);
  return least(v, p_monto_total);
end $$;
revoke all on function public.calcular_anticipo_base_servicios(uuid, uuid[], numeric) from public, anon, authenticated;
grant execute on function public.calcular_anticipo_base_servicios(uuid, uuid[], numeric) to service_role;

-- Foto del anticipo al reservar. Se dispara con cada servicio insertado; el último deja el valor definitivo.
create or replace function public._reserva_servicio_anticipo_base()
returns trigger language plpgsql security definer set search_path = public as $$
declare r public.reserva; v_ids uuid[];
begin
  select * into r from public.reserva where id = new.reserva_id;
  if not found then return new; end if;
  if not coalesce((select pago_completo_en_app from public.negocio where id = r.negocio_id), false) then return new; end if;
  select array_agg(servicio_id) into v_ids from public.reserva_servicio where reserva_id = new.reserva_id;
  update public.reserva
     set monto_anticipo_base = public.calcular_anticipo_base_servicios(r.negocio_id, v_ids, r.monto_total)
   where id = new.reserva_id;
  return new;
end $$;
revoke all on function public._reserva_servicio_anticipo_base() from public, anon, authenticated;

drop trigger if exists reserva_servicio_anticipo_base on public.reserva_servicio;
create trigger reserva_servicio_anticipo_base
  after insert on public.reserva_servicio
  for each row execute function public._reserva_servicio_anticipo_base();

-- ════════════════════════════════════════════════════════════════════════
-- 2. cancelar_reserva: 2 h para el negocio y devolución = excedente + anticipo × pct
-- ════════════════════════════════════════════════════════════════════════
-- Misma firma. Parte de la definición vigente (116 + parche de pago directo de la 194).

create or replace function public.cancelar_reserva(p_reserva_id uuid, p_motivo text default null)
returns jsonb language plpgsql security definer set search_path = public as $fn$
declare
  v_actor uuid := auth.uid();
  v_reserva public.reserva;
  v_es_cliente boolean;
  v_es_negocio boolean;
  v_horas numeric;
  v_pct numeric;
  v_pol jsonb;
  v_pago public.pago;
  v_tiene_pago boolean;
  v_monto_reembolso numeric := 0;
  v_motivo_catalogo text;
  v_reembolso_id uuid;
  v_origen text;
  v_pago_directo boolean := false;
  v_pd public.pago_reserva;
  v_pagado numeric := 0;
  v_base numeric := 0;
  v_exceso numeric := 0;
  v_a_devolver numeric := 0;
  v_devolver_directo numeric := 0;
begin
  if v_actor is null then raise exception 'NO_AUTENTICADO'; end if;

  select * into v_reserva from public.reserva where id = p_reserva_id for update;
  if not found then raise exception 'RESERVA_NO_ENCONTRADA'; end if;

  -- coalesce: con staff_id nulo, `staff_id = actor` da NULL y en la 008 eso hacía que la
  -- cancelación del cliente se tratara como del negocio (100 % siempre). Corregido aquí.
  v_es_cliente := coalesce(v_reserva.cliente_id = v_actor, false);
  v_es_negocio := coalesce(public.is_barberia_de(v_reserva.negocio_id), false)
               or coalesce(public.is_guardian_de_sede(v_reserva.sede_id), false)
               or coalesce(v_reserva.staff_id = v_actor, false);

  if not (v_es_cliente or v_es_negocio or coalesce(public.is_supersu(), false)) then raise exception 'NO_AUTORIZADO'; end if;
  if v_reserva.estado in ('COMPLETADA','CANCELADA','NO_SHOW','EN_CURSO') then raise exception 'RESERVA_NO_CANCELABLE'; end if;

  v_horas := extract(epoch from (v_reserva.hora_inicio - now())) / 3600;
  v_pol := public.politica_de_reserva(p_reserva_id);

  if v_es_cliente and not v_es_negocio then
    v_origen := 'CANCELACION_CLIENTE';
    if v_horas >= (v_pol->>'total_horas')::numeric then
      v_pct := 100; v_motivo_catalogo := 'CANCELACION_CLIENTE_VENTANA_TOTAL';
    elsif v_horas >= (v_pol->>'parcial_horas')::numeric then
      v_pct := (v_pol->>'parcial_pct')::numeric; v_motivo_catalogo := 'CANCELACION_CLIENTE_VENTANA_PARCIAL';
    else
      v_pct := 0; v_motivo_catalogo := 'AJUSTE_SERVICIO';   -- solo se devolverá el excedente del servicio, si lo hay
    end if;
  else
    -- Negocio, staff o plataforma: 100 %.
    v_pct := 100; v_motivo_catalogo := 'CANCELACION_NEGOCIO';
    -- Las cascadas de 024/049 pasan 'Negocio suspendido: …' / 'Negocio dado de baja…'.
    v_origen := case when coalesce(p_motivo, '') ~ '^Negocio (suspendido|dado de baja)'
                     then 'CIERRE_O_SUSPENSION' else 'CANCELACION_NEGOCIO' end;
    -- Regla 207: el negocio cancela con 2 h o más de anticipación. Quedan fuera la plataforma y las cascadas por suspensión o
    -- baja: estas se reconocen por el ESTADO REAL del negocio (SUSPENDIDO o CANCELADO cuando la cascada corre), no por el texto del
    -- motivo, que lo envía quien llama y serviría para saltarse la regla.
    if not coalesce(public.is_supersu(), false)
       and coalesce((select estado not in ('SUSPENDIDO', 'CANCELADO') from public.negocio where id = v_reserva.negocio_id), true)
       and v_horas < 2 then
      raise exception 'CANCELACION_NEGOCIO_MUY_TARDE';
    end if;
  end if;

  update public.reserva
     set estado = 'CANCELADA',
         cancelado_por = case when v_es_cliente and not v_es_negocio then 'CLIENTE' else 'NEGOCIO' end,
         cancelado_motivo = p_motivo,
         updated_at = now()
   where id = p_reserva_id;

  select * into v_pago from public.pago
   where reserva_id = p_reserva_id and tipo = 'SENA' and estado = 'APROBADO'
   order by created_at desc limit 1;
  v_tiene_pago := found;

  select * into v_pd from public.pago_reserva
   where reserva_id = p_reserva_id and metodo = 'TRANSFERENCIA_DIRECTA' and estado <> 'RECHAZADO'
   order by created_at desc limit 1;
  v_pago_directo := found;

  if v_pago_directo then
    -- La plataforma no devolvió ni recibió este dinero: solo se informa cuánto debe devolver el negocio.
    v_tiene_pago := false;
    v_pagado := v_pd.monto_reportado;
    v_base := least(coalesce(v_reserva.monto_anticipo_base, v_pagado), v_pagado);
    v_exceso := greatest(v_pagado - v_base, 0);
    v_devolver_directo := round(v_exceso + v_base * v_pct / 100, 2);
  elsif v_tiene_pago then
    v_pagado := v_pago.monto;
    v_base := least(coalesce(v_reserva.monto_anticipo_base, v_pagado), v_pagado);
    v_exceso := greatest(v_pagado - v_base, 0);
    v_a_devolver := round(v_exceso + v_base * v_pct / 100, 2);
    if v_a_devolver > 0 then
      v_monto_reembolso := v_a_devolver;
      -- pct del reembolso = porcentaje efectivo sobre lo pagado (igual a v_pct cuando no hay excedente).
      v_reembolso_id := public._reembolso_crear(v_pago.id, v_monto_reembolso, round(v_monto_reembolso * 100 / v_pagado, 2),
                                                v_motivo_catalogo, v_origen,
                                                case when v_es_cliente and not v_es_negocio then 'CLIENTE' else 'BARBERIA' end);
    end if;
  end if;

  insert into public.evento_auditoria
    (entidad_tipo, entidad_id, accion, actor_tipo, actor_id, negocio_id, motivo, payload_despues)
  values
    ('reserva', p_reserva_id, 'RESERVA_CANCELADA',
     case when v_es_cliente and not v_es_negocio then 'CLIENTE' else 'BARBERIA' end,
     v_actor, v_reserva.negocio_id, p_motivo,
     jsonb_build_object('reembolso_pct', case when v_pago_directo then 0 else v_pct end,
                        'reembolso_monto', v_monto_reembolso, 'reembolso_id', v_reembolso_id,
                        'pct_politica', v_pct, 'pagado', v_pagado, 'anticipo_base', v_base, 'exceso_servicio', v_exceso,
                        'devolver_directo', v_devolver_directo,
                        'horas_antes', round(v_horas, 2), 'politica', v_pol));

  -- El `pago` sigue APROBADO hasta que la pasarela confirme la devolución (worker de reembolsos).
  return jsonb_build_object(
    'reserva_id', p_reserva_id,
    'pago_id', case when v_tiene_pago then v_pago.id else null end,
    'reembolso_id', v_reembolso_id,
    'reembolso_pct', case when v_pago_directo then 0 else v_pct end,
    'reembolso_monto', v_monto_reembolso,
    'motivo_catalogo', v_motivo_catalogo,
    'pago_directo', v_pago_directo,
    'pagado', v_pagado,
    'anticipo_base', v_base,
    'exceso_servicio', v_exceso,
    'devolver_directo', v_devolver_directo);
end;
$fn$;
revoke all on function public.cancelar_reserva(uuid, text) from public, anon, authenticated;
grant execute on function public.cancelar_reserva(uuid, text) to authenticated;

-- ════════════════════════════════════════════════════════════════════════
-- 3. marcar_no_show: el negocio se queda con el anticipo y devuelve el excedente del servicio prepagado
-- ════════════════════════════════════════════════════════════════════════

create or replace function public.marcar_no_show(p_reserva_id uuid, p_motivo text default null)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_reserva public.reserva; v_pago public.pago; v_pagado numeric; v_base numeric; v_exceso numeric := 0; v_reembolso_id uuid;
begin
  if auth.uid() is null then raise exception 'NO_AUTENTICADO'; end if;
  select * into v_reserva from public.reserva where id = p_reserva_id for update;
  if not found then raise exception 'RESERVA_NO_ENCONTRADA'; end if;
  -- coalesce: con staff_id nulo la comparación da NULL y `not (… or NULL)` no lanzaría.
  if not (coalesce(public.is_barberia_de(v_reserva.negocio_id), false)
          or coalesce(public.is_guardian_de_sede(v_reserva.sede_id), false)
          or coalesce(v_reserva.staff_id = auth.uid(), false)
          or coalesce(public.is_supersu(), false)) then
    raise exception 'NO_AUTORIZADO';
  end if;
  if v_reserva.estado <> 'CONFIRMADA' then raise exception 'TRANSICION_RESERVA_INVALIDA'; end if;
  if now() < v_reserva.hora_inicio then raise exception 'NO_SHOW_ANTES_DE_LA_HORA'; end if;

  update public.reserva set estado = 'NO_SHOW', updated_at = now() where id = p_reserva_id;

  -- Pagó el servicio completo por la pasarela: el anticipo queda para el negocio, el resto se devuelve.
  select * into v_pago from public.pago
   where reserva_id = p_reserva_id and tipo = 'SENA' and estado = 'APROBADO'
   order by created_at desc limit 1;
  if found and not exists (select 1 from public.pago_reserva where reserva_id = p_reserva_id
                            and metodo = 'TRANSFERENCIA_DIRECTA' and estado <> 'RECHAZADO') then
    v_pagado := v_pago.monto;
    v_base := least(coalesce(v_reserva.monto_anticipo_base, v_pagado), v_pagado);
    v_exceso := greatest(v_pagado - v_base, 0);
    if v_exceso > 0 then
      v_reembolso_id := public._reembolso_crear(v_pago.id, v_exceso, round(v_exceso * 100 / v_pagado, 2),
                                                'AJUSTE_SERVICIO', 'AJUSTE', 'BARBERIA');
    end if;
  end if;

  insert into public.evento_auditoria (entidad_tipo, entidad_id, accion, actor_tipo, actor_id, negocio_id, motivo, payload_despues)
  values ('reserva', p_reserva_id, 'RESERVA_NO_SHOW', case when public.is_supersu() then 'SUPERSU' else 'BARBERIA' end,
          auth.uid(), v_reserva.negocio_id, p_motivo,
          jsonb_build_object('reembolso_pct', 0, 'exceso_devuelto', v_exceso, 'reembolso_id', v_reembolso_id));
end $$;
revoke all on function public.marcar_no_show(uuid, text) from public, anon, authenticated;
grant execute on function public.marcar_no_show(uuid, text) to authenticated;

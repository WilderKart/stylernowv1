-- 175: Barberos adicionales (FASE 2A) — mantenimiento diario (lo invoca /api/cron/diario; vercel.json permite UNA ejecución al día).
--
-- Operación idempotente y atómica (una sola transacción: si falla algo, no queda nada a medias y se reintenta el día siguiente):
--   1. activaciones manuales vencidas → CANCELADO;
--   2. lotes vencidos → EN_GRACIA (gracia_fin = vencimiento + gracia_dias, contada DESDE el vencimiento) y, solo cuando
--      gracia_fin ya pasó, → SUSPENDIDO. Nunca se suspende antes de terminar los días de gracia. No hay expiración a los 60 días;
--   3. ACTIVO que entra a la ventana de aviso → PROXIMO_A_RENOVAR;
--   4. avisos 7/3/1 (configurables) por el outbox, sin repetir (ultimo_aviso_dias + clave idempotente). Si el cron se salta un día
--      se envía el umbral más cercano aún no enviado;
--   5. checkouts abandonados → EXPIRADO_SIN_PAGO (nunca ocuparon cupo).
-- No toca suscripciones ni renovaciones de planes principales. Una corrida por día de Bogotá (adicional_mantenimiento_corrida);
-- repetirla el mismo día no hace nada (p_forzar la fuerza, y aun así cada paso es idempotente). Deja resultado en auditoría.
-- Rollback: 175_adicionales_mantenimiento_diario_REVERSION.sql.txt.

create or replace function public.adicional_mantenimiento_srv(p_ahora timestamptz default now(), p_forzar boolean default false)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  c public.adicional_config; v_hoy date; r record; v_max int; v_t int; v_dias int; v_res jsonb;
  n_manual int := 0; n_gracia int := 0; n_susp int := 0; n_prox int := 0; n_aviso int := 0; n_abandon int := 0;
begin
  perform pg_advisory_xact_lock(hashtextextended('adicional_mantenimiento', 0));
  select * into c from public.adicional_config where id;
  v_hoy := (p_ahora at time zone c.zona_horaria)::date;
  if not p_forzar and exists (select 1 from public.adicional_mantenimiento_corrida where fecha = v_hoy) then
    return jsonb_build_object('omitido', true, 'motivo', 'YA_EJECUTADO_HOY', 'fecha', v_hoy);
  end if;
  v_max := coalesce((select max(x) from unnest(c.avisos_dias_antes) x), 0);

  -- 1. activaciones manuales de SuperAdmin con vigencia terminada
  for r in select id from public.adicional_lote where origen = 'MANUAL_SUPERADMIN' and estado in ('ACTIVO', 'PROXIMO_A_RENOVAR') and vigente_hasta <= p_ahora order by id loop
    perform public._adicional_transicionar(r.id, 'CANCELADO', 'ACTIVACION_MANUAL_VENCIDA', 'SISTEMA', null, 'Vigencia de la activación manual terminada');
    n_manual := n_manual + 1;
  end loop;

  -- 2a. periodo vencido → gracia (o suspensión directa si la gracia ya terminó o es de 0 días)
  for r in select id from public.adicional_lote where origen = 'CHECKOUT_PRO' and estado in ('ACTIVO', 'PROXIMO_A_RENOVAR') and vigente_hasta <= p_ahora order by id loop
    perform public._adicional_transicionar(r.id, 'EN_GRACIA', 'PERIODO_VENCIDO', 'SISTEMA', null, null);
    update public.adicional_lote set gracia_fin = vigente_hasta + make_interval(days => c.gracia_dias) where id = r.id;
    if (select gracia_fin from public.adicional_lote where id = r.id) <= p_ahora then
      perform public._adicional_transicionar(r.id, 'SUSPENDIDO', 'GRACIA_TERMINADA', 'SISTEMA', null, null);
      perform public._adicional_notificar(r.id, 'ADICIONAL_SUSPENDIDO', 'suspendido:' || (select periodo_n from public.adicional_lote where id = r.id));
      n_susp := n_susp + 1;
    else
      perform public._adicional_notificar(r.id, 'ADICIONAL_EN_GRACIA', 'gracia:' || (select periodo_n from public.adicional_lote where id = r.id));
      n_gracia := n_gracia + 1;
    end if;
  end loop;

  -- 2b. gracia terminada → SUSPENDIDO (se suspende el cupo; no se elimina profesional, cita, historial, evidencia ni dato alguno)
  for r in select id from public.adicional_lote where estado = 'EN_GRACIA' and gracia_fin <= p_ahora order by id loop
    perform public._adicional_transicionar(r.id, 'SUSPENDIDO', 'GRACIA_TERMINADA', 'SISTEMA', null, null);
    perform public._adicional_notificar(r.id, 'ADICIONAL_SUSPENDIDO', 'suspendido:' || (select periodo_n from public.adicional_lote where id = r.id));
    n_susp := n_susp + 1;
  end loop;

  -- 3. entra a la ventana de renovación
  for r in select id from public.adicional_lote
            where origen = 'CHECKOUT_PRO' and estado = 'ACTIVO' and not cancelar_renovacion and vigente_hasta > p_ahora
              and (((vigente_hasta at time zone c.zona_horaria)::date) - v_hoy) <= v_max order by id loop
    perform public._adicional_transicionar(r.id, 'PROXIMO_A_RENOVAR', 'VENTANA_RENOVACION', 'SISTEMA', null, null);
    n_prox := n_prox + 1;
  end loop;

  -- 4. avisos (umbral más cercano ≥ días restantes, una sola vez por umbral y periodo)
  for r in select id, vigente_hasta, ultimo_aviso_dias, periodo_n from public.adicional_lote
            where origen = 'CHECKOUT_PRO' and estado in ('ACTIVO', 'PROXIMO_A_RENOVAR') and not cancelar_renovacion and vigente_hasta > p_ahora order by id loop
    v_dias := ((r.vigente_hasta at time zone c.zona_horaria)::date) - v_hoy;
    select min(x) into v_t from unnest(c.avisos_dias_antes) x where x >= v_dias;
    if v_t is not null and (r.ultimo_aviso_dias is null or v_t < r.ultimo_aviso_dias) then
      update public.adicional_lote set ultimo_aviso_dias = v_t where id = r.id;
      perform public._adicional_notificar(r.id, 'ADICIONAL_POR_VENCER', 'aviso:' || v_t || ':' || r.periodo_n, jsonb_build_object('dias', v_dias::text));
      perform public._adicional_historial(r.id, 'AVISO_VENCIMIENTO', 'SISTEMA', null, null, null, null, jsonb_build_object('umbral', v_t, 'dias', v_dias));
      n_aviso := n_aviso + 1;
    end if;
  end loop;

  -- 5. checkouts abandonados
  for r in select id from public.adicional_lote
            where periodo_n = 0 and origen = 'CHECKOUT_PRO'
              and ((estado in ('PENDIENTE_CONTRATACION', 'CHECKOUT_INICIADO') and created_at <= p_ahora - make_interval(hours => c.checkout_expira_horas))
                   or (estado = 'PAGO_PENDIENTE' and created_at <= p_ahora - make_interval(days => c.pago_pendiente_expira_dias))) order by id loop
    perform public._adicional_cerrar_checkout(r.id, 'SISTEMA', null, 'CHECKOUT_ABANDONADO');
    n_abandon := n_abandon + 1;
  end loop;

  v_res := jsonb_build_object('fecha', v_hoy, 'manuales_vencidos', n_manual, 'en_gracia', n_gracia, 'suspendidos', n_susp,
                              'proximos_a_renovar', n_prox, 'avisos', n_aviso, 'checkouts_abandonados', n_abandon);
  insert into public.adicional_mantenimiento_corrida (fecha, resultado) values (v_hoy, v_res)
  on conflict (fecha) do update set resultado = excluded.resultado, ejecutado_at = now();
  perform public._auditar('adicional_mantenimiento', null, 'ADICIONAL_MANTENIMIENTO', null, null, v_res, null);
  return v_res;
end $$;
revoke all on function public.adicional_mantenimiento_srv(timestamptz, boolean) from public, anon, authenticated;
grant execute on function public.adicional_mantenimiento_srv(timestamptz, boolean) to service_role;

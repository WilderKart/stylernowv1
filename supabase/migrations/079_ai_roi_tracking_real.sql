-- StylerNow — Migración 079: ADR-014, Fase C — Tracking real del ROI de
-- IA. Cierra el hallazgo honesto del Módulo 6.6: "no existe ningún
-- mecanismo de trazabilidad que vincule una sugerencia/acción de IA con
-- un resultado de negocio posterior" — este mecanismo ahora existe.
--
-- Alcance honesto (Regla de Oro: nunca fabricar datos ni "botones
-- muertos"): de los eventos pedidos por el fundador (campaña creada,
-- campaña enviada, apertura, clic, reserva, venta, retorno cliente,
-- tiempo ahorrado), solo "reserva"/"venta" tienen HOY una fuente real de
-- datos. "Campaña enviada/apertura/clic" requerirían un motor de entrega
-- multicanal (email/WhatsApp) que no existe en el proyecto — construirlo
-- acá sería inventar infraestructura de campañas completa disfrazada de
-- "agregar tablas de tracking" (ver docs/TECH_DEBT_REGISTER.md). "Tiempo
-- ahorrado" no tiene ninguna línea base real con la que compararse — se
-- deja la columna nullable, documentada como pendiente de una
-- metodología de estimación definida por el fundador, nunca inventada.
--
-- El único punto de "IA → resultado de negocio" real y medible hoy es el
-- Motor de recompensas de Lealtad: una `recompensa_sugerencia` con costo
-- (Nivel 1/2, redactada por IA) que la Barbería confirma, y el mismo
-- Cliente hace una Reserva real después. Eso es exactamente lo que
-- `ai_conversion` mide — atribución real, con ventana explícita, nunca
-- una estimación inventada.

-- ── ai_interaction: VISTA sobre credito_ia_consumo, no una tabla nueva
-- (evita duplicar datos que ya existen desde el Módulo 6.6) ────────────
create view public.ai_interaction as
select
  cic.id, cic.negocio_id, cic.funcion as accion, aac.categoria, cic.nivel,
  cic.creditos_consumidos, cic.saldo_restante, cic.created_at
from public.credito_ia_consumo cic
left join public.ai_accion_costo aac on aac.accion = cic.funcion;

-- ── ai_conversion: atribución real, con ventana explícita ───────────────
create table public.ai_conversion (
  id uuid primary key default gen_random_uuid(),
  negocio_id uuid not null references public.negocio(id),
  recompensa_sugerencia_id uuid not null references public.recompensa_sugerencia(id),
  cliente_id uuid not null references public.perfil(id),
  reserva_id uuid not null references public.reserva(id),
  monto_atribuido numeric(12,2) not null,
  dias_desde_sugerencia int not null,
  created_at timestamptz not null default now(),
  unique (recompensa_sugerencia_id, reserva_id)
);
create index ai_conversion_negocio_idx on public.ai_conversion(negocio_id);

alter table public.ai_conversion enable row level security;
create policy ai_conversion_select on public.ai_conversion for select
  using (public.tiene_acceso_interno(negocio_id) or public.is_supersu());

-- ── ai_roi_snapshot: agregado periódico real, para que el dashboard lea
-- rápido sin recalcular joins en cada visita ────────────────────────────
create table public.ai_roi_snapshot (
  id uuid primary key default gen_random_uuid(),
  negocio_id uuid not null references public.negocio(id),
  periodo_inicio date not null,
  periodo_fin date not null,
  creditos_consumidos int not null default 0,
  costo_proveedor_usd numeric(12,4) not null default 0,
  interacciones_total int not null default 0,
  conversiones_total int not null default 0,
  monto_atribuido_total numeric(12,2) not null default 0,
  -- Nullable a propósito: no hay todavía una metodología de estimación de
  -- tiempo ahorrado definida por el fundador — nunca se inventa un
  -- número acá, se deja explícitamente vacío hasta que exista una regla.
  tiempo_ahorrado_minutos_estimado numeric(12,2),
  created_at timestamptz not null default now(),
  unique (negocio_id, periodo_inicio, periodo_fin)
);
alter table public.ai_roi_snapshot enable row level security;
create policy ai_roi_snapshot_select on public.ai_roi_snapshot for select
  using (public.tiene_acceso_interno(negocio_id) or public.is_supersu());

-- ── Handler del Pipeline de Eventos GLOBAL (ADR-014, Fase F) —
-- atribución en tiempo real, sin tocar completar_venta_pos() de nuevo:
-- exactamente el caso de uso para el que se construyó el bus genérico.
-- Ventana de atribución: 30 días desde que la Barbería confirmó la
-- sugerencia — documentado explícitamente, no oculto en el código.
create or replace function public._pipeline_ai_atribuir_conversion(p_evento jsonb)
returns void
language plpgsql security definer set search_path = public as $fn$
declare
  v_reserva_id uuid := (p_evento->>'reserva_id')::uuid;
  v_negocio_id uuid := (p_evento->>'negocio_id')::uuid;
  v_cliente_id uuid := (p_evento->>'cliente_id')::uuid;
  v_monto numeric := (p_evento->>'saldo_cobrado')::numeric + (p_evento->>'descuento_membresia')::numeric + (p_evento->>'descuento_puntos')::numeric;
  v_sugerencia record;
begin
  for v_sugerencia in
    select * from public.recompensa_sugerencia
    where negocio_id = v_negocio_id and cliente_id = v_cliente_id and estado = 'CONFIRMADA'
      and costo_credito_ia > 0 and resuelta_at >= now() - interval '30 days'
      and not exists (select 1 from public.ai_conversion where recompensa_sugerencia_id = recompensa_sugerencia.id)
  loop
    insert into public.ai_conversion (negocio_id, recompensa_sugerencia_id, cliente_id, reserva_id, monto_atribuido, dias_desde_sugerencia)
    values (v_negocio_id, v_sugerencia.id, v_cliente_id, v_reserva_id, v_monto, extract(day from now() - v_sugerencia.resuelta_at)::int);
  end loop;
end;
$fn$;

insert into public.evento_pipeline_handler (evento, nombre, descripcion, funcion_sql, orden) values
  ('venta_completada', 'ai_atribuir_conversion', 'Atribuye la venta a una sugerencia de IA confirmada en los últimos 30 días (ROI real de IA)', '_pipeline_ai_atribuir_conversion', 80);

-- ── Agregado periódico (cron mensual, idempotente por período) ─────────
create or replace function public.generar_roi_snapshot_mensual()
returns jsonb
language plpgsql security definer set search_path = public as $fn$
declare
  v_periodo_inicio date := date_trunc('month', now() - interval '1 month')::date;
  v_periodo_fin date := (date_trunc('month', now()) - interval '1 day')::date;
  v_row record;
  v_generados int := 0;
begin
  for v_row in
    select
      n.id as negocio_id,
      coalesce(sum(cic.creditos_consumidos), 0)::int as creditos_consumidos,
      coalesce(sum(aac.costo_proveedor_estimado), 0) as costo_proveedor_usd,
      count(cic.id) as interacciones_total
    from public.negocio n
    left join public.credito_ia_consumo cic on cic.negocio_id = n.id
      and cic.created_at >= v_periodo_inicio and cic.created_at < v_periodo_fin + interval '1 day'
    left join public.ai_accion_costo aac on aac.accion = cic.funcion
    where n.estado = 'ACTIVO'
    group by n.id
    having count(cic.id) > 0
  loop
    insert into public.ai_roi_snapshot (negocio_id, periodo_inicio, periodo_fin, creditos_consumidos, costo_proveedor_usd, interacciones_total, conversiones_total, monto_atribuido_total)
    select
      v_row.negocio_id, v_periodo_inicio, v_periodo_fin, v_row.creditos_consumidos, v_row.costo_proveedor_usd, v_row.interacciones_total,
      count(ac.id), coalesce(sum(ac.monto_atribuido), 0)
    from public.ai_conversion ac
    where ac.negocio_id = v_row.negocio_id and ac.created_at >= v_periodo_inicio and ac.created_at < v_periodo_fin + interval '1 day'
    on conflict (negocio_id, periodo_inicio, periodo_fin) do update
    set creditos_consumidos = excluded.creditos_consumidos, costo_proveedor_usd = excluded.costo_proveedor_usd,
        interacciones_total = excluded.interacciones_total, conversiones_total = excluded.conversiones_total,
        monto_atribuido_total = excluded.monto_atribuido_total;
    v_generados := v_generados + 1;
  end loop;
  return jsonb_build_object('negociosConSnapshot', v_generados, 'periodoInicio', v_periodo_inicio, 'periodoFin', v_periodo_fin);
end;
$fn$;
revoke all on function public.generar_roi_snapshot_mensual() from public, anon, authenticated;

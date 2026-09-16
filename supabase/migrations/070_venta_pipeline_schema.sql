-- StylerNow — Migración 070: Pipeline de Eventos de Venta (pedido directo
-- del fundador, 2026-09-16, tras la 5ª extensión de `completar_venta_pos()`).
--
-- Problema que resuelve: cada nuevo sistema del producto (Lealtad, IA,
-- Inventario, Comisiones...) había estado agregando su lógica como un
-- bloque más dentro de `completar_venta_pos()` — 5 extensiones ya
-- aplicadas, cada vez arriesgando la función más crítica y compartida
-- de todo el proyecto. Esta migración introduce un registro de handlers
-- configurable (mismo patrón ya usado en `ai_modelo_config`/
-- `ai_accion_costo`: una tabla editable por SuperSU en vez de un `if`
-- más hardcodeado en PL/pgSQL) y un orquestador que los ejecuta con
-- aislamiento real de fallos.
--
-- Aislamiento de fallos: un bloque `begin ... exception when others ...
-- end;` en PL/pgSQL crea un savepoint implícito — si un handler falla,
-- SOLO se deshace lo que ese handler alcanzó a hacer, nunca el resto del
-- pipeline ni el cobro ya confirmado en la fase crítica. Esto es
-- DISTINTO del hallazgo de ADL-024 (un INSERT justo antes de un `RAISE
-- EXCEPTION` que se propaga sin capturar SÍ aborta todo) — acá el error
-- se captura localmente antes de propagarse, así que el INSERT de
-- auditoría del fallo persiste con normalidad. Ver ADL-027.
--
-- Qué NO entra en este pipeline, a propósito: (a) Pago, Membresía, canje
-- de Puntos e Inventario de la venta siguen inline en
-- `completar_venta_pos()` — determinan el MONTO cobrado, así que un
-- fallo ahí debe abortar toda la venta, no aislarse; (b) Wallet
-- (comisión de plataforma) se acredita en `aplicar_evento_pago()`, un
-- evento distinto (pago vía pasarela de una Reserva, no cierre de venta
-- en POS) — no pertenece a este pipeline; (c) Reportes/IA no tienen
-- todavía ningún consumidor real por-venta (Reportes ya lee las tablas
-- vivas directamente; el Reward Engine de IA se dispara desde
-- `/panel/lealtad`, no por venta) — agregar un handler vacío sería un
-- "botón muerto" (Regla de Oro); se agregan el día que exista un
-- consumidor real, con una sola fila nueva en esta tabla.

create table public.venta_pipeline_handler (
  id uuid primary key default gen_random_uuid(),
  nombre text not null unique, -- ej. 'sellos', 'cashback', 'vip_ascenso'
  descripcion text not null,
  funcion_sql text not null, -- nombre de la función public.<funcion_sql>(jsonb) returns void
  orden int not null,
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.venta_pipeline_handler enable row level security;
create policy venta_pipeline_handler_select on public.venta_pipeline_handler for select using (public.is_supersu());

-- Orquestador: ejecuta cada handler activo, en orden, aislado. Recibe
-- el evento `venta_completada` ya armado por `completar_venta_pos()`
-- (reserva_id, negocio_id, sede_id, cliente_id, staff_id, montos,
-- descuentos, flags) como un único jsonb — cada handler toma de ahí
-- solo lo que necesita.
create or replace function public.ejecutar_pipeline_venta_completada(p_evento jsonb)
returns jsonb
language plpgsql security definer set search_path = public as $fn$
declare
  v_handler record;
  v_resultados jsonb := '[]'::jsonb;
begin
  for v_handler in
    select * from public.venta_pipeline_handler where activo = true order by orden asc
  loop
    begin
      execute format('select public.%I($1)', v_handler.funcion_sql) using p_evento;
      v_resultados := v_resultados || jsonb_build_object('handler', v_handler.nombre, 'ok', true);
    exception when others then
      v_resultados := v_resultados || jsonb_build_object('handler', v_handler.nombre, 'ok', false, 'error', sqlerrm);
      insert into public.evento_auditoria (entidad_tipo, entidad_id, accion, actor_tipo, actor_id, negocio_id, payload_despues)
      values (
        'venta_pipeline', (p_evento->>'reserva_id')::uuid, 'PIPELINE_HANDLER_FALLO', 'SISTEMA', auth.uid(),
        (p_evento->>'negocio_id')::uuid,
        jsonb_build_object('handler', v_handler.nombre, 'error', sqlerrm, 'reserva_id', p_evento->>'reserva_id')
      );
    end;
  end loop;
  return v_resultados;
end;
$fn$;
revoke all on function public.ejecutar_pipeline_venta_completada(jsonb) from public, anon, authenticated;

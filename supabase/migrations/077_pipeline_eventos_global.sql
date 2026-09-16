-- StylerNow — Migración 077: ADR-014, Fase F (obligatoria) — el Pipeline
-- de Eventos deja de estar acoplado únicamente al POS y se convierte en
-- el bus oficial de eventos de StylerNow.
--
-- `venta_pipeline_handler` (migración 070) ya probó el patrón para
-- `venta_completada` con 7 handlers reales + aislamiento de fallos real
-- (ADL-027). Esta migración generaliza esa misma tabla/orquestador para
-- soportar CUALQUIER tipo de evento, sin duplicar la infraestructura:
--   1. Se agrega la columna `evento` (con un catálogo cerrado vía CHECK,
--      no una tabla nueva — el catálogo completo de eventos oficiales
--      vive en un solo lugar, visible y editable solo por migración).
--   2. El orquestador pasa de `ejecutar_pipeline_venta_completada(jsonb)`
--      a `ejecutar_pipeline_evento(p_evento_tipo text, p_payload jsonb)`
--      — filtra por tipo de evento, mismo aislamiento de fallos.
--   3. `completar_venta_pos()` llama al orquestador genérico en vez del
--      nombre específico de venta — nunca vuelve a tocarse para agregar
--      un módulo futuro: un módulo nuevo SOLO registra una fila en
--      `evento_pipeline_handler` con el evento y la función que le
--      corresponde.
--
-- Honestidad deliberada sobre el resto de la tabla de eventos del pedido
-- del fundador (`reserva_confirmada`, `cliente_registrado`,
-- `plan_actualizado`, `staff_trasladado`): se reconocen como eventos
-- OFICIALES del catálogo (agregarles un handler más adelante es una fila,
-- no una migración de esquema), pero NO se les fabrica ningún handler
-- todavía porque hoy no existe ningún consumidor real:
--   - `reserva_confirmada`: hoy solo actualiza `reserva.estado` y audita,
--     inline en `aplicar_evento_pago()` — WhatsApp está diferido
--     (`docs/PENDING_DECISIONS.md`), Agenda ya lee la tabla en vivo, y no
--     hay ningún disparador real de IA en este punto todavía.
--   - `cliente_registrado`: no hay ningún efecto de Lealtad/Referidos al
--     registrarse — por diseño, la recompensa de Referido se otorga
--     recién en la primera Reserva COMPLETADA pagada (Módulo 4 de
--     ADR-011), nunca en el registro.
--   - `plan_actualizado`: `AI_Credit_System.md` ya define explícitamente
--     que un upgrade/downgrade NO recalcula créditos IA de inmediato,
--     solo desde el siguiente ciclo — conectar un handler reactivo acá
--     contradiría esa regla de negocio ya aprobada, no es un olvido.
--   - `staff_trasladado`: no existe todavía ninguna función de
--     "trasladar Staff entre Sedes" en el producto — no hay ningún
--     evento real que emitir. Se reconoce el nombre en el catálogo para
--     cuando esa función se construya.

alter table public.venta_pipeline_handler rename to evento_pipeline_handler;

alter table public.evento_pipeline_handler add column evento text not null default 'venta_completada';
alter table public.evento_pipeline_handler alter column evento drop default;
alter table public.evento_pipeline_handler add constraint evento_pipeline_handler_evento_check
  check (evento in ('venta_completada', 'reserva_confirmada', 'cliente_registrado', 'plan_actualizado', 'staff_trasladado'));

alter table public.evento_pipeline_handler drop constraint if exists venta_pipeline_handler_nombre_key;
alter table public.evento_pipeline_handler add constraint evento_pipeline_handler_evento_nombre_key unique (evento, nombre);

-- Orquestador genérico — mismo aislamiento de fallos que
-- ejecutar_pipeline_venta_completada() (ADL-027): un handler roto nunca
-- deshace la fase crítica que ya confirmó el evento, ni bloquea a los
-- demás handlers del mismo evento.
create or replace function public.ejecutar_pipeline_evento(p_evento_tipo text, p_payload jsonb)
returns jsonb
language plpgsql security definer set search_path = public as $fn$
declare
  v_handler record;
  v_resultados jsonb := '[]'::jsonb;
begin
  for v_handler in
    select * from public.evento_pipeline_handler where evento = p_evento_tipo and activo = true order by orden asc
  loop
    begin
      execute format('select public.%I($1)', v_handler.funcion_sql) using p_payload;
      v_resultados := v_resultados || jsonb_build_object('handler', v_handler.nombre, 'ok', true);
    exception when others then
      v_resultados := v_resultados || jsonb_build_object('handler', v_handler.nombre, 'ok', false, 'error', sqlerrm);
      insert into public.evento_auditoria (entidad_tipo, entidad_id, accion, actor_tipo, actor_id, negocio_id, payload_despues)
      values (
        'evento_pipeline', nullif(p_payload->>'reserva_id', '')::uuid, 'PIPELINE_HANDLER_FALLO', 'SISTEMA', auth.uid(),
        nullif(p_payload->>'negocio_id', '')::uuid,
        jsonb_build_object('evento', p_evento_tipo, 'handler', v_handler.nombre, 'error', sqlerrm)
      );
    end;
  end loop;
  return v_resultados;
end;
$fn$;
revoke all on function public.ejecutar_pipeline_evento(text, jsonb) from public, anon, authenticated;

drop function if exists public.ejecutar_pipeline_venta_completada(jsonb);

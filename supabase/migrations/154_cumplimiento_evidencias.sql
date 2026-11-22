-- 154 · Centro de Cumplimiento y PQRS — Grupo F: los eventos de un caso se copian al repositorio de evidencias legales
--       (147: append-only, hash SHA-256 encadenado). No se crea otra infraestructura de evidencias.
--
-- Ajustes MÍNIMOS y aditivos al repositorio:
--   · `usuario_id` admite NULL (un solicitante sin cuenta no tiene usuario; el rol se registra como EXTERNO).
--   · categoría nueva CASO_CUMPLIMIENTO, rol nuevo EXTERNO, acción nueva REGISTRA.
--   Los hashes ya calculados no cambian (el hash se calcula sobre el contenido; NULL se serializa igual que antes).
-- Privacidad: la evidencia NO guarda el contenido de la solicitud ni los datos del solicitante; guarda qué ocurrió, cuándo, quién actuó
-- y el número de radicación. Solo el texto de una RESPUESTA SUSTANTIVA (lo que StylerNow contestó) se guarda para poder demostrarlo.
-- Reversión (solo local): drop trigger trg_caso_evidencia on caso_historial; restaurar los CHECK originales de 147.

alter table public.evidencia_legal alter column usuario_id drop not null;
alter table public.evidencia_legal drop constraint if exists evidencia_legal_rol_check;
alter table public.evidencia_legal add constraint evidencia_legal_rol_check
  check (rol in ('CLIENTE', 'BARBERIA', 'STAFF', 'GUARDIAN', 'SUPERSU', 'SISTEMA', 'EXTERNO'));
alter table public.evidencia_legal drop constraint if exists evidencia_legal_categoria_check;
alter table public.evidencia_legal add constraint evidencia_legal_categoria_check
  check (categoria in ('CONTRACTUAL', 'TRATAMIENTO_DATOS', 'CONSENTIMIENTO_ESPECIFICO', 'PREFERENCIA_PRIVACIDAD', 'DERECHOS_TITULAR', 'CASO_CUMPLIMIENTO'));
alter table public.evidencia_legal drop constraint if exists evidencia_legal_accion_check;
alter table public.evidencia_legal add constraint evidencia_legal_accion_check
  check (accion in ('ACEPTA', 'ACEPTA_TACITA', 'RECHAZA', 'REVOCA', 'MODIFICA', 'SOLICITA', 'REGISTRA'));

create or replace function public.trg_caso_evidencia() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  t public.ticket_soporte; v_finalidad text; v_accion text := 'REGISTRA'; v_texto text;
begin
  if new.tipo_evento not in ('RADICADO', 'RESPUESTA_SUSTANTIVA', 'RESUELTO', 'CERRADO', 'PRORROGA', 'SUBSANACION_SOLICITADA',
                             'SUBSANACION_RECIBIDA', 'TRASLADO', 'DESISTIMIENTO', 'REABIERTO', 'ENVIO', 'ADJUNTO', 'RECLAMO_EN_TRAMITE') then
    return null;
  end if;
  select * into t from public.ticket_soporte where id = new.ticket_id;
  v_finalidad := case new.tipo_evento
    when 'RADICADO' then 'Radicación de la solicitud ' || t.numero_radicacion || ' (' || t.tipo_codigo || ') por el canal ' || t.canal
    when 'RESPUESTA_SUSTANTIVA' then 'Respuesta de fondo enviada al solicitante del caso ' || t.numero_radicacion
    when 'RESUELTO' then 'Caso ' || t.numero_radicacion || ' resuelto'
    when 'CERRADO' then 'Caso ' || t.numero_radicacion || ' cerrado'
    when 'PRORROGA' then 'Ampliación del plazo del caso ' || t.numero_radicacion
    when 'SUBSANACION_SOLICITADA' then 'Requerimiento de información al solicitante del caso ' || t.numero_radicacion
    when 'SUBSANACION_RECIBIDA' then 'Información recibida del solicitante del caso ' || t.numero_radicacion
    when 'TRASLADO' then 'Traslado por competencia del caso ' || t.numero_radicacion
    when 'DESISTIMIENTO' then 'Desistimiento por falta de respuesta del solicitante, caso ' || t.numero_radicacion
    when 'REABIERTO' then 'Caso ' || t.numero_radicacion || ' reabierto'
    when 'ENVIO' then 'Comunicación enviada al solicitante del caso ' || t.numero_radicacion || ' (estado ' || coalesce(new.detalle ->> 'estado', '?') || ', id del proveedor ' || coalesce(new.detalle ->> 'id_externo', 'ninguno') || ')'
    when 'ADJUNTO' then 'Documento adjunto al caso ' || t.numero_radicacion
    else 'Reclamo en trámite, caso ' || t.numero_radicacion end;
  if new.tipo_evento = 'RADICADO' then v_accion := 'SOLICITA'; end if;
  if new.tipo_evento = 'RESPUESTA_SUSTANTIVA' then
    select m.mensaje into v_texto from public.ticket_mensaje m where m.ticket_id = new.ticket_id and m.sustantiva order by m.created_at desc limit 1;
  end if;
  perform public._registrar_evidencia(
    t.creado_por, null, null, 'CASO_CUMPLIMIENTO', 'CASO:' || t.numero_radicacion, v_finalidad, v_accion, v_texto,
    null, null, t.canal, 'caso', t.id, null, 'caso_historial', new.id::text, new.created_at, false,
    case when t.creado_por is null then 'EXTERNO' when new.actor_tipo = 'SISTEMA' then 'SISTEMA' when new.actor_tipo = 'SUPERSU' then 'SUPERSU'
         else public._rol_de_usuario(t.creado_por, null) end);
  return null;
end $$;
revoke all on function public.trg_caso_evidencia() from public, anon, authenticated;
drop trigger if exists trg_caso_evidencia on public.caso_historial;
create trigger trg_caso_evidencia after insert on public.caso_historial for each row execute function public.trg_caso_evidencia();

-- Evidencias de un caso (SuperSU): usa la misma tabla; la lectura queda auditada por las funciones de 149 si se desea expediente.
create or replace function public.caso_evidencias(p_ticket uuid)
returns table (secuencia bigint, ocurrido_at timestamptz, finalidad text, accion text, rol text, hash text, hash_anterior text, tiene_texto boolean)
language plpgsql stable security definer set search_path = public as $$
begin
  perform public._caso_exigir_supersu();
  return query select e.secuencia, e.ocurrido_at, e.finalidad, e.accion, e.rol, e.hash, e.hash_anterior, e.texto is not null
    from public.evidencia_legal e where e.referencia_tipo = 'caso' and e.referencia_id = p_ticket order by e.secuencia;
end $$;
revoke all on function public.caso_evidencias(uuid) from public, anon, authenticated;
grant execute on function public.caso_evidencias(uuid) to authenticated;

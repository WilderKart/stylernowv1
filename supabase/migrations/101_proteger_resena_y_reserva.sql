-- 101 — P0 de seguridad: un cliente ya no puede reescribir su reseña ni su reserva a su gusto.
--
-- Hallazgos (RLS permisiva):
--   · resena_update_cliente_48h dejaba al autor editar CUALQUIER columna (estado, staff, negocio…).
--   · resena_update_respuesta_negocio dejaba al negocio editar cualquier columna (calificación, estado…).
--   · reserva_update_cliente / _staff / _interno permitían UPDATE de cualquier columna (monto_total, estado…).
--   · reserva_insert_cliente permitía INSERTAR una reserva directa con monto 0 y estado CONFIRMADA, saltándose
--     el motor (crear_reserva).
-- La app no usa nada de eso: solo hace UN update directo (el negocio escribe respuesta_negocio) y el resto va por
-- funciones SECURITY DEFINER o service_role. Por eso se bloquea en un disparador que solo actúa sobre llamadas
-- directas del navegador (rol authenticated/anon) y deja pasar a las funciones del sistema y a service_role.
-- Aditiva: no cambia políticas ni datos; es reversible con DROP TRIGGER.

create function public.trg_resena_proteger_columnas() returns trigger
language plpgsql set search_path = public as $$
begin
  -- Funciones del sistema (security definer → rol dueño) y service_role: confiables.
  if current_user not in ('authenticated', 'anon') then return new; end if;
  if public.is_supersu() then return new; end if;

  if new.id is distinct from old.id or new.reserva_id is distinct from old.reserva_id
     or new.cliente_id is distinct from old.cliente_id or new.negocio_id is distinct from old.negocio_id
     or new.staff_id is distinct from old.staff_id or new.estado is distinct from old.estado
     or new.moderado_por is distinct from old.moderado_por or new.moderado_motivo is distinct from old.moderado_motivo
     or new.created_at is distinct from old.created_at then
    raise exception 'RESENA_COLUMNA_PROTEGIDA';
  end if;

  if new.calificacion is distinct from old.calificacion or new.comentario is distinct from old.comentario then
    -- Solo el autor, dentro de las 48 h, y con una calificación válida.
    if old.cliente_id is distinct from auth.uid() or old.created_at <= now() - interval '48 hours' then
      raise exception 'RESENA_SOLO_EL_AUTOR_EDITA';
    end if;
    if new.calificacion is null or new.calificacion < 1 or new.calificacion > 5 then
      raise exception 'CALIFICACION_INVALIDA';
    end if;
  end if;

  if new.respuesta_negocio is distinct from old.respuesta_negocio then
    if not public.tiene_acceso_interno(old.negocio_id) then
      raise exception 'RESENA_SOLO_EL_NEGOCIO_RESPONDE';
    end if;
  end if;
  return new;
end $$;

create trigger trg_resena_proteger_columnas before update on public.resena
  for each row execute function public.trg_resena_proteger_columnas();

create function public.trg_reserva_proteger_directo() returns trigger
language plpgsql set search_path = public as $$
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
     or new.idempotency_key is distinct from old.idempotency_key or new.created_at is distinct from old.created_at then
    raise exception 'RESERVA_EDICION_DIRECTA_NO_PERMITIDA';
  end if;
  return new;
end $$;

create trigger trg_reserva_proteger_directo before insert or update on public.reserva
  for each row execute function public.trg_reserva_proteger_directo();

revoke all on function public.trg_resena_proteger_columnas() from public, anon, authenticated;
revoke all on function public.trg_reserva_proteger_directo() from public, anon, authenticated;
grant execute on function public.trg_resena_proteger_columnas() to service_role;
grant execute on function public.trg_reserva_proteger_directo() to service_role;

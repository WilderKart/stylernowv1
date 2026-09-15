-- StylerNow — Migración 031: corrige dos bugs reales de la migración 030
--
-- Bug 1: `create or replace function reportes_ranking_staff(...)` con un
-- parámetro nuevo (`p_vinculo_id`) NO reemplaza la versión de 4 parámetros
-- de la migración 023 — Postgres trata una lista de parámetros distinta
-- como una función SOBRECARGADA nueva, dejando ambas versiones coexistiendo.
-- Cualquier llamada ambigua entre las dos (incluida la de
-- `dashboard_ranking_staff_semana()`, que llama con 4 posicionales) rompe
-- con "Could not choose the best candidate function". Se corrige eliminando
-- explícitamente la sobrecarga vieja de 4 parámetros.
drop function if exists public.reportes_ranking_staff(uuid, uuid, timestamptz, timestamptz);

-- Bug 2: `finalizar_atencion_reserva()` (check-out) solo validaba que la
-- Reserva siguiera en EN_CURSO — como el check-out nunca cambia el estado
-- (a propósito, Caja completa después), un segundo check-out pasaba la
-- validación y pisaba `checkout_at` en silencio. Se agrega el chequeo de
-- que todavía no se haya hecho check-out.
create or replace function public.finalizar_atencion_reserva(p_reserva_id uuid)
returns public.reserva
language plpgsql security definer set search_path = public as $fn$
declare
  v_reserva public.reserva;
begin
  select * into v_reserva from public.reserva where id = p_reserva_id for update;
  if not found then raise exception 'RESERVA_NO_ENCONTRADA'; end if;
  if v_reserva.staff_id <> auth.uid() then raise exception 'NO_AUTORIZADO'; end if;
  if v_reserva.estado <> 'EN_CURSO' then raise exception 'RESERVA_NO_FINALIZABLE'; end if;
  if v_reserva.checkout_at is not null then raise exception 'RESERVA_NO_FINALIZABLE'; end if;

  update public.reserva set checkout_at = now(), updated_at = now()
  where id = p_reserva_id
  returning * into v_reserva;

  insert into public.evento_auditoria (entidad_tipo, entidad_id, accion, actor_tipo, actor_id, negocio_id)
  values ('reserva', p_reserva_id, 'CHECKOUT_STAFF', 'STAFF', auth.uid(), v_reserva.negocio_id);

  return v_reserva;
end;
$fn$;

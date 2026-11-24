-- 190 · (P1-8) Aprobación de verificación atómica y (P1-5) lista de espera sin duplicados.
--
-- 1) Antes: admin_decidir_verificacion() y luego aprobar_negocio() eran dos llamadas separadas; si fallaba la segunda quedaba
--    verificación VERIFICADA con el negocio aún PENDIENTE_APROBACION, y VERIFICADA→VERIFICADA no es una transición válida.
--    Ahora una sola función hace ambas en la MISMA transacción y además es idempotente para recuperar ese estado mixto:
--    si la verificación ya está VERIFICADA y el negocio sigue pendiente, solo da de alta el negocio.
-- 2) lista_espera no tenía clave única: doble clic o reintento creaba varias entradas ACTIVA idénticas (FIFO corrupto, avisos
--    duplicados). Se cancelan los duplicados existentes (se conserva la más antigua) y se agrega un índice único parcial.

create or replace function public.admin_aprobar_verificacion_y_negocio(p_negocio_id uuid, p_motivo text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_ver public.verificacion_estado;
  v_neg_estado text;
  v_motivo text := coalesce(nullif(btrim(p_motivo), ''), 'Documentos revisados y aprobados por el equipo de StylerNow.');
  v_aprobo_negocio boolean := false;
begin
  if not coalesce(public.is_supersu(), false) then raise exception 'NO_AUTORIZADO'; end if;
  select estado into v_ver from public.negocio_verificacion where negocio_id = p_negocio_id for update;
  if v_ver is null then raise exception 'TRANSICION_NO_PERMITIDA'; end if;
  select estado::text into v_neg_estado from public.negocio where id = p_negocio_id for update;
  if v_neg_estado is null then raise exception 'NEGOCIO_NO_ENCONTRADO'; end if;

  if v_ver = 'EN_REVISION' then
    perform public.admin_decidir_verificacion(p_negocio_id, 'VERIFICADA', v_motivo);
  elsif not (v_ver = 'VERIFICADA' and v_neg_estado = 'PENDIENTE_APROBACION') then
    raise exception 'TRANSICION_NO_PERMITIDA';
  end if;

  if v_neg_estado = 'PENDIENTE_APROBACION' then
    perform public.aprobar_negocio(p_negocio_id);
    v_aprobo_negocio := true;
  end if;
  return jsonb_build_object('verificacion', 'VERIFICADA', 'negocio_aprobado', v_aprobo_negocio);
end $$;
revoke all on function public.admin_aprobar_verificacion_y_negocio(uuid, text) from public, anon, authenticated;
grant execute on function public.admin_aprobar_verificacion_y_negocio(uuid, text) to authenticated;

-- Duplicados vigentes: se conserva la entrada más antigua (respeta el FIFO) y el resto pasa a CANCELADA.
update public.lista_espera le set estado = 'CANCELADA'
where le.estado = 'ACTIVA'
  and exists (
    select 1 from public.lista_espera o
    where o.estado = 'ACTIVA' and o.id <> le.id
      and o.cliente_id = le.cliente_id and o.sede_id = le.sede_id
      and o.fecha_deseada_inicio = le.fecha_deseada_inicio and o.fecha_deseada_fin = le.fecha_deseada_fin
      and o.servicio_ids = le.servicio_ids
      and coalesce(o.staff_id, '00000000-0000-0000-0000-000000000000'::uuid) = coalesce(le.staff_id, '00000000-0000-0000-0000-000000000000'::uuid)
      and (o.orden_fifo, o.id) < (le.orden_fifo, le.id));

create unique index if not exists lista_espera_activa_unica on public.lista_espera
  (cliente_id, sede_id, fecha_deseada_inicio, fecha_deseada_fin, servicio_ids, (coalesce(staff_id, '00000000-0000-0000-0000-000000000000'::uuid)))
  where estado = 'ACTIVA';

-- 209 — El negocio define su «ventana de reservas»: con cuánta anticipación mínima y hasta cuántos días adelante puede reservar un cliente.
-- Antes ambos valores existían (negocio.min_anticipacion_minutos / max_anticipacion_dias, por defecto 0 y 60) y los usa slots_disponibles, pero
-- ninguna pantalla permitía cambiarlos: todos los negocios quedaron fijos en 60 días. Esta función es el único camino del panel; no toca
-- slots_disponibles ni ninguna regla de disponibilidad. Aplica a reservas nuevas (las ya creadas no cambian).
-- Solo la propietaria (is_barberia_de): el SuperSU y el soporte no entran. Deja auditoría con antes y después.

create or replace function public.configurar_ventana_reservas(p_negocio_id uuid, p_min_minutos integer, p_max_dias integer)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare v_antes jsonb;
begin
  if auth.uid() is null then raise exception 'NO_AUTENTICADO'; end if;
  if not coalesce(public.is_barberia_de(p_negocio_id), false) then raise exception 'NO_AUTORIZADO'; end if;
  perform public._exigir_operativo(p_negocio_id);

  if p_min_minutos is null or p_max_dias is null
     or p_min_minutos < 0 or p_min_minutos > 10080          -- hasta 7 días de anticipación mínima
     or p_max_dias < 1 or p_max_dias > 365                  -- hasta un año adelante
     or p_max_dias * 1440 <= p_min_minutos then              -- la ventana máxima debe ser mayor que la mínima
    raise exception 'VENTANA_INVALIDA';
  end if;

  select jsonb_build_object('min_anticipacion_minutos', min_anticipacion_minutos, 'max_anticipacion_dias', max_anticipacion_dias)
    into v_antes from public.negocio where id = p_negocio_id for update;
  if not found then raise exception 'NEGOCIO_NO_ENCONTRADO'; end if;

  update public.negocio set min_anticipacion_minutos = p_min_minutos, max_anticipacion_dias = p_max_dias where id = p_negocio_id;

  perform public._auditar('negocio', p_negocio_id, 'VENTANA_RESERVAS_CONFIGURADA', p_negocio_id, v_antes,
    jsonb_build_object('min_anticipacion_minutos', p_min_minutos, 'max_anticipacion_dias', p_max_dias), null);
end $$;

revoke all on function public.configurar_ventana_reservas(uuid, integer, integer) from public, anon, authenticated;
grant execute on function public.configurar_ventana_reservas(uuid, integer, integer) to authenticated;

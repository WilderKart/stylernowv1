-- ALTO (QA dinero): reactivar_membresia_congelada no revertia los dias de congelacion no usados, asi que
-- congelar -> reactivar en bucle alargaba fecha_proximo_cobro sin pagar. Ahora se descuentan al reactivar.
-- PENDIENTE DE APLICAR (la capa de permisos rechazo apply_migration): pegar en el SQL editor de Supabase.
create or replace function public.reactivar_membresia_congelada(p_cliente_membresia_id uuid)
returns public.cliente_membresia language plpgsql security definer set search_path = public as $$
declare
  v_membresia public.cliente_membresia;
  v_no_usado interval;
begin
  select * into v_membresia from public.cliente_membresia where id = p_cliente_membresia_id for update;
  if not found or v_membresia.cliente_id <> auth.uid() then raise exception 'NO_AUTORIZADO'; end if;
  if v_membresia.estado <> 'SUSPENDIDA' or v_membresia.congelada_hasta is null then raise exception 'TRANSICION_INVALIDA'; end if;

  v_no_usado := greatest(v_membresia.congelada_hasta - now(), interval '0');

  update public.cliente_membresia
     set estado = 'ACTIVA', congelada_hasta = null,
         fecha_proximo_cobro = fecha_proximo_cobro - v_no_usado, updated_at = now()
   where id = p_cliente_membresia_id
  returning * into v_membresia;

  return v_membresia;
end;
$$;

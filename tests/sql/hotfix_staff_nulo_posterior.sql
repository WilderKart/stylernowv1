-- Parte 3 de la verificación del hotfix (ver hotfix_staff_nulo_verificacion.sh). No correr sola.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a3","role":"authenticated"}', true);
do $$ begin
  begin
    perform public.cancelar_reserva('00000000-0000-0000-0000-0000000000d2', 'ataque');
    raise exception 'FALLA: tras el hotfix el intruso todavía cancela reservas ajenas';
  exception when others then
    if sqlerrm not like '%NO_AUTORIZADO%' then raise; end if;
  end;
  begin
    perform public.completar_venta_pos('00000000-0000-0000-0000-0000000000d2', '[]'::jsonb, 'EFECTIVO', 0, null, 0);
    raise exception 'FALLA: tras el hotfix el intruso todavía cierra ventas POS ajenas';
  exception when others then
    if sqlerrm not like '%NO_AUTORIZADO%' then raise; end if;
  end;
  raise notice 'OK hotfix: cancelar_reserva y completar_venta_pos rechazan al intruso (NO_AUTORIZADO)';
end $$;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);
do $$ begin
  perform public.cancelar_reserva('00000000-0000-0000-0000-0000000000d2', 'el dueño sí puede');
  raise notice 'OK hotfix: el dueño conserva su operación legítima';
end $$;
reset role;
rollback;

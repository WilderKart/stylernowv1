-- Parte 1 de la verificación del hotfix (ver hotfix_staff_nulo_verificacion.sh). No correr sola.
-- Reconstruye, DENTRO de una transacción que termina en ROLLBACK, la versión vulnerable que hoy
-- está en producción (sin coalesce), siembra datos y demuestra que el ataque funciona.
\set ON_ERROR_STOP 1
begin;
grant select, insert, update, delete on all tables in schema public to service_role;
grant select on all tables in schema public to authenticated;

do $$
declare v_def text;
begin
  -- cancelar_reserva tal como está en producción (008): comparación sin coalesce.
  v_def := pg_get_functiondef('public.cancelar_reserva(uuid,text)'::regprocedure);
  v_def := replace(v_def, 'coalesce(v_reserva.cliente_id = v_actor, false)', 'v_reserva.cliente_id = v_actor');
  v_def := replace(v_def, 'coalesce(public.is_barberia_de(v_reserva.negocio_id), false)', 'public.is_barberia_de(v_reserva.negocio_id)');
  v_def := replace(v_def, 'coalesce(public.is_guardian_de_sede(v_reserva.sede_id), false)', 'public.is_guardian_de_sede(v_reserva.sede_id)');
  v_def := replace(v_def, 'coalesce(v_reserva.staff_id = v_actor, false)', 'v_reserva.staff_id = v_actor');
  execute v_def;
  v_def := pg_get_functiondef('public.completar_venta_pos(uuid,jsonb,text,numeric,text,integer)'::regprocedure);
  v_def := replace(v_def, 'or coalesce(v_reserva.staff_id = auth.uid(), false);', 'or v_reserva.staff_id = auth.uid();');
  v_def := replace(v_def, 'if not coalesce(v_autorizado, false) then', 'if not v_autorizado then');
  execute v_def;
end $$;

insert into auth.users (id, email, aud, role) values
  ('00000000-0000-0000-0000-0000000000a1', 'd@t.l', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000000a2', 'c@t.l', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000000a3', 'i@t.l', 'authenticated', 'authenticated');
insert into public.perfil (id, nombre) values
  ('00000000-0000-0000-0000-0000000000a1', 'D'), ('00000000-0000-0000-0000-0000000000a2', 'C'), ('00000000-0000-0000-0000-0000000000a3', 'I')
on conflict do nothing;
insert into public.negocio (id, owner_user_id, nombre, slug, ciudad, pais_codigo)
values ('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000a1', 'N', 'n-hotfix', 'Cali', 'CO');
insert into public.sede (id, negocio_id, nombre, direccion, ciudad)
values ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000b1', 'S', 'D', 'Cali');
update public.suscripcion set estado = 'ACTIVA' where negocio_id = '00000000-0000-0000-0000-0000000000b1';
insert into public.reserva (id, cliente_id, negocio_id, sede_id, hora_inicio, hora_fin, estado, monto_total, monto_sena) values
 ('00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000c1',
  now() + interval '3 days', now() + interval '3 days 1 hour', 'CONFIRMADA', 50000, 0),
 ('00000000-0000-0000-0000-0000000000d2', '00000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000c1',
  now() + interval '4 days', now() + interval '4 days 1 hour', 'CONFIRMADA', 50000, 0);

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a3","role":"authenticated"}', true);
do $$
declare v_ok boolean := false;
begin
  begin
    perform public.cancelar_reserva('00000000-0000-0000-0000-0000000000d1', 'ataque');
    v_ok := true;
  exception when others then null;
  end;
  if not v_ok then raise exception 'FALLA: no se pudo reproducir la vulnerabilidad (la versión reconstruida no es la vulnerable)'; end if;
  raise notice 'REPRODUCIDO (antes del hotfix): el intruso canceló una reserva ajena sin staff';
end $$;
reset role;

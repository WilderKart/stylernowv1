-- 6.2 (PLAN_COMPETITIVO_AGENTES): las funciones por plan se aplican en RLS, no solo en la UI.
-- Politicas RESTRICTIVAS (se suman a las existentes con AND): un negocio cuyo plan no incluye la funcion no puede
-- crear, editar ni borrar esas filas por la API, aunque la UI no lo muestre. Las funciones SECURITY DEFINER del sistema
-- y SuperSU no se ven afectadas (negocio_tiene_funcion devuelve true para SuperSU). Una sola fuente de verdad:
-- la tabla plan_caracteristica (migracion 109). REGLA PENDIENTE DE ACORDAR con Wilder: plan vencido o en gracia
-- (hoy se usa el plan de la suscripcion sin mirar su estado).
-- PENDIENTE DE APLICAR por Wilder (despues de la 109).

drop policy if exists membresia_plan_plan_ins on public.membresia_plan;
drop policy if exists membresia_plan_plan_upd on public.membresia_plan;
drop policy if exists membresia_plan_plan_del on public.membresia_plan;
create policy membresia_plan_plan_ins on public.membresia_plan as restrictive for insert to authenticated
  with check (public.negocio_tiene_funcion(negocio_id, 'membresias'));
create policy membresia_plan_plan_upd on public.membresia_plan as restrictive for update to authenticated
  using (public.negocio_tiene_funcion(negocio_id, 'membresias')) with check (public.negocio_tiene_funcion(negocio_id, 'membresias'));
create policy membresia_plan_plan_del on public.membresia_plan as restrictive for delete to authenticated
  using (public.negocio_tiene_funcion(negocio_id, 'membresias'));

drop policy if exists recompensa_regla_plan_ins on public.recompensa_regla;
drop policy if exists recompensa_regla_plan_upd on public.recompensa_regla;
drop policy if exists recompensa_regla_plan_del on public.recompensa_regla;
create policy recompensa_regla_plan_ins on public.recompensa_regla as restrictive for insert to authenticated
  with check (public.negocio_tiene_funcion(negocio_id, 'fidelizacion'));
create policy recompensa_regla_plan_upd on public.recompensa_regla as restrictive for update to authenticated
  using (public.negocio_tiene_funcion(negocio_id, 'fidelizacion')) with check (public.negocio_tiene_funcion(negocio_id, 'fidelizacion'));
create policy recompensa_regla_plan_del on public.recompensa_regla as restrictive for delete to authenticated
  using (public.negocio_tiene_funcion(negocio_id, 'fidelizacion'));

drop policy if exists cashback_regla_plan_ins on public.cashback_regla;
drop policy if exists cashback_regla_plan_upd on public.cashback_regla;
drop policy if exists cashback_regla_plan_del on public.cashback_regla;
create policy cashback_regla_plan_ins on public.cashback_regla as restrictive for insert to authenticated
  with check (public.negocio_tiene_funcion(negocio_id, 'fidelizacion'));
create policy cashback_regla_plan_upd on public.cashback_regla as restrictive for update to authenticated
  using (public.negocio_tiene_funcion(negocio_id, 'fidelizacion')) with check (public.negocio_tiene_funcion(negocio_id, 'fidelizacion'));
create policy cashback_regla_plan_del on public.cashback_regla as restrictive for delete to authenticated
  using (public.negocio_tiene_funcion(negocio_id, 'fidelizacion'));

drop policy if exists sello_campana_plan_ins on public.sello_campana;
drop policy if exists sello_campana_plan_upd on public.sello_campana;
drop policy if exists sello_campana_plan_del on public.sello_campana;
create policy sello_campana_plan_ins on public.sello_campana as restrictive for insert to authenticated
  with check (public.negocio_tiene_funcion(negocio_id, 'fidelizacion'));
create policy sello_campana_plan_upd on public.sello_campana as restrictive for update to authenticated
  using (public.negocio_tiene_funcion(negocio_id, 'fidelizacion')) with check (public.negocio_tiene_funcion(negocio_id, 'fidelizacion'));
create policy sello_campana_plan_del on public.sello_campana as restrictive for delete to authenticated
  using (public.negocio_tiene_funcion(negocio_id, 'fidelizacion'));

drop policy if exists vip_nivel_plan_ins on public.vip_nivel;
drop policy if exists vip_nivel_plan_upd on public.vip_nivel;
drop policy if exists vip_nivel_plan_del on public.vip_nivel;
create policy vip_nivel_plan_ins on public.vip_nivel as restrictive for insert to authenticated
  with check (public.negocio_tiene_funcion(negocio_id, 'fidelizacion'));
create policy vip_nivel_plan_upd on public.vip_nivel as restrictive for update to authenticated
  using (public.negocio_tiene_funcion(negocio_id, 'fidelizacion')) with check (public.negocio_tiene_funcion(negocio_id, 'fidelizacion'));
create policy vip_nivel_plan_del on public.vip_nivel as restrictive for delete to authenticated
  using (public.negocio_tiene_funcion(negocio_id, 'fidelizacion'));

drop policy if exists reserva_foto_plan_ins on public.reserva_foto;
drop policy if exists reserva_foto_plan_upd on public.reserva_foto;
drop policy if exists reserva_foto_plan_del on public.reserva_foto;
create policy reserva_foto_plan_ins on public.reserva_foto as restrictive for insert to authenticated
  with check (public.negocio_tiene_funcion(negocio_id, 'my_look'));
create policy reserva_foto_plan_upd on public.reserva_foto as restrictive for update to authenticated
  using (public.negocio_tiene_funcion(negocio_id, 'my_look')) with check (public.negocio_tiene_funcion(negocio_id, 'my_look'));
create policy reserva_foto_plan_del on public.reserva_foto as restrictive for delete to authenticated
  using (public.negocio_tiene_funcion(negocio_id, 'my_look'));

-- Prueba negativa obligatoria (ejecutar tras aplicar): con un usuario ESSENTIAL, insertar en membresia_plan,
-- recompensa_regla, cashback_regla, sello_campana, vip_nivel o reserva_foto debe fallar con
-- "new row violates row-level security policy".

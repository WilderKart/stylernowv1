-- 161: delegación administrativa MÍNIMA para BUSINESS_ADMIN / ADMIN_BARBER (FASE 1, 2026-11-18).
--
-- Principio: delegar solo lo que se puede demostrar seguro. is_barberia_de() sigue siendo "propietario" y protege todo lo que no se
-- delega aquí (suscripción/facturación/pagos del plan, verificación del negocio, propiedad, perfil profesional del propietario,
-- cambios de rol, perfil Guardian, y ~110 políticas RLS de datos del negocio que NO se modifican en esta fase).
--
-- Un administrador delegado (es_admin=true, vínculo ACTIVO) puede, en SU negocio:
--   · ver el equipo y las invitaciones (políticas de lectura),
--   · invitar BARBER (no administradores: crear_invitacion_staff en 152), reenviar y cancelar invitaciones a BARBER,
--   · suspender, reactivar, retirar y trasladar de sede a profesionales que NO son administradores.
-- NO puede: tocar a otro administrador ni al propietario, cambiar roles, promover/revocar Guardian, ni nada de facturación.
-- Todo lo demás del panel para un administrador (servicios, sedes, horarios, reservas del negocio, clientes, reportes) queda
-- PENDIENTE de decisión: requiere revisar política por política. Está documentado en docs/FASE1_ROLES_CUPOS_INFORME.md.
-- Rollback: 161_delegacion_administrativa_minima_REVERSION.sql.txt.

-- ¿El actor autenticado puede gestionar este vínculo? Propietario: siempre. Administrador: solo vínculos que no son de administrador.
create or replace function public._puede_gestionar_vinculo(p_vinculo_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(
    exists (select 1 from public.vinculo_staff_negocio v where v.id = p_vinculo_id and public.is_barberia_de(v.negocio_id))
    or exists (select 1 from public.vinculo_staff_negocio v
               where v.id = p_vinculo_id and not v.es_admin and public.is_admin_de(v.negocio_id)
                 and v.staff_id is distinct from auth.uid()
                 and not exists (select 1 from public.negocio n where n.id = v.negocio_id and n.owner_user_id = v.staff_id)),
    false);
$$;
revoke all on function public._puede_gestionar_vinculo(uuid) from public, anon, authenticated;

create or replace function public._puede_gestionar_invitacion(p_invitacion_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(
    exists (select 1 from public.invitacion_staff i where i.id = p_invitacion_id and public.is_barberia_de(i.negocio_id))
    or exists (select 1 from public.invitacion_staff i
               where i.id = p_invitacion_id and i.rol_invitado = 'BARBER' and public.is_admin_de(i.negocio_id)),
    false);
$$;
revoke all on function public._puede_gestionar_invitacion(uuid) from public, anon, authenticated;

-- Parches por ancla: se reemplaza SOLO la comprobación de propietario por la de gestión delegada.
do $$
declare
  v_firma text; v_def text; v_ancla text; v_nuevo text;
  v_a_vin constant text := 'if not found or not public.is_barberia_de(v_vinculo.negocio_id) then';
  v_n_vin constant text := 'if not found or not public._puede_gestionar_vinculo(p_vinculo_id) then';
  v_a_inv constant text := 'if not found or not public.is_barberia_de(v_invitacion.negocio_id) then';
  v_n_inv constant text := 'if not found or not public._puede_gestionar_invitacion(p_invitacion_id) then';
begin
  foreach v_firma in array array['public.suspender_staff(uuid,text)', 'public.reactivar_staff(uuid)',
                                 'public.retirar_staff(uuid,text)', 'public.trasladar_staff(uuid,uuid)'] loop
    v_def := pg_get_functiondef(v_firma::regprocedure);
    if position(v_a_vin in v_def) = 0 and position(v_n_vin in v_def) = 0 then raise exception 'ANCLA_NO_ENCONTRADA %', v_firma; end if;
    if position(v_n_vin in v_def) = 0 then execute replace(v_def, v_a_vin, v_n_vin); end if;
  end loop;
  foreach v_firma in array array['public.cancelar_invitacion(uuid)', 'public.reenviar_invitacion(uuid)'] loop
    v_def := pg_get_functiondef(v_firma::regprocedure);
    if position(v_a_inv in v_def) = 0 and position(v_n_inv in v_def) = 0 then raise exception 'ANCLA_NO_ENCONTRADA %', v_firma; end if;
    if position(v_n_inv in v_def) = 0 then execute replace(v_def, v_a_inv, v_n_inv); end if;
  end loop;
end $$;

-- Lectura del equipo para el administrador delegado (la escritura directa sigue siendo solo del propietario).
drop policy if exists vinculo_select_interno on public.vinculo_staff_negocio;
create policy vinculo_select_interno on public.vinculo_staff_negocio for select using (
  public.is_barberia_de(negocio_id) or public.is_admin_de(negocio_id) or public.is_supersu()
  or (sede_activa_id is not null and public.is_guardian_de_sede(sede_activa_id)));

drop policy if exists invitacion_staff_select_negocio on public.invitacion_staff;
create policy invitacion_staff_select_negocio on public.invitacion_staff for select using (
  public.is_barberia_de(negocio_id) or public.is_admin_de(negocio_id) or public.is_supersu());

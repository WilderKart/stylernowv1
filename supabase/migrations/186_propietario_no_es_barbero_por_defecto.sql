-- 186 · El propietario NO aparece en «Equipo» ni en el perfil público salvo que él se habilite como barbero.
-- Solo ESSENTIAL (una persona, un negocio) mantiene el alta automática del perfil del propietario.
-- Desde STUDIO hacia arriba, el propietario se habilita con el botón «Prestar servicios» del panel
-- (activar_perfil_profesional_propietario) y usa sus datos reales.

update public.plan
   set propietario_perfil_auto_alta = false, propietario_profesional_por_defecto = false
 where codigo <> 'ESSENTIAL';

-- Limpieza puntual: perfiles del propietario creados con el NOMBRE DEL NEGOCIO (p. ej. «Barbería Kevin») en planes con
-- equipo y sin reservas futuras. No toca perfiles con nombre de persona ni propietarios con citas pendientes.
with candidatos as (
  select v.id as vinculo_id, n.id as negocio_id, n.owner_user_id
  from public.negocio n
  join public.vinculo_staff_negocio v
    on v.negocio_id = n.id and v.staff_id = n.owner_user_id and v.estado <> 'RETIRADO' and v.presta_servicios
  join public.staff s on s.usuario_id = v.staff_id
  where n.plan_codigo <> 'ESSENTIAL'
    and lower(btrim(s.nombre)) = lower(btrim(n.nombre))
    and not exists (
      select 1 from public.reserva r
       where r.staff_id = v.staff_id and r.negocio_id = n.id
         and r.estado in ('PENDIENTE_PAGO', 'CONFIRMADA', 'EN_CURSO') and r.hora_inicio > now())
), retirados as (
  update public.vinculo_staff_negocio v set estado = 'RETIRADO', es_guardian = false
    from candidatos c where v.id = c.vinculo_id
  returning c.negocio_id, c.owner_user_id
)
insert into public.evento_auditoria (entidad_tipo, entidad_id, accion, actor_tipo, actor_id, negocio_id)
select 'negocio', negocio_id, 'PERFIL_PROPIETARIO_RETIRADO_MIGRACION_186', 'SISTEMA', owner_user_id, negocio_id from retirados;

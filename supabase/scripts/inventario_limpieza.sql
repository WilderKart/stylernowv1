-- Inventario y SIMULACIÓN de la limpieza de datos de prueba. SOLO LECTURA (únicamente SELECT).
-- Se puede correr en producción sin riesgo. No cambia nada.
-- Criterio "de prueba": perfil con correo @stylernow-test.com o @stylernow.test, y los negocios de esos dueños.
-- El procedimiento real (reversible) está en limpiar_datos_prueba.sql y requiere aprobación del propietario.

-- 1 · Usuarios
select
  (select count(*) from auth.users)                                                         as usuarios_auth,
  (select count(*) from public.perfil where email ~* '@stylernow(-test)?\.(test|com)$')     as perfiles_prueba,
  (select count(*) from public.perfil where email !~* '@stylernow(-test)?\.(test|com)$')    as perfiles_otros,
  (select count(*) from public.perfil where es_supersu)                                     as supersu_total,
  (select count(*) from public.perfil where es_supersu and email !~* '@stylernow(-test)?\.(test|com)$') as supersu_reales;

-- 2 · Perfiles que NO son de prueba (correo enmascarado; el propietario decide cuáles son reales)
select left(split_part(p.email,'@',1),2) || '…@' || split_part(p.email,'@',2) as correo_enmascarado, p.created_at::date as creado,
  (select count(*) from public.reserva r where r.cliente_id = p.id)            as reservas_como_cliente,
  (select count(*) from public.negocio n where n.owner_user_id = p.id)         as negocios_propios,
  (select count(*) from public.aceptacion_legal a where a.usuario_id = p.id)   as aceptaciones_legales
from public.perfil p where p.email !~* '@stylernow(-test)?\.(test|com)$' order by p.created_at;

-- 3 · Datos colgados de los negocios de prueba
with neg as (select n.id from public.negocio n join public.perfil p on p.id = n.owner_user_id
             where p.email ~* '@stylernow(-test)?\.(test|com)$')
select
  (select count(*) from neg)                                                                          as negocios,
  (select count(*) from public.sede where negocio_id in (select id from neg))                         as sedes,
  (select count(*) from public.servicio where negocio_id in (select id from neg))                     as servicios,
  (select count(*) from public.vinculo_staff_negocio where negocio_id in (select id from neg))        as vinculos_staff,
  (select count(*) from public.reserva r join public.sede s on s.id = r.sede_id where s.negocio_id in (select id from neg)) as reservas,
  (select count(*) from public.resena where negocio_id in (select id from neg))                       as resenas,
  (select count(*) from public.referido where negocio_id in (select id from neg))                     as referidos,
  (select count(*) from public.egreso_caja where negocio_id in (select id from neg))                  as egresos_caja,
  (select count(*) from public.pago where negocio_id in (select id from neg))                         as pagos,
  (select count(*) from public.suscripcion where negocio_id in (select id from neg))                  as suscripciones,
  (select count(*) from public.evento_auditoria where negocio_id in (select id from neg))             as auditoria,
  (select count(*) from public.libro_movimiento where negocio_id in (select id from neg))             as libro;

-- 4 · Simulación del procedimiento reversible (qué cambiaría cada paso de limpiar_datos_prueba.sql)
select
  (select count(*) from public.negocio n join public.perfil p on p.id = n.owner_user_id
    where p.email ~* '@stylernow(-test)?\.(test|com)$' and n.estado <> 'CANCELADO')        as paso2_negocios_a_ocultar,
  (select count(*) from public.perfil where es_supersu and email ~* '@stylernow(-test)?\.(test|com)$') as paso3_supersu_a_retirar,
  (select count(*) from auth.users where lower(email) ~ '@stylernow(-test)?\.(test|com)$')   as paso4_cuentas_a_bloquear,
  (select count(*) from public.reserva r join public.sede s on s.id = r.sede_id join public.negocio n on n.id = s.negocio_id
    join public.perfil p on p.id = n.owner_user_id
    where p.email ~* '@stylernow(-test)?\.(test|com)$' and r.estado::text in ('PENDIENTE_PAGO','CONFIRMADA')) as reservas_vivas_afectadas,
  (select count(*) from public.pago where estado::text = 'PENDIENTE')                         as pagos_pendientes;

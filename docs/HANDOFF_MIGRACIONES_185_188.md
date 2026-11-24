# Entrega de migraciones 185–188 (para quien tenga permisos sobre la base de producción)

Código ya desplegado en `main`. Las pantallas nuevas **toleran que las migraciones aún no estén aplicadas** (caen al comportamiento anterior),
así que el orden no rompe a nadie; cuando se apliquen, las funciones se activan solas. Las cuatro migraciones se probaron en la base local
(transacciones con pruebas de permisos y reglas; ver «Verificación»).

## Qué hace cada una

| # | Archivo | Resumen |
|---|---------|---------|
| 185 | `supabase/migrations/185_galeria_negocio.sql` | Tabla `negocio_foto` (hasta 5 fotos, una principal, siempre una visible), funciones `galeria_agregar / reemplazar / eliminar / marcar_principal`, trigger que mantiene `negocio.foto_principal_url` sincronizada. Siembra la fachada actual como foto principal. |
| 186 | `supabase/migrations/186_propietario_no_es_barbero_por_defecto.sql` | Desde STUDIO hacia arriba el propietario deja de aparecer como barbero salvo que él se habilite. Retira (estado `RETIRADO`) los perfiles de propietario creados con el **nombre del negocio** (p. ej. «Barbería Kevin») que no tengan citas futuras. |
| 187 | `supabase/migrations/187_ausencias_y_horarios_con_aprobacion.sql` | Tablas `solicitud_ausencia` y `solicitud_horario`; el barbero de planes STUDIO/PRESTIGE/SIGNATURE **solicita** y la barbería aprueba (al aprobar una ausencia se crea el bloqueo en `bloqueo_ausencia`). ESSENTIAL y el propietario no cambian. Notifica a la barbería y al barbero. Cambia las políticas RLS `*_write_propio` de `bloqueo_ausencia` y `disponibilidad`. |
| 188 | `supabase/migrations/188_checkin_solo_el_dia_y_reagendar.sql` | Check-in (`iniciar_atencion_reserva`) y «completar sin POS» de una cita sin check-in **solo el día de la cita** (zona horaria de la sede). Nuevo `reagendar_reserva` / `slots_para_reagendar` para que el barbero mueva SU cita solo a petición del cliente (auditado, avisa al cliente). El cliente y la barbería siguen usando `reprogramar_reserva` (sin cambios). |

## Antes de empezar

1. Respaldo de la base (o confirmar el respaldo vigente). Producción no tiene réplica: hay que poder volver atrás.
2. Confirmar que no hay otra migración 185–188 ya aplicada: `select version from supabase_migrations.schema_migrations where version in ('185','186','187','188');` (debe estar vacío).
3. Vista previa de lo que tocará la 186 (solo lectura):
   ```sql
   select n.nombre as negocio, n.plan_codigo, s.nombre as perfil_propietario
   from negocio n
   join vinculo_staff_negocio v on v.negocio_id = n.id and v.staff_id = n.owner_user_id and v.estado <> 'RETIRADO' and v.presta_servicios
   join staff s on s.usuario_id = v.staff_id
   where n.plan_codigo <> 'ESSENTIAL' and lower(btrim(s.nombre)) = lower(btrim(n.nombre));
   ```
   Cada fila será retirada del equipo. Si alguna no debe retirarse, avisar antes de continuar.

## Aplicar (en este orden, una por una)

Con `psql` contra producción (cada archivo en su propia ejecución, `ON_ERROR_STOP` activado):

```bash
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/migrations/185_galeria_negocio.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/migrations/186_propietario_no_es_barbero_por_defecto.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/migrations/187_ausencias_y_horarios_con_aprobacion.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/migrations/188_checkin_solo_el_dia_y_reagendar.sql
```

Registrar cada versión como se hizo con 146–178:

```sql
insert into supabase_migrations.schema_migrations (version, name) values
  ('185','galeria_negocio'), ('186','propietario_no_es_barbero_por_defecto'),
  ('187','ausencias_y_horarios_con_aprobacion'), ('188','checkin_solo_el_dia_y_reagendar')
on conflict do nothing;
```

Puntos de atención:
- **188** parchea `completar_reserva_sin_pos` buscando un fragmento exacto de su texto. Si responde `ANCLA_NO_ENCONTRADA`, **no improvisar**: detenerse y avisar (la función de producción difiere de la local).
- **185** exige que las fotos sean de Cloudinary y de la carpeta `negocios/<id>/` del propio negocio. La semilla solo copia fachadas que ya cumplen `negocio_foto_principal_cloudinary`.
- **187** reemplaza dos políticas RLS; no la ejecutes con tráfico alto de escritura sobre `disponibilidad` si puedes evitarlo (es instantánea, pero cambia permisos).
- No usar `supabase db push` si ese no es el procedimiento habitual del equipo; lo importante es el orden y el registro de versiones.

## Verificación (todas deben dar lo indicado)

```sql
-- 1. Funciones nuevas con permisos correctos (solo authenticated; nunca anon/public)
select p.proname,
       has_function_privilege('anon', p.oid, 'execute')          as anon,
       has_function_privilege('authenticated', p.oid, 'execute') as authenticated
from pg_proc p
where p.pronamespace = 'public'::regnamespace
  and p.proname in ('galeria_agregar','galeria_eliminar','galeria_reemplazar','galeria_marcar_principal',
                    'solicitar_ausencia','decidir_solicitud_ausencia','solicitar_cambio_horario','decidir_solicitud_horario',
                    'reagendar_reserva','slots_para_reagendar');
-- esperado: anon = false en todas, authenticated = true

-- 2. Cada negocio con foto tiene su principal en la galería
select count(*) as sin_galeria from negocio n
where n.foto_principal_url is not null and not exists (select 1 from negocio_foto f where f.negocio_id = n.id and f.es_principal);  -- 0

-- 3. Planes: solo ESSENTIAL mantiene el alta automática del propietario
select codigo, propietario_perfil_auto_alta, propietario_profesional_por_defecto from plan order by 1;  -- ESSENTIAL t/t, resto f/f

-- 4. El SuperAdmin único sigue intacto
select count(*) from perfil where es_supersu;  -- 1

-- 5. Versiones registradas
select version from supabase_migrations.schema_migrations where version in ('185','186','187','188');  -- 4 filas
```

Prueba funcional mínima con una cuenta real (sin borrar nada):
1. Propietario de un negocio STUDIO: Perfil público → subir 2 fotos, marcar una como principal, eliminar la otra. No debe dejar eliminar la última.
2. Barbero de ese negocio: Mi perfil → «Nueva ausencia» → debe decir «enviada a la barbería»; el propietario la ve en **Staff → Solicitudes** (y recibe la notificación). Al aprobar, la ausencia aparece en el perfil del barbero y bloquea la agenda.
3. Barbero: cambiar un día de su horario → queda «pendiente de aprobación»; el propietario aprueba o rechaza.
4. Barbero: intentar «Check-in» de una cita de otro día → el botón no aparece; por API devuelve `CHECKIN_SOLO_EL_DIA_DE_LA_CITA`.
5. ESSENTIAL: el barbero/propietario guarda ausencias y horario **directo**, como antes.

## Vuelta atrás (si algo falla)

- 185: `drop trigger trg_negocio_foto_sync on negocio; drop table negocio_foto cascade;` y borrar las funciones `galeria_*`, `_galeria_*`, `trg_negocio_foto_sync`.
- 186: `update plan set propietario_perfil_auto_alta = true, propietario_profesional_por_defecto = true where codigo <> 'ESSENTIAL';` (si se hubiera ejecutado antes con otros valores, usar los de respaldo). Para reactivar a un propietario: el botón «Prestar servicios» del panel (`activar_perfil_profesional_propietario`).
- 187: restaurar las políticas `bloqueo_ausencia_write_propio` y `disponibilidad_write_propio` a `using (exists (select 1 from vinculo_staff_negocio v where v.id = <tabla>.vinculo_id and v.staff_id = (select auth.uid())))`; las tablas de solicitudes pueden quedarse.
- 188: reponer `iniciar_atencion_reserva` y `completar_reserva_sin_pos` desde las migraciones previas (018/…); `reagendar_reserva` y `slots_para_reagendar` se pueden borrar.

---

## Prompt para pasar a la persona que ejecuta las migraciones

> Hola. Necesito que apliques 4 migraciones en la base de **producción** de StylerNow y confirmes el resultado. El código que depende de ellas ya está en `main` y tolera que falten, así que no hay prisa por una ventana exacta, pero sí hay que seguir el orden.
>
> 1. Haz un respaldo (o confirma que el vigente sirve).
> 2. Lee `docs/HANDOFF_MIGRACIONES_185_188.md` del repositorio (rama `main`). Ahí está el detalle, las consultas de verificación y la vuelta atrás.
> 3. Ejecuta, en este orden y una por una con `ON_ERROR_STOP`: `185_galeria_negocio.sql`, `186_propietario_no_es_barbero_por_defecto.sql`, `187_ausencias_y_horarios_con_aprobacion.sql`, `188_checkin_solo_el_dia_y_reagendar.sql` (carpeta `supabase/migrations/`). Antes de la 186, corre la consulta de vista previa del documento y dime qué negocios retirará del equipo.
> 4. Registra las versiones 185–188 en `supabase_migrations.schema_migrations`.
> 5. Corre las 5 consultas de verificación del documento y pégame los resultados. Verifica sobre todo que `anon` no tenga permiso de ejecución en las funciones nuevas y que siga existiendo exactamente 1 SuperAdmin (`es_supersu`).
> 6. Si la 188 responde `ANCLA_NO_ENCONTRADA`, o cualquier migración falla, **detente y avísame** con el mensaje completo; no la edites por tu cuenta.
> 7. No borres datos de prueba ni toques cuentas existentes. Cuando termines, dime cuáles migraciones quedaron aplicadas y el resultado de cada verificación.

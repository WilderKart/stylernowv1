# Seguridad (Zero Trust)

## Principios aplicados
1. **Identidad solo de `auth.uid()`**: ninguna función recibe ni confía en un `staff_id`/rol/permiso enviado por el navegador para decidir *quién eres*. `p_staff` solo es un *filtro* y se ignora cuando el llamador no tiene permiso de gestión.
2. **Negocio desde la sesión** en Server Actions y rutas (`resolverContexto`), nunca de un campo del formulario.
3. **RLS solo SELECT** en las 10 tablas del módulo; INSERT/UPDATE/DELETE revocados a `anon` y `authenticated`. Toda escritura pasa por funciones `SECURITY DEFINER` con `search_path` fijo.
4. **Funciones internas** (`_ganancia_generar`, `_comision_resolver`, `_novedad_registrar`, triggers) sin ningún permiso de ejecución para la API. Solo las del panel se conceden a `authenticated` (y revocadas a `public`/`anon`, según la lección registrada).
5. **Inmutabilidad**: trigger `_gan_inmutable` impide reescribir valores y borrar directamente; solo cambian columnas de estado listadas. Las cascadas por borrado de negocio siguen funcionando.
6. **Idempotencia**: `unique(reserva_id, servicio_id)`; cierre de liquidación con `FOR UPDATE` (un segundo intento no encuentra pendientes); índices únicos parciales sobre ítems activos; pagos con clave de idempotencia.
7. **No bloquear el negocio**: si la generación falla, el trigger deja `GANANCIA_GENERACION_FALLIDA` en auditoría y «Buscar novedades» lo marca crítico.
8. **No revelar existencia**: `revision_solicitar`, comprobantes y lecturas sobre objetos ajenos responden «no encontrado»/vacío.
9. **Exportación**: exige `exportar`, usa la misma función de lectura (mismo alcance), tope de 5.000 filas, neutraliza inyección de fórmulas en CSV y queda auditada.
10. **Privacidad**: el profesional ve solo el nombre del cliente de sus propios servicios (sin teléfono/correo). Teléfono/correo solo sirven como criterio de búsqueda para quien gestiona.

## SuperSU: acceso excepcional (no es un bypass)
Solicitud expresa del **propietario** → autorización del propietario con duración (5–240 min) → **un único agente** la toma → solo lectura → expira sola (`expira_at > now()` se evalúa en cada lectura) → cada lectura se audita (`SOPORTE_LECTURA_*`) → revocable por el propietario o el agente. Las funciones de escritura no incluyen la sesión de soporte entre sus condiciones, por lo que **no puede** configurar, liquidar, pagar, ajustar ni exportar.

## Pruebas que lo demuestran
`tests/sql/ganancias_staff.sql` usa identidades reales (`auth.users`) y JWT: aislamiento entre negocios, entre profesionales, entre sedes, permisos de sede vs. negocio, escritura directa denegada, doble cierre, doble pago, reversión, soporte sin sesión / con sesión / otro agente / expirado, y no-escritura de soporte.

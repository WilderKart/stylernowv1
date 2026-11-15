# Fase 1B · Diseño para aprobación del propietario

Estado: **PROPUESTA. Nada de lo descrito en las secciones 2 a 5 está construido.** Se presenta porque la directriz exige diseño y aprobación previa para funcionalidad nueva de soporte, cambios del modelo comercial y descuentos adicionales. Todo se verificó contra la base local (`stylernow-cierre`, 139 migraciones).

## 0. Qué existe hoy (verificado)

| Pieza | Estado real |
|---|---|
| Promociones de barbería | Tabla `oferta_negocio` (título, tipo `PORCENTAJE`/`MONTO`/`DOS_POR_UNO`, valor, días, vigencia, activa). RLS: INSERT/UPDATE/DELETE solo si `is_barberia_de()` = **dueño (`owner_user_id`)**; lectura pública solo si está vigente y el negocio ACTIVO; interno y Super Admin leen todo. Auditada por trigger. **El Super Admin no puede escribirla** (coherente con «no modificaciones silenciosas»). |
| UI de promociones | **No existe**: ningún archivo de `src/` escribe `oferta_negocio`. El dueño hoy no puede administrar promociones desde su panel. |
| Descuento en grupos familiares | `familia_grupo.descuento_familiar_pct`: **no se aplica a ningún precio** (reservas, POS, servicios ni cupones lo leen). Campo inerte. |
| Soporte | `ticket_soporte` (estados `ABIERTO`/`EN_PROCESO`/`RESUELTO`) + `ticket_mensaje`. Un ticket solo lo ve su creador y el Super Admin. Super Admin responde y cambia estado; ambos auditados. |
| Auditoría | `evento_auditoria`: actor, `impersonated_by`, payload antes/después, motivo, origen, request_id. **Inmutable** (trigger `trg_fila_inmutable` en UPDATE/DELETE/TRUNCATE) y sin INSERT/UPDATE/DELETE para `authenticated`. Lectura: el propio actor, el dueño de su negocio, Super Admin. |
| Cuentas | La recuperación oficial es la de Supabase Auth (`solicitarRecuperacion`). No existe procedimiento de soporte para recuperar acceso de un dueño. |

## 1. Descuentos (decisión del propietario, aplicada)

1. **Los grupos familiares no son un mecanismo de descuento.** Migración 139: `crear_grupo_familiar` rechaza cualquier descuento ≠ 0 (`DESCUENTO_FAMILIAR_NO_SOPORTADO`) para **todos**, incluido dueño y Super Admin. Esto **endurece la 138**, que permitía al dueño fijar un descuento familiar: la 138 no representa el modelo definitivo.
2. **La columna `descuento_familiar_pct` se conserva con sus datos.** No se borra ni se renombra. Opciones para ti (no ejecutadas): (a) dejarla inerte; (b) retirarla en una migración posterior, previa comprobación de que en producción todas las filas valen 0. **Dato pendiente: cuántas filas de producción tienen un valor ≠ 0** (consulta de solo lectura que no he ejecutado en producción).
3. **Promoción comercial = `oferta_negocio`**, administrada por el dueño. Brecha técnica detectada: un `PORCENTAJE` solo exige `valor > 0`, sin tope: se puede guardar 5000 %. Es validez de dato, no regla comercial; propongo `CHECK (tipo_descuento <> 'PORCENTAJE' or valor <= 100)` (migración 140, `NOT VALID`). **No inventé** vigencias, acumulación ni cupones.
4. **Promociones generales de StylerNow** (Super Admin) deben ir en un registro **separado** de `oferta_negocio` (otro presupuesto/responsable): hoy **no existe** esa tabla. Requiere tu decisión: ¿se necesita ya, o se pospone?

## 2. Matriz de permisos propuesta (sobre la tuya; lo marcado ⚑ es una decisión)

| Operación | Cliente | Profesional | Guardian | Propietario | Super Admin |
|---|---|---|---|---|---|
| Consultar promociones públicas (vigentes, negocio ACTIVO) | Sí | Sí | Sí | Sí | Sí |
| Consultar TODAS las promociones del negocio (incl. inactivas) | No | Sí (interno, hoy) ⚑ | Sí (interno, hoy) ⚑ | Sí | Sí |
| Crear / modificar / retirar promoción de barbería | No | No | No | **Sí** | Solo vía soporte autorizado (§4); hoy **no puede** |
| Promociones generales de StylerNow | No | No | No | No | Sí (⚑ falta la tabla) |
| Crear ticket de soporte | Sí (sin negocio) ⚑ | Sí, de su negocio | Sí, de su negocio | Sí | Sí |
| Consultar tickets del negocio | No | **Solo los suyos** | **Solo los suyos** | **Hoy NO** (solo ve los que creó) ⚑ | Sí |
| Acciones administrativas del negocio | No | No | Solo operativas ⚑ (qué es «operativa» lo defines tú) | Su negocio | Con autorización verificable |
| Auditoría del negocio | No | No | **Hoy No** | Sí | Sí |
| Auditoría global | No | No | No | No | Sí |

⚑ Decisiones pendientes: (a) si el dueño debe ver tickets creados por su equipo; (b) si el interno (profesional/guardian) debe seguir viendo promociones inactivas; (c) permisos de guardian para auditoría.

## 3. Hallazgo de seguridad en la matriz actual
`tiene_acceso_interno()` y `is_barberia_de()` son cosas distintas (interno incluye profesional y guardian; dueño solo `owner_user_id`). Cualquier ajuste de la matriz anterior debe decidirse **por función**, no por rol general, para no conceder privilegios implícitos.

## 4. Flujo de soporte administrativo (PROPUESTA, no construido)
Se **amplía** `ticket_soporte`, no se crea otro sistema:
- Columnas nuevas: `tipo` (`CONSULTA`, `ACCESO_CUENTA`, `PROMOCION`, `CONFIGURACION`, `INCIDENTE`), `asignado_a`, `solicitante_id` (quién pidió), `negocio_id` obligatorio salvo `CONSULTA`; estados nuevos `ESPERANDO_INFO` y `CERRADO` (sumados a los 3 actuales).
- Tabla `ticket_accion_soporte` (inmutable): una fila por acción administrativa **ejecutada**, con `ticket_id`, `negocio_id`, `solicitante_id`, `super_admin_id`, `accion`, `motivo`, `valor_anterior`, `valor_nuevo`, `resultado`, `evidencia_autorizacion_id`, `origen`, `request_id`, `created_at`.
- Superficie del Super Admin separada en **Consultar / Asistir / Modificar con autorización / Acción global** (cuatro grupos distintos en la UI y cuatro familias de RPC).

## 5. Autorización verificable de una acción del Super Admin (PROPUESTA)
1. El **dueño** (verificado por sesión, no por texto) crea desde su panel una **solicitud de acción** tipificada (`CREAR/MODIFICAR/RETIRAR_PROMOCION`) con los parámetros exactos y **la aprueba con una confirmación explícita** (re-autenticación reciente). Eso genera la **evidencia de autorización**: hash de los parámetros, `owner_user_id`, fecha, IP/agente, `request_id`.
2. Un mensaje de un profesional o guardian **no** genera autorización: el RPC exige `auth.uid() = owner_user_id`.
3. El Super Admin ejecuta solo con `soporte_ejecutar_accion(ticket_id, autorizacion_id)`; la función compara el hash con la acción real, la marca consumida (un solo uso, con vencimiento), la aplica en `oferta_negocio` y escribe `ticket_accion_soporte` + `evento_auditoria` en la misma transacción.
4. Sin autorización vigente → rechazo. Sin motivo → rechazo. No hay camino de escritura directa del Super Admin sobre `oferta_negocio`.

### Recuperación de cuentas (PROPUESTA)
El Super Admin **no ve, no fija ni envía contraseñas, ni cambia correo/contraseña**. Solo puede (a) ver el estado de la cuenta, (b) **disparar el flujo oficial de recuperación de Supabase Auth hacia el correo ya registrado**, tras registrar en el ticket la verificación de identidad (checklist documentada) con doble confirmación; todo queda en `ticket_accion_soporte`. Cambiar el correo de un propietario queda **fuera** de esta fase.

## 6. Qué necesito que apruebes
1. Matriz de la sección 2 (y las decisiones ⚑).
2. Ampliación del sistema de tickets (sección 4) y el flujo de autorización (sección 5).
3. Si se construye ya la UI de promociones del dueño (hoy no existe).
4. Qué hacer con `descuento_familiar_pct` (conservar inerte / retirar) y si hace falta una tabla de promociones de la plataforma.
5. Valor definitivo del límite de miembros por grupo familiar (hoy: techo técnico **provisional** de 20; por defecto 4).
6. Flujo con consentimiento para incorporar a un miembro a un grupo familiar (diseño en el informe); mientras tanto `agregar_miembro_familiar` está revocada.

# ADR-007 — Timeline Laboral del Staff: un único historial, sin tabla nueva

## Estado
Aceptada. Decisión del fundador durante la operación continua de Fase 2, formalizando un mecanismo que ya venía construyéndose módulo a módulo (2.3 y 2.4) sin haber sido declarado explícitamente como arquitectura oficial.

## Contexto

Desde el Módulo 2.3 (Gestión de Sedes) y de forma más completa en el Módulo 2.4 (Gestión de Staff), cada cambio relevante en la vida laboral de un Staff dentro de StylerNow ya se registra en `evento_auditoria` (`04-Data-Model/04_Audit.md`): ingreso (`STAFF_VINCULADO`), traslado de sede (`STAFF_TRASLADADO`), promoción y revocación de Guardian (`STAFF_PROMOVIDO_GUARDIAN` / `STAFF_GUARDIAN_REVOCADO`), suspensión y reactivación (`STAFF_SUSPENDIDO` / `STAFF_REACTIVADO`), y retiro (`STAFF_RETIRADO`). Cada evento guarda actor, fecha, negocio y el estado antes/después en `jsonb`, y la tabla no tiene política de `DELETE` para ningún rol que no sea `service_role` — es, de hecho, ya inmutable.

Por separado, el Sistema de Niveles PRO/EXPERT/MASTER (`03-Business-Rules/05_Staff_Rewards.md`) tiene su propio historial: `nivel_staff_consolidado`, una fila inmutable por `vinculo_id` y `temporada_id` una vez que una temporada se cierra. Este mecanismo ya existe en el modelo de datos (desde antes de esta sesión) pero todavía no tiene un proceso que lo alimente — el cálculo de puntaje por temporada es una Decisión abierta registrada en ADL-009, para una fase posterior.

La pregunta que dispara este ADR: al pedir explícitamente un "Timeline Laboral" que junte ingreso, traslados, Guardian, nivel, suspensión, reactivación y reconocimientos en un solo lugar, ¿se construye una tabla nueva de "eventos de carrera", o se declara que los dos mecanismos que ya existen —`evento_auditoria` y `nivel_staff_consolidado`— **son** ese Timeline, combinados en la capa de lectura?

## Decisión

**No se crea ninguna tabla nueva.** El Timeline Laboral de un Staff es la combinación de:

1. `evento_auditoria` filtrado por `entidad_tipo = 'vinculo_staff_negocio'` y `entidad_id = <vinculo_id>` — ya cubre ingreso, traslado, Guardian, suspensión, reactivación y retiro.
2. `nivel_staff_consolidado` filtrado por `vinculo_id` — cubrirá los cambios de Nivel una vez que exista el proceso de cierre de temporada (Fase 6, ADL-009). Hasta entonces esta parte del timeline está vacía de verdad, no con datos simulados.
3. **Reconocimientos** (menciones futuras del roadmap de Fidelización/Growth, `08-Growth-Monetization/`): cuando se construyan, emiten un evento más en `evento_auditoria` (`accion = 'STAFF_RECONOCIMIENTO'`) — nunca una tabla paralela. Esto es lo único que este ADR fija por adelantado para que, cuando llegue esa fase, no haga falta rediseñar el timeline.

`obtenerHistorialStaff()` (`src/app/panel/staff/actions.ts`) es el único punto de lectura que combina (1) y (2) y las devuelve ordenadas cronológicamente. Ninguna otra pantalla vuelve a consultar `evento_auditoria` a mano para mostrar historial de Staff.

## Consecuencias

**Positivas:**
- Cero migraciones nuevas — el mecanismo ya estaba construido y ya es inmutable (sin política de `DELETE`), solo faltaba declararlo como la arquitectura oficial en vez de un efecto colateral de otros módulos.
- Cuando el Sistema de Niveles y los Reconocimientos se construyan (Fase 6), se conectan al mismo timeline con un `UNION` más en `obtenerHistorialStaff()` — nunca una pantalla nueva de "historial v2".
- Consistente con `Regla de Oro` (nunca duplicar lógica): un negocio con 1.000 Staff no obliga a rediseñar esto — es la misma tabla y el mismo patrón de lectura que ya escala con índices existentes (`auditoria_entidad_idx`).

**Negativas / Trade-offs aceptados:**
- `evento_auditoria` es una tabla genérica (no una tabla `staff_timeline` con columnas tipadas) — leer el detalle de cada evento requiere interpretar su `jsonb`, un poco más de trabajo en la capa de lectura que una tabla dedicada. Se acepta porque la alternativa (una tabla nueva) duplicaría exactamente lo que `evento_auditoria` ya hace para Sedes, Negocios y (en Fase 3) Moderación — rompiendo la razón de ser de una tabla de auditoría central.
- El historial de Nivel queda genuinamente vacío hasta Fase 6 — es una limitación real del roadmap, documentada, no un bug de este módulo.

## Alternativas consideradas

1. **Tabla nueva `staff_historial_laboral`** con un `tipo` enum y columnas tipadas por evento. Rechazada: sería una segunda tabla de auditoría corriendo en paralelo a `evento_auditoria`, exactamente la duplicación de lógica que la Regla de Oro prohíbe.
2. **Vista materializada que una `evento_auditoria` + `nivel_staff_consolidado`.** Rechazada por ahora: con el volumen actual (Staff por negocio, no millones de filas) una consulta directa en `obtenerHistorialStaff()` es suficiente; se revisita si el volumen lo justifica (ver `docs/TECH_DEBT_REGISTER.md`).

## Dependencias
- Depende de: `04-Data-Model/04_Audit.md`, `03-Business-Rules/05_Staff_Rewards.md`, ADL-009.
- De esta decisión depende: cualquier futura pantalla de historial de Staff (App Staff, Fase 4) debe reutilizar `obtenerHistorialStaff()` o el mismo patrón de consulta, nunca duplicarlo.

## Referencia cruzada
`00_MASTER_TASKLIST.md` (Módulo 2.4), `Architecture_Decision_Log.md` (ADL a agregar), `src/app/panel/staff/actions.ts`, `src/app/panel/staff/[id]/detalle-staff.tsx`.

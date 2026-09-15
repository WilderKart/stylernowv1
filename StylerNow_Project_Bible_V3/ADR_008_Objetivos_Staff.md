# ADR-008 — Objetivos de Staff: arquitectura preparada, sin implementación de IA

## Estado
Aceptada. Decisión del fundador: se deja la arquitectura de datos lista para que Fase 6 (Growth Engine) pueda construir objetivos e insights de Staff sin rediseñar el modelo — **no se implementa ningún cálculo, IA, ni pantalla en esta sesión.**

## Contexto

`09-CRM-Intelligence/03_AI_Staff.md` ya describe señales de IA por Staff (ocupación de agenda, recurrencia de clientes atendidos, tendencia de puntaje) y `01-PRD/05_KPIs.md` define KPIs agregados de Staff (distribución de niveles, producción promedio). Ninguno de los dos documentos define objetivos individuales configurables (cortes, ventas, reseñas, puntualidad, clientes recurrentes) — el pedido de esta sesión es nuevo respecto a la Biblia existente.

Construir el motor de objetivos completo (definición, seguimiento, cumplimiento, notificación) sin las señales de IA que le dan sentido (`04_AI_Business.md`, Fase 6) produciría una funcionalidad a medias: una Barbería podría configurar un objetivo de "20 cortes esta semana" pero no tendría ningún conteo automático fiable todavía conectado a Reportes (Módulo 2.10, tampoco construido). Construirlo ahora violaría la Regla de Oro ("nunca pantallas aisladas, dominios completos") en la dirección opuesta: sería una pantalla completa colgando de datos que otros módulos futuros todavía no producen de forma consolidada.

## Decisión

**Se documenta el modelo de datos que Fase 6 va a necesitar, sin crear ninguna tabla ni RPC todavía.** Cuando se implemente:

1. **Tipos de objetivo** (no un objetivo por Staff hardcodeado, sino una configuración por tipo): `CORTES` (conteo de Reservas `COMPLETADA` con Servicios de esa categoría), `VENTAS` (suma de `monto_total`, reutilizando exactamente la fórmula de GMV/Ticket promedio ya definida en `01-PRD/05_KPIs.md`), `RESENAS` (promedio o conteo de `resena`, tabla ya existente), `PUNTUALIDAD` (relación entre `hora_inicio` programada y `checkin_at` real, ambas columnas ya existen en `reserva`), `CLIENTES_RECURRENTES` (reutiliza la definición exacta de "Clientes recurrentes" de `01-PRD/05_KPIs.md`, nunca una fórmula nueva y distinta).
2. **Cada tipo de objetivo se calcula con una fórmula que YA existe en la Biblia** — este ADR prohíbe explícitamente inventar una fórmula nueva de puntualidad o recurrencia distinta de las que ya están definidas para otros propósitos. Un objetivo es una meta y un periodo sobre un KPI que ya tiene dueño.
3. **Persistencia futura**: una tabla de configuración (objetivo por `vinculo_id` o por Negocio como plantilla, tipo, meta numérica, periodo) y una tabla de progreso consolidado por periodo — siguiendo el mismo patrón ya usado por `temporada` + `nivel_staff_consolidado` (periodo cerrado, fila inmutable), no un cálculo en vivo en cada request.
4. **Nada de esto se construye ahora.** No hay migración, no hay RPC, no hay pantalla — es intencional. Se referencia acá para que cuando llegue Fase 6, la Biblia ya tenga la decisión tomada y no haga falta una nueva ronda de diseño.

## Consecuencias

**Positivas:**
- Cuando llegue Fase 6, el diseño de datos ya está resuelto — solo queda implementarlo, no discutirlo.
- Evita construir una funcionalidad de objetivos desconectada de Reportes (2.10) e IA (Fase 6), que sería un dominio a medias.

**Negativas / Trade-offs aceptados:**
- El pedido explícito de esta sesión ("Preparar objetivos de Staff") queda satisfecho solo a nivel de decisión documentada, no de código — es una decisión consciente de alcance, registrada en `docs/PENDING_DECISIONS.md` con la razón exacta, no un olvido.

## Alternativas consideradas

1. **Construir una tabla `staff_objetivo` genérica ahora, sin conectarla a nada.** Rechazada: sería exactamente el tipo de "arquitectura temporal" que la Regla de Oro prohíbe — una tabla sin ningún lector ni escritor real todavía es más difícil de validar que diseñarla junto con su primer consumidor real en Fase 6.
2. **Adelantar Fase 6 completa ahora mismo.** Rechazada por el propio orden de fases del fundador — Fase 6 depende de que existan Reportes (2.10) y las señales de IA de Negocio (`09-CRM-Intelligence`), ninguna construida todavía.

## Dependencias
- Depende de: `09-CRM-Intelligence/03_AI_Staff.md`, `01-PRD/05_KPIs.md`, `03-Business-Rules/05_Staff_Rewards.md`.
- De esta decisión depende: el diseño de datos de Fase 6 (Growth Engine) cuando se ejecute.

## Referencia cruzada
`docs/PENDING_DECISIONS.md`, `00_MASTER_TASKLIST.md` (Fase 6, Roadmap).

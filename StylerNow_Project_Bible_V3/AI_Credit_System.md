# AI Credit System

> **Actualizado por ADR-013 (2026-09-16, ver `ADR_013_AI_OS_Monetizacion.md`)**: la
> arquitectura conceptual de este documento (3 niveles, degradación, FIFO,
> auditoría) sigue vigente y fue implementada tal cual. Los **números**
> hardcodeados originales de este documento (costo por función, precio del
> paquete, ventana de expiración de créditos comprados) fueron reemplazados
> por la matriz oficial de ADR-013 — la fuente única de verdad de precios ya
> **no es este archivo Markdown, es la base de datos** (`ai_accion_costo`,
> `ai_paquete_creditos`, `plan_funcion_ia`, todas editables por SuperSU vía
> el AI Center — `/admin/ai` — sin tocar código ni este documento). La única
> excepción donde el número viejo de este documento se mantuvo tal cual: la
> ventana de expiración de créditos comprados (90 días, ver más abajo).
>
> **Hallazgo pendiente de confirmación del fundador**: la función
> `recomendacion` del catálogo nuevo de ADR-013 (habilitada desde el Plan
> Raven) podría ser la misma "Recomendación de Negocios al Cliente" de
> `09-CRM-Intelligence/02_AI_Client.md` (que este documento marca
> explícitamente como costo de infraestructura de plataforma, **nunca**
> descontado de un Negocio) — o podría ser una función distinta,
> Negocio-facing (ej. recomendar un Servicio/Producto a un Cliente
> específico desde el Panel). Se implementó como cobrable al Negocio
> (`ai_accion_costo`) por consistencia con el resto del catálogo de
> ADR-013, sin asumir cuál de las dos interpretaciones es la correcta — ver
> `docs/PENDING_DECISIONS.md`.

## Objetivo
Especificar por completo el sistema de créditos que mide y limita el consumo de IA en StylerNow, como implementación directa del principio financiero de `ADR_001_Monetization_Principles.md` ("StylerNow nunca subsidia costos variables"). Este documento es la fuente única de verdad **conceptual** de cómo funciona el sistema de créditos; los números concretos (costo por función, precios de paquete) viven en la base de datos desde ADR-013 — ver nota arriba.

## Alcance
Asignación de créditos por Plan, renovación, compra de paquetes adicionales, expiración, auditoría, y la arquitectura de 3 niveles de IA que determina cuándo una función consume créditos y cuándo no. No redefine las funciones de IA en sí (ya documentadas en `09-CRM-Intelligence/02_AI_Client.md`, `03_AI_Staff.md`, `04_AI_Business.md`) — este documento fija su costo y su nivel.

## Reglas

### Asignación mensual de créditos por Plan

| Plan | Créditos IA/mes |
|---|---|
| Raven | 100 |
| Jarl | 600 |
| Valhalla | 2.500 |
| Allfather | Personalizado (definido en el contrato) |

Fuente: `01-PRD/03_Monetization.md`. Este documento no redefine el número, solo cómo se consume y gestiona.

### Arquitectura de 3 niveles

#### Nivel 0 — Sin IA (gratuito, sin límite, no consume créditos)

Funciones que se resuelven completamente con reglas de negocio fijas y determinísticas — no requieren ningún modelo de IA, y por lo tanto no tienen costo variable ni límite de consumo.

**Funciones de Nivel 0 en el catálogo actual:**
- Detección de horarios muertos (`09-CRM-Intelligence/04_AI_Business.md`, Función 4) — es un conteo estadístico simple sobre disponibilidad vs. Reservas reales de 8 semanas, sin necesidad de modelo.
- Cálculo del Score de Marketplace (`08-Growth-Monetization/01_Marketplace_Algorithm.md`) — es una fórmula ponderada fija, nunca fue IA aunque pudiera parecerlo.
- Cálculo de puntaje PRO/EXPERT/MASTER (`03-Business-Rules/05_Staff_Rewards.md`) — fórmula determinística y auditable por diseño (ADL-006); nunca se implementa como IA, precisamente para que sea 100% predecible y disputable.
- Expiración de Puntos de fidelización, cálculo de No-show, cálculo de comisiones — todas las reglas de `03-Business-Rules` son Nivel 0 por definición: son reglas de negocio, no inferencia.

#### Nivel 1 — IA económica (consumo bajo de créditos)

Modelo de lenguaje de bajo costo, usado para tareas de clasificación, resumen o recomendación simple donde la precisión "suficientemente buena" es aceptable y el volumen de invocaciones es alto.

**Regla de atribución de costo:** una función de Nivel 1 o 2 consume créditos del Negocio que la solicita para su propio beneficio operativo (ej. un Negocio pidiendo insights sobre su propio Staff). Una función que StylerNow ejecuta como infraestructura de plataforma para beneficio del Marketplace en su conjunto (no solicitada por un Negocio específico) es costo operativo de StylerNow, no se descuenta de ningún Negocio — así ocurre con la única función de este tipo en el catálogo actual, marcada explícitamente abajo.

**Funciones de Nivel 1:**
| Función | Fuente | Costo en créditos |
|---|---|---|
| Recomendación de Negocios al Cliente | `09-CRM-Intelligence/02_AI_Client.md` | **Costo de plataforma, no se descuenta de ningún Negocio** — es infraestructura de descubrimiento del Marketplace, no una función que un Negocio individual solicita (cacheada 24h por Cliente) |
| Riesgo de abandono de Cliente | `09-CRM-Intelligence/04_AI_Business.md`, Función 2 | 1 crédito del Negocio por Cliente evaluado, calculado en lote semanal (no por consulta individual) |

#### Nivel 2 — IA Premium (consumo alto de créditos)

Modelo de mayor capacidad, usado para análisis complejo multi-variable donde la calidad del resultado justifica el costo mayor y el volumen de invocaciones es naturalmente bajo (ejecutadas en lote, no en tiempo real por request).

**Funciones de Nivel 2:**
| Función | Fuente | Costo en créditos |
|---|---|---|
| Insights de rendimiento de Staff | `09-CRM-Intelligence/03_AI_Staff.md` | 5 créditos por corrida (semanal, por Negocio — cubre a todo su Staff en una sola corrida, no por Staff individual) |
| Predicción de ocupación | `09-CRM-Intelligence/04_AI_Business.md`, Función 1 | 10 créditos por corrida (cada 14 días, por Sede) |
| Sugerencia de campañas | `09-CRM-Intelligence/04_AI_Business.md`, Función 3 | 8 créditos por sugerencia generada (bajo demanda, cuando el Admin/Guardian abre la sección de campañas sugeridas, con caché de 24h) |

### Regla de degradación al agotar créditos

Cuando un Negocio agota su asignación del mes (más cualquier paquete comprado, ver abajo):
- Las funciones de **Nivel 0 siguen funcionando siempre**, sin excepción — nunca dependen de crédito.
- Las funciones de **Nivel 1 y 2 se deshabilitan** con un mensaje explícito en la UI ("Sin créditos IA disponibles — Comprar paquete o Actualizar plan"), nunca fallan silenciosamente ni se degradan a un resultado de menor calidad sin avisar.
- El Panel Negocio muestra el consumo de créditos del mes en tiempo real (barra de progreso, similar a la disponibilidad de conversaciones WhatsApp de `WhatsApp_Delivery_Engine.md`) para que el Negocio anticipe el agotamiento antes de que ocurra.

### Renovación

- Los créditos del Plan se renuevan exactamente el día del ciclo de facturación de la suscripción (mismo día que el cobro mensual, `08-Growth-Monetization/04_Subscriptions_Lifecycle.md`).
- **No hay acumulación (rollover)**: los créditos del Plan no usados en el mes se pierden al renovar — evita que un Negocio acumule un saldo indefinido que reintroduzca el riesgo financiero que `ADR_001_Monetization_Principles.md` busca evitar.

### Compra de paquetes adicionales

- Un Negocio puede comprar un paquete adicional de créditos en cualquier momento, sin esperar a agotar su asignación, desde el Panel Negocio.
- Precio de referencia: $15.000 COP por 100 créditos (configurable por SuperSU, igual que cualquier otro precio de plataforma — ver `01-PRD/03_Monetization.md`, regla de que ningún precio está hardcodeado).
- Los créditos comprados **sí expiran**, pero con una ventana más generosa que los del Plan: 90 días desde la compra (a diferencia de los créditos del Plan, que expiran al cierre del ciclo mensual).
- **Orden de consumo (FIFO por fecha de expiración)**: el sistema consume primero los créditos que expiran antes — normalmente los del Plan del mes en curso, luego los paquetes comprados más antiguos, luego los más recientes. Esto minimiza el desperdicio de créditos por expiración.

### Auditoría

Todo consumo de crédito genera un evento inmutable en `04-Data-Model/04_Audit.md` con: `negocio_id`, `funcion` (una de las listadas arriba), `nivel` (1 o 2), `creditos_consumidos`, `saldo_restante`, `timestamp`. El Admin/Barbería puede ver el detalle completo de consumo por función y por periodo desde el Panel Negocio — el mismo patrón de transparencia que `03-Business-Rules/05_Staff_Rewards.md` exige para el puntaje de Staff (nunca un número sin desglose verificable).

## Estados
Un lote de créditos (`credito_ia`, ya sea de Plan o de paquete comprado) sigue el mismo patrón de `punto_fidelizacion` (`04-Data-Model/01_Entities.md`): `ACTIVO` → `USADO_PARCIAL` → `AGOTADO` / `EXPIRADO`, con consumo FIFO por fecha de expiración.

## Permisos
- Barbería y Guardian (dentro de su sede) ven el consumo de créditos de su alcance.
- Solo Barbería puede comprar un paquete adicional (acción con efecto financiero, restringida igual que cualquier otra decisión de facturación en `03-Business-Rules/01_Roles.md`).
- Solo SuperSU configura el precio de referencia de los paquetes y la asignación mensual por Plan.

## Dependencias
- Depende de: `ADR_001_Monetization_Principles.md`, `01-PRD/03_Monetization.md`, `09-CRM-Intelligence` (las 3 funciones que documenta con detalle funcional), `04-Data-Model/04_Audit.md`.
- De este documento dependen: `09-CRM-Intelligence/02_AI_Client.md`, `03_AI_Staff.md`, `04_AI_Business.md` (deben reflejar el costo en créditos de cada función, ver actualización cruzada en esos documentos), `08-Growth-Monetization/05_Billing_Failures.md` (fallo de cobro de un paquete de créditos sigue el mismo flujo que cualquier `pago`).

## Casos límite

- **Un Negocio Raven (100 créditos/mes) intenta usar la Predicción de ocupación (10 créditos) 11 veces en el mes.** La corrida 11 se bloquea por falta de créditos si ya se consumieron los 100 disponibles en otras funciones — el sistema no reserva créditos por función, es un saldo único compartido entre todas las funciones de Nivel 1 y 2.
- **Un Negocio compra un paquete de 100 créditos el día 20 del mes, y su ciclo de Plan renueva el día 25.** Al renovar el día 25, los créditos del Plan anterior (si quedaban) se pierden, pero los 100 créditos comprados el día 20 siguen activos hasta su propia fecha de expiración (90 días desde la compra), independiente del ciclo de Plan.
- **Allfather con créditos "personalizados" definidos en contrato.** Sigue exactamente el mismo mecanismo de consumo, renovación y auditoría — "personalizado" se refiere solo al número de la asignación, nunca a una excepción al principio de límite (`ADR_001_Monetization_Principles.md` aplica sin excepción, incluido Allfather).
- **Un Negocio degrada de Jarl a Raven (downgrade) a mitad de mes, con créditos de Jarl ya parcialmente usados.** Los créditos ya otorgados en el ciclo actual se mantienen hasta el cierre de ese ciclo (no se recalculan a la baja de inmediato); la nueva asignación de Raven (100) aplica desde el siguiente ciclo de renovación, consistente con la regla general de downgrade de `08-Growth-Monetization/04_Subscriptions_Lifecycle.md` (efectivo al inicio del siguiente ciclo, no inmediato).

## Criterios de aceptación
- [ ] Ninguna función de Nivel 1 o Nivel 2 se ejecuta sin descontar el crédito correspondiente antes de retornar el resultado.
- [ ] Ninguna función de Nivel 0 depende de saldo de créditos, verificable con una prueba que agota el saldo a 0 y confirma que esas funciones siguen operando.
- [ ] Todo consumo de crédito es reconstruible desde `evento_auditoria` con el desglose exacto de función y cantidad.
- [ ] El consumo de créditos nunca deja saldo negativo — al llegar a 0, la siguiente invocación de Nivel 1/2 se rechaza antes de ejecutar la función (nunca se ejecuta y luego se descuenta en negativo).

## Checklist
- [x] Completo
- [ ] Revisado

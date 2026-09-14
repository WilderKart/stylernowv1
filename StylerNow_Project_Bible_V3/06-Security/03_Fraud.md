# 03 — Fraud

## Objetivo
Especificar cómo se detecta y trata el fraude en los tres vectores que la misión identifica explícitamente: reseñas falsas, manipulación del Sistema PRO/EXPERT/MASTER, y fraude de pagos — para que "reseñas fraudulentas" deje de ser una línea suelta en `03-Business-Rules/08_Edge_Cases.md` y se convierta en un protocolo operativo.

## Alcance
Detección, contención y resolución de fraude. No cubre la mecánica de negocio que el fraude explota (ya cubierta en sus documentos respectivos) — este documento define las señales, los umbrales y las acciones de respuesta.

## Reglas

### Vector 1 — Reseñas falsas

**Señales de riesgo (cualquiera de estas activa revisión):**
- Reseña creada sin una `reserva_id` en estado `COMPLETADA` asociada — imposible por diseño (`04-Data-Model/01_Entities.md`, toda reseña referencia una Reserva completada), por lo que este vector queda cerrado estructuralmente, no solo por detección.
- Múltiples reseñas de 5★ creadas por Reservas del mismo `cliente_id` hacia el mismo `negocio_id` en un periodo corto (más de 3 en 30 días desde el mismo Cliente hacia el mismo Negocio).
- Patrón de reseñas idénticas o casi idénticas en texto entre distintos `cliente_id` hacia el mismo Negocio (indicio de cuentas fabricadas).
- Un `cliente_id` cuya única actividad en la plataforma es crear una Reserva mínima (el Servicio más barato posible) seguida inmediatamente de una reseña de 5★, repetido en varios Negocios distintos (indicio de "granja de reseñas").

**Acción:** las reseñas señaladas pasan a `REPORTADA` automáticamente (no `ELIMINADA` directamente — requiere revisión de SuperSU, ver `03-Business-Rules/01_Roles.md`). El Score de Marketplace del Negocio se recalcula excluyendo las reseñas `REPORTADA` mientras se investigan, para no beneficiarse del posible fraude durante la revisión.

### Vector 2 — Manipulación del Sistema PRO/EXPERT/MASTER

**Señales de riesgo:**
- Un Staff con múltiples Reservas donde `cliente_id` corresponde a una cuenta vinculada a él mismo o a otro Staff del mismo Negocio (autorreserva para inflar producción).
- Un patrón de Reservas de duración mínima creadas y marcadas `COMPLETADA` en tiempos irrealmente cortos entre check-in y check-out (menor al mínimo razonable para el Servicio).
- Puntaje de producción que crece muy por encima de la desviación estándar del resto del Staff del mismo Negocio en la misma temporada, sin un correlato de ingresos reales del Negocio (contraste contra `08-Growth-Monetization/02_Commissions.md`, comisión generada).

**Acción:** los eventos de `puntaje_staff_evento` involucrados se revierten con eventos opuestos explícitos (`03-Business-Rules/05_Staff_Rewards.md`, regla de Auditoría); el Nivel del Staff se congela (no puede subir de Nivel) mientras dura la investigación; reincidencia confirmada puede escalar a suspensión del `vinculo_staff_negocio`, decisión de SuperSU en coordinación con la Barbería.

### Vector 3 — Fraude de pagos

**Señales de riesgo:**
- Múltiples `pago` `RECHAZADO` consecutivos desde el mismo medio de pago o dispositivo en un periodo corto (indicio de prueba de tarjetas robadas — "card testing").
- Un mismo Cliente con contracargos (`EN_DISPUTA`) recurrentes en distintos Negocios.
- Un Negocio con una tasa de reembolso (`03-Business-Rules/03_Payment_Rules.md`) anormalmente alta frente al promedio de su categoría (posible lavado a través de reservas y cancelaciones ficticias).

**Acción:** bloqueo temporal automático de nuevos intentos de pago desde el medio/dispositivo señalado (card testing); el caso de contracargos recurrentes de un Cliente se marca para revisión y puede derivar en el mismo tratamiento que un No-show reincidente (`03-Business-Rules/09_No_Show_Policy.md`) más una posible restricción de medios de pago aceptados; un Negocio con tasa de reembolso anómala entra a revisión manual de SuperSU antes de su siguiente ciclo de liquidación del Wallet.

### Principio general de todo el modelo de fraude

Ninguna acción de fraude es completamente automática hacia una sanción permanente — el sistema automatiza la **detección y contención temporal** (congelar, marcar para revisión, excluir del cálculo mientras se investiga); la **sanción definitiva** (eliminar reseña, suspender Staff, suspender Negocio) siempre requiere una decisión humana de SuperSU con motivo auditado, consistente con `03-Business-Rules/01_Roles.md`.

## Estados
Las entidades afectadas (`resena`, `puntaje_staff_evento` vía reversión, `negocio` vía `elegibilidad_marketplace`) usan sus propios estados ya definidos en `04-Data-Model/03_State_Machines.md`; el fraude no introduce una máquina de estados nueva, activa transiciones existentes por una causa específica.

## Permisos
- El sistema (automatizado) puede marcar señales y aplicar contención temporal.
- Solo SuperSU decide la sanción definitiva.
- Una Barbería puede reportar sospecha de fraude (de un Cliente o de un competidor) pero no puede ejecutar ninguna acción de contención él mismo.

## Dependencias
- Depende de: `01_Security_Model.md`, `03-Business-Rules/05_Staff_Rewards.md`, `03-Business-Rules/06_Marketplace_Ads.md`, `03-Business-Rules/03_Payment_Rules.md`, `04-Data-Model/04_Audit.md`.
- De este documento dependen: `08-Growth-Monetization/01_Marketplace_Algorithm.md` (filtro de elegibilidad), `08-Growth-Monetization/06_Advertising_System.md` (pérdida de elegibilidad publicitaria).

## Casos límite

- **Un Cliente genuino deja varias reseñas de 5★ legítimas a distintos Negocios en poco tiempo** (ej. probó varios servicios nuevos en un mes). El umbral de "más de 3 en 30 días hacia el **mismo** Negocio" no se activa por reseñas hacia Negocios distintos — el falso positivo se minimiza por diseño del umbral, no solo por revisión manual.
- **Un Staff genuinamente eficiente completa Servicios más rápido que el promedio sin fraude** (alta habilidad real). La señal de "duración irrealmente corta" se calibra contra el mínimo razonable configurado por Servicio (no un umbral genérico), y activa revisión, no sanción automática — la revisión humana de SuperSU/Barbería es la que distingue habilidad real de fraude, el sistema solo señala.
- **Un Negocio tiene tasa de reembolso alta por una razón legítima** (ej. tormenta que canceló medio día de citas). Es exactamente el tipo de caso para el que existe la revisión manual antes de cualquier sanción — el sistema nunca suspende automáticamente solo por esta señal.

## Criterios de aceptación
- [ ] Ninguna sanción definitiva (eliminar reseña, congelar Nivel, suspender Negocio) ocurre sin una decisión explícita y auditada de SuperSU.
- [ ] Toda señal de riesgo detectada genera un registro consultable, incluso si al final se determina que no hubo fraude (para medir la tasa de falsos positivos del propio modelo con el tiempo).

## Checklist
- [x] Completo
- [ ] Revisado

# 05 — Sistema PRO · EXPERT · MASTER (Staff Rewards)

## Objetivo
Especificar por completo la mecánica de gamificación del Staff — el diferenciador de producto declarado explícitamente en la visión — de modo que su cálculo, temporadas, degradación y beneficios sean auditables e idénticos en toda superficie que los consuma (App Staff, Panel Negocio, Marketplace, comisión).

## Alcance
Cubre exclusivamente el sistema de Nivel del **Staff**. El sistema de fidelización del **Cliente** es un documento distinto (`04_Lealtad.md` — ver `Glossary.md`, no confundir "Punto" de Cliente con "Puntaje" de Staff). Este documento es la única fuente de verdad del cálculo; ninguna otra superficie reimplementa la fórmula (ver ADL-006).

## Reglas

### Niveles y umbrales

| Nivel | Puntaje de temporada requerido |
|---|---|
| **PRO** | 0 – 999 |
| **EXPERT** | 1.000 – 2.999 |
| **MASTER** | 3.000+ |

El Nivel es **por vínculo Staff–Negocio**, no global: un Staff que trabaja en dos Negocios (ver `01_Roles.md`, caso límite) tiene un puntaje y un Nivel independiente en cada uno, porque el desempeño y el contexto (agenda, clientela) son distintos por Negocio.

### Cálculo del puntaje

El puntaje de temporada es la suma de tres categorías, cada una con eventos que suman o restan puntos. Todo evento de puntaje se registra como una fila inmutable de auditoría (ver sección Auditoría) — el puntaje mostrado es siempre la suma de eventos, nunca un contador editable directamente.

#### Producción
| Evento | Puntos |
|---|---|
| Servicio de categoría estándar completado | +10 |
| Servicio de categoría "premium" completado (definido por el Negocio, ej. tratamiento largo o de alto valor) | +25 |
| Servicio complementario dentro de un combo (ej. segundo ítem de un combo) | +8 |
| Combo completo completado | +18 |

*(Nota: los nombres "corte", "barba", "combo", "premium" del set original eran ilustrativos de barbería; aquí se generalizan a categorías de Servicio configurables por el Negocio — ver `04-Data-Model/01_Entities.md`, campo `categoria_puntaje` de Servicio, que el Negocio asigna al crear cada Servicio: `estandar`, `premium`, `complementario`.)*

#### Calidad
| Evento | Puntos |
|---|---|
| Reseña de 5 estrellas recibida | +15 |
| Cliente recurrente (2ª+ Reserva con el mismo Staff) | +12 |
| Referido atribuido a este Staff que completa su primera Reserva | +20 |

#### Puntualidad
| Evento | Puntos |
|---|---|
| Día con 100% de check-ins a tiempo (dentro de 5 min de la hora de inicio) | +5 |
| Semana completa (todos los días trabajados) con 100% de check-ins a tiempo | +40 (bono, no acumulable con los bonos diarios de esa semana además de los +5 diarios — se suma aparte) |

#### Penalizaciones
| Evento | Puntos |
|---|---|
| No-show atribuible al Staff (Staff no se presentó, no el Cliente) | −40 |
| Llegada tarde (check-in más de 5 min después de la hora de inicio) | −10 |
| Queja válida (reportada por Cliente y confirmada por el Negocio tras revisión) | −30 |

El puntaje de un evento nunca lleva el total por debajo de 0 dentro de una temporada (piso en 0, no hay puntaje negativo visible).

### Temporadas

- Una temporada dura **3 meses calendario** (trimestral: Ene–Mar, Abr–Jun, Jul–Sep, Oct–Dic).
- El puntaje se reinicia a 0 al inicio de cada temporada — **no es acumulativo entre temporadas**. El Nivel de un Staff en cualquier momento es el que corresponde a su puntaje acumulado **dentro de la temporada en curso**.
- Excepción: el "Nivel de arranque" de una temporada nueva no es PRO para todos — ver regla de Degradación abajo.

### Degradación

- Al cierre de una temporada, el Nivel alcanzado se registra como el "Nivel consolidado" de esa temporada.
- Al iniciar la temporada siguiente, el Staff **arranca en el Nivel consolidado de la temporada anterior, menos un escalón**, no en PRO desde cero — salvo que ya estuviera en PRO, en cuyo caso arranca en PRO. Esto significa: quien cerró MASTER arranca la temporada siguiente ya en EXPERT (con el puntaje mínimo de ese nivel, 1.000 puntos, como saldo inicial); quien cerró EXPERT arranca en PRO con puntaje inicial 0 más los puntos que gane; quien cerró PRO arranca en PRO con 0.
- Esta regla existe para que un MASTER no pierda todo su estatus de un día para otro por un mes flojo, pero sí sienta presión real de sostener el desempeño (evita tanto el desánimo de "empezar de cero cada trimestre" como la complacencia de "una vez MASTER, siempre MASTER").
- Un Staff puede subir de Nivel **dentro** de una temporada tan pronto su puntaje cruza el umbral (no espera al cierre de temporada) — el Nivel mostrado en tiempo real siempre refleja el puntaje actual.

### Auditoría

- Todo evento que suma o resta puntaje genera una fila inmutable en el log de auditoría (`04-Data-Model/04_Audit.md`) con: `staff_id`, `negocio_id`, `evento`, `puntos_delta`, `referencia` (ej. `reserva_id` que originó el evento), `timestamp`.
- El puntaje mostrado en cualquier superficie es siempre una suma calculada sobre este log, nunca un campo editable manualmente por ningún rol, incluido SuperSU — una corrección de un evento erróneo se hace agregando un evento de reversión igual y opuesto, nunca editando o borrando el evento original.
- La Barbería puede ver el detalle completo del log de su propio Staff; el Staff ve el detalle completo del suyo propio.

### Logros (Achievements)

Insignias no relacionadas con el puntaje de temporada, permanentes una vez obtenidas (no se pierden con la degradación):

| Logro | Condición |
|---|---|
| Racha de Oro | 30 días consecutivos trabajados sin ninguna llegada tarde |
| Favorito del Barrio | 50 Clientes distintos recurrentes de por vida |
| Mentor | Referir a otro Staff que alcanza EXPERT en su primera temporada |
| Fundador | Estar activo en el Negocio desde su primer mes de operación en StylerNow |

### Eventos especiales

- **Doble puntos:** SuperSU puede activar, a nivel plataforma o por ciudad, periodos de doble puntaje (ej. temporada de fin de año) mediante `10-Operations/01_Feature_Flags.md`. Se anuncia con al menos 3 días de anticipación en la App Staff.
- **Reto de Negocio:** la Barbería puede configurar un reto interno con un bono de puntaje adicional propio del Negocio (ej. "+100 puntos al Staff con más combos este mes"), sin afectar el puntaje base de la fórmula de plataforma — se registra como una categoría de evento separada (`bono_negocio`) para no contaminar la comparabilidad del puntaje entre Negocios a nivel plataforma.

### Beneficios por Nivel

#### PRO
- Insignia visible en el perfil del Staff dentro del Marketplace.
- Acceso a cursos de capacitación dentro de la plataforma.
- Perfil destacado dentro del listado interno de Staff del propio Negocio (Panel Negocio).

#### EXPERT
- Todo lo de PRO.
- Mayor visibilidad en el ranking de Staff dentro del perfil público del Negocio en el Marketplace (se listan antes que los PRO, salvo que el Cliente ordene por otro criterio).
- Comisión configurable más alta: el Negocio puede (no está obligado a) asignar un % de comisión de Staff más favorable a EXPERT que a PRO, dentro del rango que permite `08-Growth-Monetization/02_Commissions.md`.
- Acceso a campañas de marketing dirigidas (el Staff puede ser destacado en una campaña de Marketplace Ads del Negocio).

#### MASTER
- Todo lo de EXPERT.
- Prioridad en el algoritmo de asignación `CUALQUIERA_DISPONIBLE` (ver `03-Business-Rules/02_Booking_Rules.md`).
- Prioridad de posicionamiento en el Marketplace: el Score de Marketplace del Negocio recibe un bono si tiene Staff MASTER activo (ver `08-Growth-Monetization/01_Marketplace_Algorithm.md`).
- Insignia dorada visible.
- Acceso anticipado a funcionalidades en beta.
- Elegible para bonificaciones monetarias que el Negocio configure (StylerNow no paga bonificaciones directamente al Staff — es una herramienta que el Negocio activa desde su propio presupuesto).

### Impacto cuantificado en el resto del sistema

| Superficie | Impacto |
|---|---|
| **Marketplace** | El Score de ranking del Negocio (`08-Growth-Monetization/01_Marketplace_Algorithm.md`) incluye un componente "Calidad de Staff" que pondera positivamente tener Staff EXPERT/MASTER activo. |
| **Conversión** | El perfil público de un Staff EXPERT/MASTER muestra su insignia junto al selector de Staff en el flujo de reserva, lo que en pruebas de mercados comparables incrementa la tasa de selección explícita (vs. "cualquiera disponible") — se mide como KPI en `01-PRD/05_KPIs.md`. |
| **Comisión** | El Negocio puede escalonar el % de comisión de Staff por Nivel (nunca la comisión de **plataforma**, que es independiente del Nivel de Staff). |
| **Visibilidad** | Orden de listado dentro del perfil de Negocio y prioridad en `CUALQUIERA_DISPONIBLE`, como se detalla arriba. |

## Estados
El Nivel de un Staff en una temporada es derivado (calculado), no un campo de estado independiente que se transiciona manualmente. Ver `04-Data-Model/03_State_Machines.md` para el ciclo de vida formal de "Temporada" (`EN_CURSO` → `CERRADA` → `CONSOLIDADA`).

## Permisos
- El Staff ve su propio puntaje, Nivel, log de eventos y logros.
- La Barbería ve el puntaje/Nivel de todo su Staff y puede configurar Retos de Negocio y comisión escalonada.
- SuperSU ve agregados de toda la plataforma y activa Eventos especiales globales.
- Nadie, incluido SuperSU, puede editar manualmente un puntaje sin que quede un evento de auditoría explícito.

## Dependencias
- Depende de: `Glossary.md`, `03-Business-Rules/01_Roles.md`, `03-Business-Rules/02_Booking_Rules.md`.
- De este documento dependen: `08-Growth-Monetization/01_Marketplace_Algorithm.md`, `08-Growth-Monetization/02_Commissions.md`, `04-Data-Model/04_Audit.md`, `02-UX/08_Staff_App.md`, `01-PRD/05_KPIs.md`.

## Casos límite

- **Un Staff cambia de Sede dentro del mismo Negocio a mitad de temporada.** El puntaje **no se reinicia** (es por vínculo Staff–Negocio, no por Sede); continúa acumulando en el mismo Negocio.
- **Un Staff se retira y vuelve a unirse al mismo Negocio meses después.** Arranca la temporada en curso con puntaje 0 (no conserva el Nivel consolidado previo si hubo una brecha de inactividad de más de una temporada completa); si vuelve dentro de la misma temporada en que se retiró, conserva el puntaje que tenía al momento de retirarse.
- **Un Staff trabaja en dos Negocios y en uno es MASTER y en otro PRO.** Es válido y esperado — el Nivel es por vínculo Staff–Negocio (ver regla arriba); cada Negocio ve solo su propio cálculo.
- **Se detecta que un evento de puntaje se generó por una Reserva fraudulenta** (ver `06-Security/03_Fraud.md`, ej. autorreserva del Staff para inflar producción). Se revierte con un evento de auditoría opuesto explícito, nunca editando el evento original; si el patrón es reincidente, se activa el protocolo de fraude, que puede incluir congelar el Nivel del Staff mientras se investiga.
- **Un Negocio nuevo no tiene datos suficientes para que su primer Staff alcance ningún Nivel en su primera temporada parcial** (se unió a mitad de trimestre). El puntaje se calcula proporcionalmente sobre los días restantes de la temporada; no hay ajuste especial de umbral — es matemáticamente más difícil llegar a MASTER en una temporada parcial, lo cual es una limitación conocida y aceptada (no se documenta como error).

## Criterios de aceptación
- [ ] El puntaje mostrado en App Staff, Panel Negocio y el cálculo interno de Marketplace son siempre exactamente el mismo número en el mismo instante (una sola fuente de cálculo, sin duplicación de lógica).
- [ ] Ningún puntaje puede quedar negativo ni editarse sin un evento de auditoría correspondiente.
- [ ] La transición de temporada aplica la regla de degradación de un escalón para el 100% del Staff activo, verificable en un corte de fin de trimestre.

## Checklist
- [x] Completo
- [ ] Revisado

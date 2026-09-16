# 03 — Monetization

## Objetivo
Definir cada fuente de ingreso de StylerNow, con límites y precios exactos por Plan, de modo que Producto, Ventas y Finanzas operen sobre el mismo número. Contiene la definición oficial de los 4 Planes (Raven, Jarl, Valhalla, Allfather) — la filosofía y el razonamiento detrás de estos precios vive en `Pricing_Strategy.md`; este documento es la referencia técnica exacta, no repite el razonamiento.

## Alcance
Define **qué** se cobra y **cuánto**, a nivel de Plan y de ingresos adicionales. El **ciclo de vida** de una suscripción (upgrade, downgrade, suspensión, prorrateo) vive en `08-Growth-Monetization/04_Subscriptions_Lifecycle.md`. El reparto de comisión entre plataforma/Negocio/Staff vive en `08-Growth-Monetization/02_Commissions.md`. El principio de que ningún recurso de costo variable se subsidia vive en `ADR_001_Monetization_Principles.md`.

## Reglas

### Planes SaaS oficiales

Todo Negocio pertenece a exactamente un Plan. El Plan determina límites estructurales (Sedes, Staff), créditos de IA (`AI_Credit_System.md`), conversaciones de WhatsApp API (`WhatsApp_Delivery_Engine.md`) y funcionalidades habilitadas.

#### Raven — $69.900 COP/mes

| Límite/Incluye | Valor |
|---|---|
| Sedes | 1 |
| Staff incluido | 1 |
| Staff adicional máximo | 1 (tope absoluto: 2 Staff en total) |
| Precio por Staff adicional | $20.000 COP/mes |
| Créditos IA | 100/mes |
| Conversaciones WhatsApp API | 20/mes |
| Guardian | No disponible |
| Marketplace Ads | No disponible |

Al intentar agregar un **tercer** Staff (superando el tope absoluto de 2), el sistema bloquea la acción con `403 PLAN_LIMIT_EXCEEDED` y ofrece upgrade a Jarl — no existe un "tercer Staff de prueba" ni una excepción temporal.

#### Jarl — $149.900 COP/mes

| Límite/Incluye | Valor |
|---|---|
| Sedes | 1 |
| Staff incluido | 5 |
| Staff adicional | Sin tope superior fijo, cada uno a $20.000 COP/mes |
| Créditos IA | 600/mes |
| Conversaciones WhatsApp API | 100/mes |
| Guardian | Disponible (dentro de su única Sede) |
| Marketplace Ads | Autoservicio, disponible |
| Todo lo de Raven | Incluido |

#### Valhalla — $349.900 COP/mes

| Límite/Incluye | Valor |
|---|---|
| Sedes | Hasta 5 |
| Staff incluido | 10 (total, repartidos entre las sedes activas) |
| Staff adicional | $15.000 COP/mes (más barato que en Jarl — precio de volumen) |
| Sede adicional (sobre la 5ª… en realidad dentro del rango de hasta 5 incluidas — ver nota) | $50.000 COP/mes por sede que exceda las incluidas |
| Créditos IA | 2.500/mes |
| Conversaciones WhatsApp API | 500/mes |
| Guardian | Uno o más por Sede |
| Marketplace Ads | Autoservicio, disponible, con presupuesto multi-sede |
| Todo lo de Jarl | Incluido |

> **Corrección explícita de una decisión previa:** Valhalla **no** incluye 30 Staff — el límite incluido es **10 Staff** en total, expandible con Staff adicional a $15.000 COP/mes. Esta corrección reemplaza cualquier mención anterior de "30 Staff" en cualquier documento de la Biblia (no se encontró ninguna al momento de esta corrección, pero queda registrada aquí para que no se reintroduzca).

#### Allfather — Precio personalizado (cotizado por SuperSU)

| Incluye |
|---|
| Sedes y Staff ilimitados |
| Créditos IA personalizados (definidos en el contrato) |
| Conversaciones WhatsApp API personalizadas |
| Guardian ilimitado |
| **API dedicada** — acceso a endpoints de integración propios (`05-API`), fuera del alcance de la app estándar |
| **SLA de soporte** — tiempo de respuesta garantizado, definido por contrato |
| **SSO** — integración de inicio de sesión único con el proveedor de identidad corporativo del Negocio Allfather |
| **Integraciones a medida** — conectores específicos que StylerNow desarrolla o habilita para ese cliente |
| **White Label parcial** — el Negocio puede aplicar su propia marca (logo, colores) en la Cliente PWA de cara a sus propios Clientes, dentro de los límites que defina el contrato (nunca reemplaza la marca StylerNow en el Marketplace público, solo en la experiencia transaccional directa del Negocio) |

Todo Allfather se gestiona con un contrato individual aprobado y registrado por SuperSU; no existe un flujo de autoservicio para este Plan.

### Regla de límite duro vs. límite blando

- **Límite duro** (Sedes y Staff, en todos los Planes excepto Allfather): al alcanzarlo, la acción de crear una Sede o invitar un Staff adicional que excede el tope se bloquea en la UI y en la API (`403 PLAN_LIMIT_EXCEEDED`) y se ofrece upgrade — salvo que el Plan permita Staff/Sede adicional de pago dentro de su propio rango (ver tablas arriba), en cuyo caso se ofrece el addon antes que el upgrade completo.
- **Límite de consumo variable** (créditos IA, conversaciones WhatsApp): ver `AI_Credit_System.md` y `WhatsApp_Delivery_Engine.md`. Nunca hay consumo ilimitado, consistente con `ADR_001_Monetization_Principles.md`.

### Ingresos adicionales

| Fuente | Descripción | Documento de detalle |
|---|---|---|
| **Marketplace Ads** | Formatos: destacado, pin patrocinado, banner, promoción flash. Autoservicio desde Jarl en adelante. | `08-Growth-Monetization/06_Advertising_System.md` |
| **Comisión por transacción** | % sobre la Seña procesada por la pasarela dentro de la app (ver ADL-005). | `08-Growth-Monetization/02_Commissions.md` |
| **Paquetes de créditos IA** | Compra de créditos adicionales fuera de la asignación mensual del Plan. | `AI_Credit_System.md` |
| **Membresías** | Programa de suscripción del Cliente final hacia un Negocio específico (ej. "3 cortes al mes"), facilitado por la plataforma. | `03-Business-Rules/04_Lealtad.md` |
| **Gift Cards** | Tarjetas de regalo digitales emitidas por un Negocio, vendidas a través de la Cliente PWA. | `03-Business-Rules/03_Payment_Rules.md` |
| **Productos** | Venta de producto físico (ej. cera, shampoo) vía POS del Panel Negocio, sin comisión de plataforma salvo que se venda desde el Marketplace del Cliente. | `02-UX/09_Business_Panel.md` |
| **Cupones patrocinados** | Promociones financiadas parcialmente por marcas de producto (ingreso B2B2C, fuera del alcance de V1, registrado aquí como línea futura). | — (Decisión abierta, ver Casos límite) |

### Prorrateo y facturación

- Cambios de Plan a mitad de ciclo se prorratean por día calendario restante del ciclo de facturación (30 días desde la fecha de alta).
- La facturación es mensual anticipada por defecto; Allfather puede negociar facturación anual con descuento (definido caso a caso por SuperSU, sin regla automática en V1).
- Staff/Sede adicional de pago (addons) se factura en el mismo ciclo que la suscripción base, prorrateado si se agrega a mitad de ciclo.

## Estados
El Plan de un Negocio tiene su propio ciclo de vida completo (`ACTIVO`, `EN_MORA`, `SUSPENDIDO`, `CANCELADO`) — ver `08-Growth-Monetization/04_Subscriptions_Lifecycle.md`.

## Permisos
- Solo **SuperSU** puede crear o modificar la definición de un Plan (precio, límites, funcionalidades).
- **Barbería** puede solicitar upgrade/downgrade de su propio Negocio y agregar Staff/Sede adicional de pago dentro de su Plan; no puede modificar los términos del Plan en sí.

## Dependencias
- Depende de: `01_Product_Vision.md`, `Glossary.md`, `Pricing_Strategy.md`, `ADR_001_Monetization_Principles.md`.
- De este documento dependen: `08-Growth-Monetization/04_Subscriptions_Lifecycle.md`, `08-Growth-Monetization/02_Commissions.md`, `AI_Credit_System.md`, `WhatsApp_Delivery_Engine.md`, `05-API` (endpoints de facturación), `07-QA` (casos de prueba de límites de plan).

## Casos límite

- **Un Negocio Raven con 2 Staff (el máximo absoluto) intenta invitar un tercero.** Bloqueado con `403 PLAN_LIMIT_EXCEEDED`, CTA de upgrade a Jarl — no hay addon de Staff adicional disponible en Raven más allá del único Staff adicional ya incluido en el tope de 2.
- **Un Negocio Valhalla con 5 Sedes activas intenta agregar una 6ª.** Bloqueado — Valhalla tiene un tope duro de 5 Sedes (a diferencia de Staff, que no tiene tope superior dentro del Plan); para más de 5 Sedes, la ruta es Allfather.
- **Un Negocio Valhalla usa solo 3 de sus 5 Sedes incluidas.** No hay reembolso ni prorrateo por Sedes incluidas no utilizadas — el precio base de $349.900 cubre hasta 5 Sedes se usen o no.
- **Un Negocio Jarl agrega su Staff número 6.** Se cobra el addon de $20.000 COP/mes — los primeros 5 están incluidos en el precio base, el 6º en adelante es addon, sin tope superior.
- **Cupones patrocinados por marcas (B2B2C).** Queda registrado como **Decisión abierta**: por defecto, fuera de alcance de V1; se retoma solo si Producto lo prioriza explícitamente en `04_Roadmap.md` de una fase posterior. No se construye infraestructura para esto en V1.
- **Un Negocio Allfather negocia una comisión distinta a la estándar.** Es válido: la comisión de plataforma es configurable por Negocio dentro de un rango que define SuperSU (ver `08-Growth-Monetization/02_Commissions.md`); Allfather puede salirse del rango estándar únicamente mediante configuración explícita de SuperSU, nunca automáticamente.
- **Un Negocio agota sus créditos IA antes de fin de mes.** No degrada a error — cae a Nivel 0 (reglas, sin IA) para las funciones que lo permiten, u ofrece compra de paquete adicional; ver `AI_Credit_System.md` para el detalle completo (este documento no lo repite).

## Criterios de aceptación
- [ ] Todo Negocio tiene un Plan asignado desde el momento de creación (no existe estado "sin plan").
- [ ] Todo límite estructural (Sedes, Staff) se valida tanto en la API como en la UI, y el mensaje de error indica el upgrade o addon necesario.
- [ ] Ningún precio está hardcodeado en el código de la Cliente PWA, Panel Negocio o App Staff — todos se leen desde la configuración gestionada por SuperSU CMS.
- [ ] Valhalla nunca se documenta ni se implementa con un límite de 30 Staff — el límite incluido es 10.

## Checklist
- [x] Completo — planes renombrados y corregidos (Raven/Jarl/Valhalla/Allfather)
- [ ] Revisado

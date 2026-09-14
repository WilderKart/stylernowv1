# ADR-001 — Principios de Monetización: StylerNow Nunca Subsidia Costos Variables

## Estado
Aceptada. Aprobada por decisión explícita del negocio (instrucción directa, no negociable — ver `Architecture_Decision_Log.md`, ADL-010).

## Contexto

StylerNow provee funcionalidades cuyo costo marginal por uso **no es cero** para la plataforma: cada llamada a un modelo de IA cuesta dinero real a un proveedor externo; cada mensaje de WhatsApp Business API cuesta dinero real a Meta/el proveedor de mensajería; cada byte almacenado (fotos de CRM, adjuntos) cuesta dinero real de almacenamiento; cada tarea de procesamiento pesado (recalculo de Score de Marketplace a gran escala, generación de reportes complejos) consume cómputo real.

Un modelo de precios fijo mensual (como Raven a $69.900) que no controle el consumo de estos recursos variables expone a StylerNow a un riesgo financiero directo: un solo Negocio que use IA o WhatsApp de forma intensiva podría costarle a la plataforma más de lo que paga, mes tras mes, sin límite — un modelo insostenible a escala.

## Decisión

**Ningún recurso con costo variable puede consumirse de forma ilimitada en ningún Plan, incluido Allfather** (que tiene límites personalizados por contrato, pero nunca "ilimitados sin definir"). Los cuatro recursos identificados con costo variable directo son:

1. **IA** — cada invocación a un modelo de lenguaje o servicio de IA consume Créditos IA de una asignación mensual fija por Plan. Ver `AI_Credit_System.md` para el diseño completo (asignación, renovación, compra de paquetes adicionales, expiración, auditoría) y `09-CRM-Intelligence` para qué funciones consumen créditos y cuántos.
2. **WhatsApp** — cada mensaje enviado por WhatsApp Business API consume una "conversación" de una asignación mensual fija por Plan. Ver `WhatsApp_Delivery_Engine.md` para el motor de selección de canal que prioriza canales más baratos (Push, Email) antes de recurrir a WhatsApp API, precisamente para proteger esta asignación limitada.
3. **Almacenamiento** — fotos de CRM, adjuntos de tickets de soporte y otros archivos cuentan contra una cuota de almacenamiento por Negocio (definida por Plan; el valor exacto de la cuota es una Decisión abierta de configuración operativa gestionada por SuperSU, no fijada en este documento porque depende de costos de infraestructura que cambian con el proveedor — se documenta el principio, no un número que quedaría obsoleto).
4. **Procesamiento pesado** — operaciones de cómputo intensivo (reportes complejos multi-sede, recálculos masivos) están sujetas a límites de tasa (`05-API/01_Standards.md`, rate limiting) y, para Negocios con uso desproporcionado, a revisión manual de SuperSU antes de imponer un límite específico — no se pre-define un número aquí por la misma razón que el almacenamiento.

### Regla de aplicación

Cuando un Negocio alcanza el límite de un recurso variable dentro de su ciclo de facturación:
- **No se corta el servicio esencial** (Reservas, Pagos, Agenda siguen funcionando siempre, sin excepción — esos no son "recursos variables", son el núcleo transaccional).
- **Se degrada la funcionalidad dependiente del recurso agotado**: sin créditos IA, las funciones de IA caen a su equivalente de Nivel 0 (reglas fijas, sin modelo) cuando existe uno, o se deshabilitan con un mensaje claro cuando no; sin conversaciones de WhatsApp, el motor de entrega usa el siguiente canal disponible según su prioridad (`WhatsApp_Delivery_Engine.md`).
- **Se ofrece una vía de pago inmediata** para superar el límite (compra de paquete de créditos, o upgrade de Plan) sin fricción.

## Consecuencias

**Positivas:**
- El margen de cada Plan es predecible: el costo variable máximo posible por Negocio está acotado por su asignación de créditos/conversaciones, nunca es una variable abierta.
- Un Negocio de alto consumo se convierte en una oportunidad de upsell (compra de paquete o upgrade), no en una pérdida silenciosa.
- El principio es extensible: cualquier recurso nuevo con costo variable que se incorpore en el futuro (ej. un nuevo canal de mensajería, un nuevo tipo de IA) hereda automáticamente esta regla sin necesitar una decisión nueva — la regla es "todo recurso variable tiene un límite por Plan", no una lista cerrada.

**Negativas / Trade-offs aceptados:**
- Un Negocio legítimo con una necesidad puntual de alto consumo (ej. una campaña masiva de WhatsApp en fecha especial) enfrenta fricción si no compra el paquete adicional a tiempo — se acepta este trade-off porque la alternativa (consumo ilimitado) es financieramente insostenible.
- Requiere infraestructura de medición y consumo en tiempo real (contadores de créditos/conversaciones) que agrega complejidad técnica — se acepta porque es la única forma de hacer cumplir el principio de forma verificable, consistente con `04-Data-Model/04_Audit.md` (todo consumo de crédito queda auditado).

## Alternativas consideradas

- **Precio único sin límites de consumo variable, cargando el costo al margen general.** Rechazada: expone a StylerNow a riesgo financiero no acotado por Negocio, y castiga a Negocios de bajo consumo subsidiando a los de alto consumo dentro del mismo Plan.
- **Cobro 100% por uso (pay-as-you-go) sin asignación incluida en el Plan.** Rechazada para V1: genera fricción de facturación variable impredecible para el Negocio, contrario a la simplicidad que un SaaS de suscripción fija busca ofrecer a un dueño de barbería/salón sin experiencia técnica. Se prefiere el modelo híbrido (asignación incluida + paquetes adicionales) documentado arriba.

## Dependencias
- De esta decisión dependen: `AI_Credit_System.md`, `WhatsApp_Delivery_Engine.md`, `01-PRD/03_Monetization.md`, `08-Growth-Monetization/05_Billing_Failures.md` (fallo de cobro de un paquete adicional sigue el mismo flujo que cualquier otro cobro).

## Referencia cruzada
`Architecture_Decision_Log.md`, ADL-010.

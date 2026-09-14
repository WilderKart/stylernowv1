# 04 — Compliance Colombia

## Objetivo
Documentar las obligaciones normativas colombianas que StylerNow debe cumplir desde el primer registro de un usuario, con base legal explícita, consistente con ADL-008 (Colombia es el mercado de lanzamiento; el modelo queda preparado, no cerrado, para expansión regional).

## Alcance
Cumplimiento normativo colombiano: Habeas Data, facturación electrónica, retención fiscal. No cubre normativa de otros países (fuera de alcance mientras StylerNow no opere allí).

## Reglas

### Habeas Data (Ley 1581 de 2012 y Decreto 1377 de 2013)

- **Consentimiento explícito e informado.** Todo Cliente y todo Staff/Barbería acepta una Política de Tratamiento de Datos Personales al registrarse, redactada en lenguaje claro (no solo un checkbox genérico), consistente con `03-Business-Rules/07_CRM.md`, sección de consentimiento.
- **Finalidad específica.** Cada dato capturado tiene una finalidad declarada (ej. teléfono → notificaciones de Reserva; fecha de nacimiento → beneficio de cumpleaños de `03-Business-Rules/04_Loyalty.md`) — no se capturan datos "por si acaso".
- **Derechos ARCO** (Acceso, Rectificación, Cancelación, Oposición): implementados como funcionalidad de producto, no solo como proceso manual de soporte — ver `04-Data-Model/05_Data_Retention.md`, derecho de portabilidad y supresión.
- **Datos sensibles** (salud, biométricos): requieren consentimiento explícito adicional y separado del consentimiento general — aplica, por ejemplo, a notas de preferencia de tipo alergias/condiciones de piel que un Negocio pueda registrar en el CRM (`03-Business-Rules/07_CRM.md`).
- **Registro Nacional de Bases de Datos (RNBD):** StylerNow, como Responsable del Tratamiento de los datos de Cliente, y cada Negocio, como Encargado del Tratamiento de los datos de sus propios Clientes dentro de su CRM particionado, deben considerar su obligación de registro ante la SIC — StylerNow provee la infraestructura que facilita el cumplimiento del Negocio (aislamiento de datos, auditoría), pero la obligación legal de cada Negocio como Encargado es suya, comunicada explícitamente en los Términos del Negocio (documento legal fuera de esta Biblia técnica, pero su existencia es un requisito de producto: el flujo de onboarding de Negocio debe presentarlo).

### Facturación electrónica (DIAN)

- V1 no emite factura electrónica DIAN directamente desde StylerNow por cuenta del Negocio (cada Negocio es responsable de su propia facturación ante sus Clientes finales, fuera del flujo de pago de Seña que StylerNow procesa).
- StylerNow sí emite su propia facturación electrónica DIAN por el cobro de suscripción SaaS y comisión a cada Negocio (StylerNow como proveedor de servicios al Negocio).
- Integración de facturación electrónica DIAN para que el Negocio facture a sus Clientes finales desde la propia plataforma es una funcionalidad candidata de una fase posterior (`01-PRD/04_Roadmap.md`), no un requisito de V1 — se documenta aquí para que no se descubra como sorpresa cuando un Negocio lo solicite.

### Retención fiscal

- Los registros transaccionales (`reserva`, `pago`) se retienen un mínimo de 5 años, alineado con el término general de firmeza de las declaraciones tributarias en Colombia (Estatuto Tributario) — ya reflejado como regla operativa en `04-Data-Model/05_Data_Retention.md`; este documento es la base legal de esa regla, no la repite en detalle técnico.

### Protección de menores de edad

StylerNow no permite el registro de Clientes menores de 18 años como titulares de cuenta (el tratamiento de datos de menores en Colombia exige condiciones reforzadas de consentimiento parental que están fuera de alcance de V1). Un Servicio prestado a un menor se registra bajo la cuenta de un adulto responsable (el titular de la Reserva), nunca bajo una cuenta propia del menor.

## Estados
No aplica — documento normativo, no de entidad transaccional.

## Permisos
SuperSU es responsable de mantener actualizada la Política de Tratamiento de Datos y de gestionar cualquier requerimiento de la SIC. Un Negocio no puede modificar unilateralmente el texto de consentimiento estándar de la plataforma (garantiza consistencia legal), aunque sí puede agregar cláusulas propias adicionales para su relación específica con sus Clientes (ej. política de cancelación propia, que no es un asunto de Habeas Data sino contractual).

## Dependencias
- Depende de: `03-Business-Rules/07_CRM.md`, `04-Data-Model/05_Data_Retention.md`, `01_Security_Model.md`, ADL-008.
- De este documento dependen: `02-UX/02_Onboarding.md` (pantalla de consentimiento), `04-Data-Model/01_Entities.md` (campo `identificacion_fiscal` genérico).

## Casos límite

- **Un Cliente solicita el derecho de oposición al tratamiento de sus datos con fines de marketing (campañas de `09-CRM-Intelligence`) pero quiere seguir usando la app para reservar.** Son consentimientos independientes: el Cliente puede optar por no recibir campañas/recomendaciones de IA sin que eso afecte su capacidad de reservar y pagar (que requiere solo el tratamiento transaccional mínimo).
- **Un Negocio quiere exportar la base de datos completa de sus Clientes para usarla fuera de StylerNow** (ej. migrar a otra herramienta). Es su derecho como Encargado del Tratamiento sobre datos que él mismo generó en su relación directa con esos Clientes — se provee una funcionalidad de exportación del CRM propio del Negocio (`03-Business-Rules/07_CRM.md`), distinta de la portabilidad del Cliente individual.
- **Un menor de edad intenta registrarse.** Se bloquea en el flujo de registro con validación de fecha de nacimiento (si se solicita) o con una declaración de mayoría de edad obligatoria en el registro; no hay verificación de identidad robusta en V1 más allá de la declaración — se documenta como una limitación conocida, no un vacío silencioso.

## Criterios de aceptación
- [ ] Todo flujo de registro presenta la Política de Tratamiento de Datos antes de capturar cualquier dato personal, con aceptación explícita registrada con timestamp.
- [ ] Toda solicitud de derecho ARCO tiene un flujo de producto identificable (no depende exclusivamente de un correo a soporte).
- [ ] Ningún dato sensible se captura sin un consentimiento separado y específico.

## Checklist
- [x] Completo
- [ ] Revisado

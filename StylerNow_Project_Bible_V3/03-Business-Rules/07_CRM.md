# 07 — CRM (Reglas de Negocio)

## Objetivo
Definir qué datos del Cliente captura y expone StylerNow a cada Negocio, y bajo qué reglas, para que el CRM sea un diferenciador real y no una promesa vacía del README. El diseño de producto completo (pantallas, segmentación, IA) vive en `09-CRM-Intelligence/01_CRM_Complete.md`; este documento fija las reglas de negocio y de datos que ese diseño debe respetar.

## Alcance
Reglas de qué constituye el perfil CRM de un Cliente dentro de un Negocio, permisos de acceso y reglas de retención. No cubre los algoritmos de IA (riesgo de abandono, recomendaciones) — eso es `09-CRM-Intelligence`.

## Reglas

### Campos del perfil CRM (por Cliente, por Negocio)

Un Negocio ve, de cada Cliente que lo ha visitado, exclusivamente los datos generados **dentro de su propia relación** con ese Cliente (nunca datos de la actividad del Cliente en otros Negocios):

- **Historial de Reservas** — todas las Reservas del Cliente en ese Negocio, con Servicio, Staff, fecha, monto, estado.
- **Preferencias** — anotadas manualmente por el Negocio (ej. "prefiere silencio", "alérgico a X producto") o inferidas automáticamente (Servicio más reservado, Staff preferido).
- **Fotos** — el Negocio puede adjuntar fotos asociadas a una Reserva completada (ej. resultado de un servicio), con consentimiento explícito del Cliente capturado en el momento de la carga.
- **Cumpleaños** — si el Cliente lo comparte en su perfil de Cliente PWA (opcional, no obligatorio).
- **Notas** — texto libre del Negocio, privado (nunca visible al Cliente ni a otros Negocios).
- **Etiquetas (tags)** — categorías configurables por el Negocio (ej. "VIP", "Sensible al precio", "Puntual") aplicadas manualmente o por regla automática (ver Casos límite).
- **Valor de vida (LTV)** — calculado como se define en `01-PRD/05_KPIs.md`, específico a la relación con ese Negocio.
- **Riesgo de abandono** — score generado por `09-CRM-Intelligence/04_AI_Business.md`, mostrado como nivel (bajo/medio/alto), nunca como un número crudo sin contexto.

### Reglas de aislamiento

Ningún Negocio puede ver el historial de un Cliente en **otro** Negocio, ni exportar datos del Cliente fuera de su relación directa. El Cliente es la entidad global; el perfil CRM es una **vista particionada por Negocio** sobre esa entidad (ver `04-Data-Model/02_Relationships.md`).

### Consentimiento y Habeas Data

Toda captura de dato adicional al mínimo transaccional (fotos, notas de preferencia sensibles tipo salud/alergias) requiere que el Cliente haya aceptado el tratamiento de datos correspondiente, conforme a `06-Security/04_Compliance_Colombia.md`. Un Negocio no puede solicitar datos sensibles (ej. datos de salud) fuera del flujo de consentimiento estándar de la plataforma.

### Segmentación

El Negocio puede crear segmentos de Clientes combinando: etiquetas, rango de LTV, rango de última visita, Servicio favorito, riesgo de abandono. Los segmentos alimentan campañas de notificación (`08-Growth-Monetization`, y `09-CRM-Intelligence/04_AI_Business.md` para sugerencias automáticas de segmento).

## Estados
No aplica una máquina de estados propia al perfil CRM en sí (es una agregación de datos de otras entidades con estado). Las Etiquetas no tienen ciclo de vida (se aplican/remueven libremente).

## Permisos
- Barbería y Guardian (alcance de su Sede) ven el CRM completo de los Clientes atendidos en su Negocio/Sede.
- Staff ve únicamente el historial de los Clientes que **él mismo** ha atendido (no el CRM completo del Negocio), consistente con `03-Business-Rules/01_Roles.md`.
- El Cliente puede ver y solicitar corrección o eliminación de sus propios datos (derecho de Habeas Data), gestionado según `06-Security/04_Compliance_Colombia.md`.

## Dependencias
- Depende de: `Glossary.md`, `03-Business-Rules/01_Roles.md`, `01-PRD/05_KPIs.md`.
- De este documento dependen: `09-CRM-Intelligence/01_CRM_Complete.md`, `06-Security/04_Compliance_Colombia.md`, `04-Data-Model/05_Data_Retention.md`.

## Casos límite

- **Un Cliente solicita eliminar sus datos (derecho de supresión Habeas Data) pero tiene Reservas históricas con transacciones fiscales.** Los datos financieros/fiscales no se eliminan (obligación legal de retención, ver `04-Data-Model/05_Data_Retention.md` y `06-Security/04_Compliance_Colombia.md`); se anonimiza el perfil CRM (nombre, notas, fotos, preferencias) manteniendo el registro transaccional anónimo necesario para contabilidad.
- **Una etiqueta automática ("VIP") se aplica por regla (ej. LTV > $500.000) pero el Cliente ya no cumple la condición tras un reembolso.** Las etiquetas automáticas se recalculan en cada actualización relevante de LTV, no quedan "pegadas" — el Negocio puede sobreescribir con una etiqueta manual si quiere conservar el estatus por una razón cualitativa.
- **Dos Negocios distintos anotan al mismo Cliente con notas contradictorias** (ej. uno dice "puntual", otro "impuntual"). Es válido y esperado — las notas son privadas y particionadas por Negocio, no existe una "verdad única" de comportamiento del Cliente a nivel plataforma.
- **El Staff que atendió a un Cliente deja el Negocio.** El historial de Reservas permanece en el CRM del Negocio (pertenece al Negocio, no al Staff individual); el Staff que se fue pierde acceso a ese historial desde su propia App Staff en otro Negocio.

## Criterios de aceptación
- [ ] Ningún query de CRM puede retornar datos de un Cliente en un Negocio distinto al del usuario que consulta.
- [ ] Toda foto o nota sensible tiene un registro de consentimiento verificable.
- [ ] Una solicitud de supresión de datos anonimiza el perfil sin romper la integridad de registros fiscales retenidos por ley.

## Checklist
- [x] Completo
- [ ] Revisado

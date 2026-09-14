# 01 — CRM Complete

## Objetivo
Especificar el diseño de producto completo del CRM (pantallas, segmentación, interacción) construyendo sobre las reglas de negocio y datos ya fijadas en `03-Business-Rules/07_CRM.md`.

## Alcance
Diseño de producto del CRM dentro del Panel Negocio. Las reglas de negocio, permisos y retención ya están fijadas en `03-Business-Rules/07_CRM.md` y `04-Data-Model/05_Data_Retention.md` — este documento no las repite, las materializa en experiencia.

## Reglas

### Vista de lista de Clientes (ver mockup `B5-Clients`)

Tabla/lista con: foto, nombre, visitas, LTV, última visita, etiquetas. Ordenable por cualquier columna. Búsqueda por nombre/teléfono.

### Vista de detalle de un Cliente

- **Resumen**: LTV, frecuencia de visitas, riesgo de abandono (`04_AI_Business.md`), nivel de fidelización (Puntos actuales).
- **Historial**: cada Reserva pasada con Servicio, Staff, monto, fecha, y acceso a la reseña si dejó una.
- **Preferencias**: campos estructurados (Servicio favorito, Staff preferido — inferidos automáticamente) + campo libre editable por el Negocio.
- **Fotos**: galería de resultados de servicios anteriores (con consentimiento, `03-Business-Rules/07_CRM.md`).
- **Notas**: texto libre privado del Negocio, con fecha y autor (qué Staff/Barbería la escribió).
- **Etiquetas**: chips editables, mezcla de automáticas (ej. "VIP" por regla de LTV) y manuales.

### Segmentación (constructor de segmentos)

Interfaz de filtros combinables (etiqueta + rango de LTV + rango de última visita + Servicio favorito + riesgo de abandono) que genera una lista de Clientes exportable a una campaña de notificación (`02-UX/11_Notifications.md`) o a una recomendación de `04_AI_Business.md`.

### Plantillas de segmento sugeridas por el sistema

Preconfiguradas para reducir fricción: "Clientes inactivos 45+ días", "VIP sin visita reciente", "Cumpleañeros del mes", "Primera visita hace 7 días" (candidatos a pedir reseña).

## Estados
No aplica una máquina de estados propia — el CRM es una vista agregada sobre entidades ya definidas.

## Permisos
Ver `03-Business-Rules/07_CRM.md` — Barbería/Guardian ven CRM completo de su alcance; Staff ve solo sus propios Clientes atendidos.

## Dependencias
- Depende de: `03-Business-Rules/07_CRM.md`, `01-PRD/05_KPIs.md` (fórmula de LTV), `04-Data-Model/05_Data_Retention.md`.
- De este documento dependen: `02_AI_Client.md`, `04_AI_Business.md`, `02-UX/09_Business_Panel.md`, `07-QA/04_Business.md`.

## Casos límite

- **Un segmento generado incluye Clientes cuyo consentimiento de marketing fue retirado** (`06-Security/04_Compliance_Colombia.md`, derecho de oposición). El constructor de segmentos excluye automáticamente a esos Clientes de cualquier exportación hacia campañas — no es una opción, es un filtro obligatorio que no puede desactivarse.
- **Un Cliente aparece con LTV alto pero riesgo de abandono alto simultáneamente** (cliente valioso que dejó de venir). Es exactamente la señal que el segmento "VIP sin visita reciente" está diseñado para capturar — ambos datos coexisten sin contradicción, son dimensiones distintas.
- **El Negocio quiere ver el CRM de un Cliente que nunca completó ninguna Reserva** (solo canceló o tuvo No-show). El perfil existe igual (se genera desde la primera `reserva` creada, sea cual sea su estado final), mostrando su historial completo incluyendo cancelaciones y No-shows como parte de la relación, no solo las visitas exitosas.

## Criterios de aceptación
- [ ] Ningún segmento exportable a campaña incluye un Cliente sin consentimiento de marketing vigente.
- [ ] El LTV mostrado coincide exactamente con la fórmula de `01-PRD/05_KPIs.md`.
- [ ] Un Staff nunca ve, desde ninguna pantalla de CRM, un Cliente que no atendió personalmente.

## Checklist
- [x] Completo
- [ ] Revisado

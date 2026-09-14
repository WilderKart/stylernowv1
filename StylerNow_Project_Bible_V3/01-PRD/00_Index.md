# 00 — Índice de Producto (PRD)

## Objetivo
Servir de mapa de entrada a toda la documentación de producto de StylerNow y de puente hacia el resto de la Biblia.

## Alcance
Cubre la navegación de las 10 carpetas de la Biblia y el orden recomendado de lectura para cada rol. No define reglas de negocio por sí mismo — remite a cada documento especializado.

## Reglas

### Cómo leer esta Biblia

1. **Antes que nada:** `Glossary.md` (terminología oficial) y `Architecture_Decision_Log.md` (decisiones ya tomadas, no las reabras sin una razón nueva).
2. **Producto:** esta carpeta, `01-PRD`.
3. **Experiencia:** `02-UX`.
4. **Reglas del negocio:** `03-Business-Rules` y el documento maestro `Business_Rules_Bible.md`.
5. **Datos:** `04-Data-Model`.
6. **Contratos técnicos:** `05-API`.
7. **Seguridad:** `06-Security`.
8. **Crecimiento y dinero:** `08-Growth-Monetization`.
9. **Inteligencia de producto:** `09-CRM-Intelligence`.
10. **Operación de plataforma:** `10-Operations`.
11. **Calidad:** `07-QA` (se lee al final porque prueba todo lo anterior).

### Mapa de la Biblia

| # | Carpeta | Contenido | Depende de |
|---|---|---|---|
| — | Raíz | Glossary, ADL, Documentation_Standards, Business_Rules_Bible, README | — |
| 01 | PRD | Visión, arquitectura funcional, monetización, roadmap, KPIs | Raíz |
| 02 | UX | Journeys y pantallas de las 4 superficies | 01, 03 |
| 03 | Business-Rules | Roles, reservas, pagos, fidelización, staff, marketplace, CRM, casos límite | 01 |
| 04 | Data-Model | Entidades, relaciones, máquinas de estado, auditoría, retención | 03 |
| 05 | API | Estándares, auth, bookings, payments, marketplace, webhooks | 03, 04 |
| 06 | Security | Modelo de seguridad, RLS, fraude, compliance Colombia | 03, 04 |
| 07 | QA | Estrategia y casos de prueba de las 4 superficies + integraciones | Todo lo anterior |
| 08 | Growth-Monetization | Algoritmo de marketplace, comisiones, propinas, suscripciones, facturación, publicidad | 03, 04 |
| 09 | CRM-Intelligence | CRM completo, IA cliente/staff/negocio | 03, 04 |
| 10 | Operations | Feature flags, migraciones, disaster recovery, logs, release, analítica | 03, 05, 06 |

### Documentos de esta carpeta
- `01_Product_Vision.md` — qué es StylerNow y qué no es.
- `02_Functional_Architecture.md` — las 4 superficies y cómo se relacionan.
- `03_Monetization.md` — planes SaaS e ingresos adicionales.
- `04_Roadmap.md` — fases de entrega.
- `05_KPIs.md` — métricas que definen éxito, con fórmula.

## Estados
No aplica — documento de navegación.

## Permisos
No aplica — de lectura libre para todo el equipo.

## Dependencias
Depende de `Glossary.md` y `Architecture_Decision_Log.md`. Es punto de entrada para todo lo demás.

## Casos límite
- **Un documento nuevo se agrega a la Biblia.** Debe registrarse en esta tabla en el mismo cambio que lo crea; un documento sin entrada aquí se considera huérfano según `Documentation_Standards.md`.

## Criterios de aceptación
- [ ] Un desarrollador nuevo puede, siguiendo el orden de esta página, llegar al documento que responde cualquier pregunta de diseño sin tener que preguntarle a otra persona.
- [ ] La tabla de mapa refleja exactamente las carpetas que existen en el repositorio (ni más, ni menos).

## Checklist
- [x] Completo
- [ ] Revisado

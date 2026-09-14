# Documentation Standards

## Objetivo

Definir cómo se escribe, estructura, versiona y mantiene cada documento de la Biblia del Proyecto, de modo que cualquier persona (o modelo) que agregue o modifique un documento produzca algo consistente con el resto sin tener que redescubrir las convenciones.

## Alcance

Aplica a los 10 carpetas y a los documentos raíz de `StylerNow_Project_Bible_V3`. No aplica al código fuente del producto (que tiene sus propias convenciones, fuera de esta Biblia).

## Reglas

### Estructura obligatoria de todo documento operativo

Todo documento dentro de una carpeta numerada (`01-PRD` … `10-Operations`) debe contener, en este orden, las secciones que apliquen a su naturaleza (un documento puramente conceptual como `01_Product_Vision.md` no tiene "Estados", pero sí debe justificar por qué no aplica):

1. **Objetivo** — para qué existe el documento, en una frase.
2. **Alcance** — qué cubre y qué explícitamente no cubre (y a qué otro documento remite lo que no cubre).
3. **Reglas** — el contenido normativo: la razón de ser del documento.
4. **Estados** (si el dominio tiene entidades con ciclo de vida) — lista de estados posibles y transiciones válidas.
5. **Permisos** (si el dominio tiene acciones restringidas por rol) — quién puede hacer qué.
6. **Dependencias** — qué otros documentos debe leer primero quien implemente esto, y qué documentos dependen de este.
7. **Casos límite** — escenarios no obvios y su resolución explícita (nunca "se definirá después").
8. **Criterios de aceptación** — lista verificable de "esto está bien implementado si…".
9. **Checklist** — `[x] Completo` / `[ ] Revisado`.

### Prohibiciones

- Ningún documento puede contener la frase "esto se definirá después", "TBD", "pendiente de definir" o equivalentes. Si algo genuinamente no se puede decidir todavía, se documenta como una **Decisión abierta** con una recomendación por defecto explícita y se registra en `Architecture_Decision_Log.md` como decisión provisional — nunca se deja un vacío silencioso.
- Ningún documento puede redefinir un término ya definido en `Glossary.md`. Se enlaza, no se repite con matices distintos.
- Ningún documento de negocio asume una sola vertical (ver `Glossary.md`, Regla de oro).

### Idioma

Toda la Biblia se escribe en español (Colombia). Los identificadores técnicos (nombres de campo, endpoints, estados) se escriben en inglés o snake_case técnico cuando así lo exige el estándar de la carpeta correspondiente (`04-Data-Model`, `05-API`), y se explican en español.

### Nomenclatura de archivos

- Dentro de una carpeta numerada: `NN_Nombre_En_Pascal_Con_Guion_Bajo.md`, numeración de dos dígitos empezando en `01`.
- Documentos raíz (fundacionales, transversales): `Nombre_En_Pascal_Con_Guion_Bajo.md`, sin número.
- Carpetas nuevas siguen la numeración general de la Biblia (continúan después de `07-QA`).

### Versionado y cambios

- Un cambio de contenido que **corrige** una regla existente se hace en el mismo archivo, y se agrega una entrada en `Architecture_Decision_Log.md` si el cambio afecta a otros documentos.
- Un cambio que **añade** una regla nueva no listada antes se agrega directamente (esto no es una "corrección", es completar el documento).
- Todo documento que se referencia desde 3 o más documentos distintos requiere una entrada en el ADL cuando cambia su contenido normativo.

### Propiedad

Cada carpeta tiene un dueño funcional implícito por su contenido (no un dueño de código):

| Carpeta | Dueño funcional |
|---|---|
| 01-PRD | CPO |
| 02-UX | Senior UX Architect |
| 03-Business-Rules | Business Analyst + CPO |
| 04-Data-Model | Principal Software Architect |
| 05-API | Solution Architect |
| 06-Security | Security Architect |
| 07-QA | QA Lead |
| 08-Growth-Monetization | Business Analyst + CPO |
| 09-CRM-Intelligence | CPO + Principal Architect |
| 10-Operations | Staff Engineer |

## Estados
No aplica (documento de gobernanza, no de entidad transaccional).

## Permisos
No aplica — este documento es de lectura obligatoria para cualquier rol que edite la Biblia; no hay restricción de escritura dentro del propio proceso documental.

## Dependencias
- Todo documento de la Biblia depende de este para su formato.
- Este documento depende de `Glossary.md` (terminología) y `Architecture_Decision_Log.md` (proceso de cambio).

## Casos límite

- **Un documento necesita una sección que no está en la lista estándar** (ej. una fórmula matemática extensa). Se agrega como subsección dentro de "Reglas", nunca como una sección de primer nivel fuera del estándar, salvo que el documento sea explícitamente un documento "maestro" (`Business_Rules_Bible.md`, `Glossary.md`, `Architecture_Decision_Log.md`, este mismo) que por naturaleza tiene una estructura propia.
- **Dos documentos parecen contradecirse.** Gana el documento de la carpeta con número más bajo en el orden de ejecución definido en `00_AUDIT_REPORT.md` (Sección 6), salvo que exista una entrada del ADL que diga lo contrario explícitamente. La contradicción se corrige de inmediato en el documento de número más alto, nunca se deja para "una revisión posterior".
- **Un documento crece demasiado** (más de ~400 líneas). Se dividen sus subsecciones en un nuevo archivo numerado dentro de la misma carpeta y el original queda como índice con enlaces, no se elimina contenido.

## Criterios de aceptación

- [ ] Todo archivo `.md` de la Biblia contiene las 9 secciones del estándar, o justifica explícitamente cuáles no aplican.
- [ ] Ningún archivo contiene las frases prohibidas.
- [ ] Todo término usado está definido en `Glossary.md` o es evidente por contexto técnico estándar (HTTP, JSON, etc.).
- [ ] Toda decisión que afecta a más de un documento tiene una entrada correspondiente en el ADL.

## Checklist
- [x] Completo
- [ ] Revisado

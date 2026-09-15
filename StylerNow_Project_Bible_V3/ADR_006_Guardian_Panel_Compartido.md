# ADR-006 — Guardian comparte el Panel Negocio con permisos dinámicos

## Estado
Aceptada. Decisión explícita del fundador durante la construcción del Módulo 2.4 (Fase 2 — Dominio Barbería), antes de escribir la Gestión de Staff.

## Contexto

El Panel Negocio (`02-UX/09_Business_Panel.md`) se construyó en los Módulos 2.1-2.3 asumiendo implícitamente que quien entra es siempre la cuenta Barbería (dueño). ADR-002 ya establece que Guardian **no es una cuenta separada** — es un perfil operativo sobre una cuenta Staff existente, con alcance limitado a su `sede_activa` (`03-Business-Rules/01_Roles.md`). Sin embargo, hasta este punto ningún código distinguía en tiempo de ejecución si quien abre el Panel es la Barbería o un Staff con perfil Guardian: las páginas solo verificaban `owner_user_id = auth.uid()`, así que un Guardian no tenía ninguna vista funcional del Panel todavía.

La alternativa obvia — esperar a la Fase 4 (App Staff) para darle a Guardian una superficie propia — contradice ADR-002: Guardian ya está definido como alguien que opera **dentro** del Panel Negocio con alcance de sede, no como un usuario de una app distinta. Construir una segunda aplicación para Guardian duplicaría componentes y crearía dos fuentes de verdad para las mismas pantallas (Agenda, Staff, Servicios, Inventario, CRM) cuando esos módulos se construyan.

## Decisión

**El Panel Negocio es una única superficie compartida entre Barbería y Guardian.** La diferencia de alcance se resuelve exclusivamente mediante:

1. Un resolutor central de contexto de autorización, `resolverContexto()` (`src/lib/auth/resolver-contexto.ts`), que en una sola consulta determina: `rol` (`BARBERIA` | `GUARDIAN` | `NINGUNO`), `negocioId`, `sedeId` (la propia si es Guardian, `null` si es Barbería — significa "todas"), `staffVinculoId`, y un objeto `permisos` explícito por acción.
2. RLS a nivel de base de datos (ya existente desde 006 y 013) como la autoridad real — el resolutor y la UI son una capa de conveniencia sobre esa autoridad, nunca la reemplazan. Ninguna pantalla calcula permisos por su cuenta comparando columnas a mano.
3. Navegación (`PanelNav`) y contenido condicionados por ese mismo `rol`/`permisos` — nunca una segunda copia de un componente con una versión "para Guardian".
4. Ningún cambio de sede (traslado) requiere logout: como `resolverContexto()` consulta la base en cada request (no cachea el alcance en una sesión ni en un claim de JWT), el nuevo alcance aplica en el siguiente request sin ninguna acción del usuario.

Plain Staff (sin perfil Guardian) **no** entra en este ADR — no obtiene acceso al Panel Negocio todavía; su superficie es la App Staff de la Fase 4. Esto es consistente con `01_Roles.md`: el perfil operativo relevante para el Panel es específicamente Guardian, no Staff en general.

### Alcance de Guardian en el Panel (por módulo)

| Módulo | Barbería | Guardian |
|---|---|---|
| Resumen/Dashboard | Todo el negocio | Solo su sede |
| Sedes | Todas — crear, editar, cerrar, eliminar, marcar principal | Solo edición básica y horario/excepciones de **su propia** sede — nunca crear, cerrar, eliminar, marcar principal, ni ver el listado de otras sedes |
| Staff | Todo el negocio — CRUD, trasladar, otorgar/quitar Guardian | Solo su sede — nunca trasladar (acción estructural exclusiva de Barbería, `01_Roles.md`) |
| Servicios / Agenda / CRM / Inventario (módulos futuros) | Todo el negocio | Solo su sede |
| Configuración / Plan / Facturación | Sí | Nunca — oculto de la navegación, no solo deshabilitado |

## Consecuencias

**Positivas:**
- Una sola base de componentes para las 8 secciones del Panel; cada módulo nuevo (Dashboard 2.2, Agenda 2.6, etc.) hereda el mismo mecanismo de alcance sin reconstruirlo.
- El traslado de Staff entre sedes (Módulo 2.3, `trasladar_staff()`) ya cambia el alcance de Guardian de forma automática porque `sede_activa_id` es la fuente viva de verdad — este ADR solo formaliza que la UI debe leer ese mismo campo en cada request, no cachearlo.

**Negativas / Trade-offs aceptados:**
- Cada página del Panel debe llamar a `resolverContexto()` explícitamente (no hay un middleware de Next.js que inyecte esto automágicamente en Server Components sin repetir la llamada) — se acepta esta repetición controlada porque el resolutor mismo es una función pura de una sola fuente, nunca lógica duplicada.
- Los módulos que todavía no existen (Dashboard, Agenda, Servicios, CRM, Inventario) no pueden probarse con Guardian real todavía — este ADR deja el mecanismo listo, cada módulo futuro lo consume al construirse.

## Alternativas consideradas

- **Esperar a la Fase 4 (App Staff) para darle a Guardian cualquier superficie.** Rechazada explícitamente por el fundador: contradice ADR-002 (Guardian opera dentro del Panel Negocio, no en una app de Staff aparte) y hubiera obligado a reconstruir Sedes/Staff/Agenda dos veces.
- **Una segunda copia de cada pantalla ("vista Guardian").** Rechazada: duplica componentes y es exactamente el patrón que ADR-002 evitó al no modelar Guardian como cuenta separada.

## Dependencias
- Depende de: ADR-002 (Guardian como perfil de Staff), `03-Business-Rules/01_Roles.md`, `06-Security/02_RLS.md`, migraciones 006 y 013 (RLS y RPCs de Sedes ya con `is_barberia_de()`/`is_guardian_de_sede()` correctamente separados).
- De esta decisión dependen: todos los módulos restantes de Fase 2 (2.4 en adelante), `02-UX/09_Business_Panel.md`.

## Referencia cruzada
`Architecture_Decision_Log.md`, ADL-011.

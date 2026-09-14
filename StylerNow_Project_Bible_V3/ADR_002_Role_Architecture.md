# ADR-002 — Arquitectura de Roles: 4 Cuentas + Guardian como Perfil de Staff

## Estado
Aceptada. Aprobada por decisión explícita del negocio, ratificada dos veces (corrección inicial y confirmación posterior — ver `Architecture_Decision_Log.md`, ADL-009 y ADL-010).

## Contexto

La primera versión de la Biblia definía 5 roles como cuentas independientes: Cliente, Staff, Manager de Sede, Admin de Negocio, Super Admin. En la práctica operativa de un negocio de citas de belleza/bienestar, el "encargado de sede" casi siempre es un miembro del Staff de confianza (un barbero senior, una estilista líder) al que el dueño le delega supervisión de una sede — no una persona que ingresa al sistema bajo una naturaleza de cuenta distinta. Modelarlo como una cuenta separada duplicaba la identidad de esa persona (¿es Staff o es Manager?) y complicaba la autorización sin reflejar la realidad operativa.

## Decisión

**Solo existen 4 tipos de cuenta en todo el sistema: Barbería, Staff, Cliente, SuperSU.**

**Guardian no es una cuenta.** Es un perfil operativo que la cuenta Barbería otorga o retira sobre una cuenta Staff ya existente. Reglas exactas:

- Guardian pertenece a una Barbería (por herencia de su cuenta Staff subyacente — ver ADL-009, todo Staff pertenece a una única Barbería).
- Guardian pertenece a una única sede a la vez (`sede_activa` / `branch_id`).
- Guardian solo administra su propia sede — nunca otras sedes del mismo negocio, ni aunque exista solo un Guardian en todo el negocio.
- Cuando un Guardian cambia de sede (trasladado por la Barbería): (1) pierde los permisos de la sede anterior, (2) obtiene los permisos de la sede nueva, (3) mantiene íntegro su historial (Reservas atendidas, Nivel PRO/EXPERT/MASTER, Clientes atendidos), (4) queda un registro de auditoría inmutable del traslado.
- Solo la cuenta Barbería puede: asignar el perfil Guardian a un Staff, quitárselo, o trasladar a un Guardian (o a cualquier Staff) de sede. Ningún Guardian puede auto-asignarse el perfil, asignárselo a otro Staff, ni trasladarse a sí mismo.

El detalle operativo completo (máquina de estados, casos límite, integración con RLS) vive en `Guardian_Lifecycle.md` y en `03-Business-Rules/01_Roles.md` (matriz maestra de permisos) — este ADR fija la decisión y su razonamiento, no repite la especificación funcional completa.

## Consecuencias

**Positivas:**
- El modelo de autorización se reduce a 4 reglas de RLS (`user_id`, `staff_id`, `branch_id` condicionado a `es_guardian`, `business_id`) más el acceso total de SuperSU — más simple de implementar y de auditar que 5 cuentas independientes.
- Refleja la realidad operativa: promover o degradar a alguien de "encargado de sede" es una acción de gestión de personal (cambiar un flag), no una migración de cuenta con reautenticación distinta.
- El historial, Nivel PRO/EXPERT/MASTER y relación con Clientes de una persona nunca se fragmentan entre una identidad "Staff" y una identidad "Manager" separadas — siempre es la misma cuenta Staff.

**Negativas / Trade-offs aceptados:**
- No existe (deliberadamente) un "Guardian multi-sede" — si un negocio quiere que una persona supervise varias sedes a la vez, esa persona debe operar como Barbería (compartiendo la cuenta de titularidad, un proceso administrativo explícito fuera de este modelo), no como una variante ampliada de Guardian. Se acepta esta restricción para mantener la matriz de permisos simple y sin una quinta gradación de alcance.
- Un Staff nunca tiene vínculos activos simultáneos con más de una Barbería (corrección adicional de ADL-009) — un profesional freelance que trabaja para dos negocios distintos en la vida real debe elegir una relación activa a la vez en el sistema. Se documenta como limitación conocida de V1, candidata a revisión en una fase posterior si el negocio lo prioriza.

## Alternativas consideradas

- **Mantener Manager de Sede como cuenta independiente, con su propio flujo de login.** Rechazada: duplica identidad, complica RLS con una regla más, y no refleja que la persona sigue siendo, en esencia, Staff.
- **Permitir múltiples niveles de Guardian (sede única, multi-sede, regional).** Rechazada para V1: sobre-ingeniería para el tamaño de negocio objetivo (barberías/salones/spas independientes o de pocas sedes); si surge la necesidad real, se aborda con una entrada nueva del ADL, no de forma preventiva.

## Dependencias
- De esta decisión dependen: `03-Business-Rules/01_Roles.md`, `Guardian_Lifecycle.md`, `Staff_Transfer_Workflow.md`, `06-Security/02_RLS.md`, `Glossary.md`, `04-Data-Model/01_Entities.md`.

## Referencia cruzada
`Architecture_Decision_Log.md`, ADL-009 (corrección original) y ADL-010 (ratificación y consolidación en ADR formal).

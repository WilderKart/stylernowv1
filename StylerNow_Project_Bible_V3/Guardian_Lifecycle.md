# Guardian Lifecycle

## Objetivo
Especificar en profundidad el ciclo de vida completo del perfil Guardian — asignación, operación, traslado, y retiro — como expansión de las reglas ya fijadas en `03-Business-Rules/01_Roles.md` y `ADR_002_Role_Architecture.md`. Este documento es el detalle operativo; los otros dos son la decisión y la matriz de permisos, no se repiten aquí.

## Alcance
El ciclo de vida del flag `es_guardian` y del campo `sede_activa_id` sobre un `vinculo_staff_negocio` ya `ACTIVO`. No cubre el ciclo de vida del vínculo Staff–Barbería en sí (`INVITADO`→`ACTIVO`→`SUSPENDIDO`/`RETIRADO`, ya cubierto en `04-Data-Model/03_State_Machines.md`) — Guardian es un flag independiente de ese ciclo, como ya establece ADR-002.

## Reglas

### Precondiciones para asignar el perfil Guardian

Un Staff debe cumplir, en el momento de la asignación:
1. Su `vinculo_staff_negocio` está en estado `ACTIVO` (no `INVITADO`, no `SUSPENDIDO`).
2. Tiene una `sede_activa_id` válida asignada (no puede otorgarse Guardian a un Staff sin sede — el perfil no tiene sentido sin un alcance de sede sobre el cual operar).
3. El Plan del Negocio permite Guardian (Jarl y superiores — `01-PRD/03_Monetization.md`; Raven no incluye este perfil).

### Asignación (promoción)

Ejecutada exclusivamente por la cuenta Barbería (`03-Business-Rules/01_Roles.md`, matriz — "Convertir en Guardian" es 🌐 solo Barbería). Efecto inmediato:
- `es_guardian` pasa de `false` a `true` sobre el `vinculo_staff_negocio`.
- El alcance de permisos del Staff en los módulos de `03-Business-Rules/01_Roles.md` pasa de 🔒 (solo su propio recurso) a 🏢 (toda su `sede_activa_id`) en cada módulo donde la matriz lo define.
- Se emite un evento de auditoría inmutable: `accion = GUARDIAN_ASIGNADO`, `actor_tipo = BARBERIA`, `staff_id`, `sede_activa_id` en el momento de la asignación, `timestamp`.
- La sesión activa del Staff (si existe) no obtiene el nuevo alcance automáticamente — debe re-emitirse un token nuevo (logout/login, o refresh forzado) para que el claim `es_guardian` se refleje, consistente con `06-Security/02_RLS.md`.
- El Nivel PRO/EXPERT/MASTER, el puntaje de la temporada en curso, y el historial de Clientes atendidos permanecen exactamente iguales — la asignación de Guardian no interactúa con `03-Business-Rules/05_Staff_Rewards.md` en absoluto.

### Operación (mientras el perfil está activo)

- Todo alcance 🏢 que el Guardian ejerce se valida en cada request contra su `sede_activa_id` **vigente en ese momento** (no la que tenía al momento de la asignación) — si fue trasladado desde entonces, el alcance sigue automáticamente a la nueva sede.
- Un Guardian puede ejercer simultáneamente sus permisos de Staff (🔒, sobre sus propios recursos) y sus permisos de Guardian (🏢, sobre toda su sede) sin fricción de cambio de contexto — a diferencia del cambio de contexto entre Negocios distintos (`05-API/02_Auth.md`), esto es el mismo negocio y la misma sesión.
- Un Guardian nunca obtiene, por ejercer el perfil, acceso a otra sede del mismo Negocio, ni siquiera temporalmente — no existe una función de "ver otra sede en modo lectura" para Guardian; eso es exclusivo de Barbería (🌐).

### Traslado de un Staff con perfil Guardian

Ejecutado exclusivamente por Barbería (`03-Business-Rules/01_Roles.md` — "Cambiar sede (traslado)" es 🌐 solo Barbería). Secuencia exacta:
1. Barbería selecciona el Staff (con o sin perfil Guardian activo) y la sede destino.
2. El sistema valida que la sede destino pertenece al mismo `negocio_id` (nunca se traslada a un Staff fuera de su Barbería — eso sería un vínculo nuevo, no un traslado).
3. `sede_activa_id` se actualiza a la sede destino.
4. Si el Staff tenía `es_guardian = true`, el flag se conserva (el traslado no quita el perfil Guardian por sí solo — son dos acciones independientes que Barbería puede combinar o no).
5. Se fuerza expiración del access token vigente del Staff (`06-Security/02_RLS.md`, caso límite ya documentado), para que ningún token emitido con la `sede_activa_id` anterior siga otorgando alcance 🏢 sobre la sede antigua.
6. Se emite evento de auditoría: `accion = STAFF_TRASLADADO`, `sede_origen_id`, `sede_destino_id`, `es_guardian` (estado del flag al momento del traslado), `actor_tipo = BARBERIA`, `timestamp`.
7. El historial completo del Staff (Reservas, puntaje, Clientes atendidos) permanece intacto y asociado a su `staff_id`, independiente de la sede — consistente con `03-Business-Rules/05_Staff_Rewards.md` (el puntaje es por Negocio, no por Sede).

Ver también `Staff_Transfer_Workflow.md` para el flujo operativo completo de traslado (incluye Staff sin perfil Guardian, que sigue exactamente los pasos 1-3 y 5-7 de arriba, omitiendo el paso 4 porque no aplica).

### Retiro del perfil Guardian (degradación)

Ejecutado exclusivamente por Barbería. Efecto inmediato:
- `es_guardian` pasa de `true` a `false`.
- El alcance de permisos vuelve a 🔒 (solo sus propios recursos) de inmediato — sin periodo de gracia.
- Se fuerza revocación de la sesión activa del Staff (no solo expiración del access token — el refresh token también se invalida, para que no pueda simplemente renovar y conservar el claim antiguo), consistente con `06-Security/02_RLS.md`.
- Se emite evento de auditoría: `accion = GUARDIAN_RETIRADO`, `staff_id`, `sede_activa_id` al momento del retiro, `motivo` (campo de texto libre opcional que Barbería puede completar, no obligatorio a diferencia de una suspensión disciplinaria — retirar el perfil Guardian no implica necesariamente una falta), `actor_tipo = BARBERIA`, `timestamp`.
- El Nivel PRO/EXPERT/MASTER, el puntaje y el historial permanecen exactamente iguales — mismo principio que la asignación.
- El Staff conserva su `vinculo_staff_negocio` en `ACTIVO` y su `sede_activa_id` sin cambios — retirar el perfil Guardian nunca traslada de sede ni suspende el vínculo; son acciones completamente independientes.

## Estados

`es_guardian` no es una máquina de estados con transiciones nombradas — es un flag booleano con dos transiciones posibles (`false→true`: asignación; `true→false`: retiro), ambas ejecutables un número ilimitado de veces sobre el mismo `vinculo_staff_negocio` mientras esté `ACTIVO`. No existe un estado intermedio "pendiente de aprobación" — la asignación y el retiro son efectivos de inmediato al ser ejecutados por Barbería, sin flujo de aprobación adicional.

## Permisos
Exclusivo de la cuenta Barbería para asignar, retirar o trasladar. El propio Staff/Guardian no tiene ninguna acción sobre su propio perfil Guardian (no puede renunciar a él ni solicitarlo — es una decisión unilateral de gestión de personal de Barbería, consistente con `03-Business-Rules/01_Roles.md`, Principios de arquitectura, punto 5).

## Dependencias
- Depende de: `03-Business-Rules/01_Roles.md`, `ADR_002_Role_Architecture.md`, `06-Security/02_RLS.md`, `04-Data-Model/03_State_Machines.md`.
- De este documento dependen: `Staff_Transfer_Workflow.md`, `02-UX/09_Business_Panel.md` (pantalla de gestión de Staff donde Barbería ejecuta estas acciones), `07-QA/04_Business.md`.

## Casos límite

- **Barbería intenta asignar Guardian a un Staff en estado `INVITADO` (aún no aceptó su invitación).** Bloqueado — la precondición de `vinculo_staff_negocio = ACTIVO` no se cumple; la UI ni siquiera ofrece la opción hasta que el Staff acepte.
- **Barbería quita el perfil Guardian mientras ese usuario tiene una sesión activa ejecutando una acción de alcance 🏢** (ej. a mitad de editar el horario de la sede). La acción en curso se invalida en el servidor en el siguiente request, no se completa "porque ya había empezado" — la revocación es inmediata y sin excepción, ya documentado como caso límite en `06-Security/02_RLS.md`.
- **Un Negocio hace downgrade de Jarl a Raven mientras tiene Staff con perfil Guardian activo.** Raven no soporta Guardian (`01-PRD/03_Monetization.md`). El downgrade se bloquea hasta que Barbería retire el perfil Guardian de todo su Staff — mismo patrón que el bloqueo de downgrade por exceso de Sedes/Staff en `08-Growth-Monetization/04_Subscriptions_Lifecycle.md`.
- **Barbería asigna Guardian a un Staff, lo traslada de sede el mismo día, y luego le retira el perfil — las 3 acciones en menos de un minuto.** Todas son válidas y se ejecutan en orden; el log de auditoría conserva los 3 eventos completos e inmutables, sin importar cuán rápido ocurrieron.

## Criterios de aceptación
- [ ] Ninguna asignación, traslado o retiro de Guardian ocurre sin generar su evento de auditoría correspondiente.
- [ ] Ningún Staff con `es_guardian = true` puede ejercer alcance 🏢 sobre una sede distinta a su `sede_activa_id` vigente.
- [ ] Un retiro de Guardian revoca el acceso de alcance 🏢 en la siguiente request, no al expirar el token por tiempo.
- [ ] Ningún Negocio en Plan Raven tiene un Staff con `es_guardian = true`, verificado como invariante de datos.

## Checklist
- [x] Completo
- [ ] Revisado

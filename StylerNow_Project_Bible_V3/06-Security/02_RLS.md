# 02 — Row Level Security (RLS)

## Objetivo
Traducir la matriz de roles (`03-Business-Rules/01_Roles.md`) en políticas de acceso a nivel de fila de base de datos, de modo que el aislamiento multi-tenant (ADL-004) sea una garantía de la base de datos, no una promesa de la capa de aplicación.

## Alcance
Diseño de políticas RLS por entidad. No incluye sintaxis SQL específica de un motor (eso es implementación); especifica la condición lógica que cada política debe implementar.

## Reglas

### Principio general (corregido, ver ADL-009)

Toda política de RLS de StylerNow implementa exactamente las 5 reglas de `03-Business-Rules/01_Roles.md`, sección "Reglas obligatorias para Backend (RLS)":

- **Cliente**: `user_id = current_user_id()` — acceso únicamente a sus propios recursos.
- **Staff**: `staff_id = current_user_id()` — acceso a sus propios recursos y a los Clientes que él mismo atendió.
- **Guardian**: `branch_id = current_sede_activa()` — una función que lee el claim `sede_activa` del token, **solo** cuando el claim `es_guardian = true` está presente. Un Staff sin perfil Guardian nunca obtiene este alcance, sin importar su `branch_id`.
- **Barbería**: `business_id = current_business_id()` — una función que lee el claim `business_id` del token (equivalente al `negocio_id` interno).
- **SuperSU**: acceso total, condicionado a que la sesión esté en modo impersonación auditado cuando el acceso es a datos internos de una Barbería específica, o sea una operación de plataforma explícita.

### Políticas por entidad (resumen normativo)

| Entidad | Política de lectura | Política de escritura |
|---|---|---|
| `negocio` | Pública (datos de perfil de Marketplace) para `estado = ACTIVO`; completo solo para su propio `business_id` | Solo `business_id = current_business_id()` con cuenta Barbería |
| `sede`, `servicio`, `recurso` | Pública para datos de Marketplace de Negocios `ACTIVO`; completo solo `business_id = current_business_id()` | Barbería: `business_id = current_business_id()` (todas las sedes); Guardian: además exige `branch_id = current_sede_activa()` para acciones de alcance 🏢 (ver matriz de `03-Business-Rules/01_Roles.md`) |
| `staff`, `vinculo_staff_negocio` | Barbería: `business_id = current_business_id()`; Guardian: `branch_id = current_sede_activa()`; Staff: solo su propia fila (`staff_id = current_user_id()`) | Barbería gestiona el vínculo completo (invitar, trasladar, otorgar/quitar Guardian, suspender); el propio Staff solo escribe su `disponibilidad`/`bloqueo_ausencia`; Guardian escribe horarios de otro Staff de su sede |
| `reserva` | `user_id = current_user_id()` (Cliente) O `staff_id = current_user_id()` (Staff, solo las propias) O `branch_id = current_sede_activa()` (Guardian) O `business_id = current_business_id()` (Barbería) | Cliente crea/cancela solo las propias; Staff hace check-in/check-out solo de las propias; Guardian gestiona toda su sede; Barbería gestiona todo su negocio |
| `pago`, `propina` | Deriva del alcance de la `reserva` asociada | Solo mediante los endpoints de `05-API/04_Payments.md`, nunca escritura directa fuera de esos flujos controlados |
| `punto_fidelizacion` | `user_id = current_user_id()` (Cliente) O `business_id = current_business_id()` (Barbería) | Solo por proceso de sistema (otorgamiento/expiración) o canje iniciado por el propio Cliente |
| `puntaje_staff_evento` | `staff_id = current_user_id()` (Staff, el propio) O `branch_id = current_sede_activa()` (Guardian, de su sede) O `business_id = current_business_id()` (Barbería) | Solo por proceso de sistema (generación de eventos), nunca por escritura directa de ningún rol de producto |
| `resena` | Pública para `estado = VISIBLE`; el Cliente ve las propias en cualquier estado | Cliente crea la propia (una por Reserva); SuperSU modera (cambia `estado`) |
| `evento_auditoria` | `business_id = current_business_id()` (Barbería, alcance de su Negocio) o `staff_id = current_user_id()` (Staff, sus propios eventos de puntaje) o `branch_id = current_sede_activa()` (Guardian); completo solo SuperSU | Solo por proceso de sistema, nunca escritura de producto directa |
| Configuración de plataforma (`plan`, comisión global, ciudades habilitadas) | Pública para valores que afectan la UI del Cliente (ej. lista de planes); completo solo SuperSU | Solo SuperSU |

### Regla de Cliente global vs. particionado

A diferencia de las entidades de Negocio, `cliente` no tiene `business_id` propio (es una entidad global, ver `Glossary.md`). Su política de RLS es distinta: el propio Cliente ve/edita su perfil completo (`user_id = current_user_id()`); una Barbería nunca lee la tabla `cliente` directamente — accede a los datos del Cliente únicamente a través de la vista particionada de CRM (`03-Business-Rules/07_CRM.md`), que en la práctica es una política de RLS sobre una vista/join limitado a los campos y al `cliente_id` que tiene al menos una `reserva` con ese `business_id`.

### Regla de precedencia entre Guardian y Barbería

Un mismo usuario Staff con perfil Guardian nunca tiene, por ese perfil, alcance `business_id` (🌐) — solo `branch_id` (🏢). Si el mismo negocio necesita que una persona vea/opere todas las sedes, esa persona debe operar con la cuenta Barbería, no con un perfil Guardian ampliado — no existe una variante "Guardian multi-sede" en el modelo corregido (ver `03-Business-Rules/01_Roles.md`, Principios de arquitectura, punto 5).

### Verificación continua

Toda migración de esquema que agregue una tabla nueva debe declarar explícitamente su política de RLS **antes** de habilitarse en producción — no existe una tabla de dominio sin política declarada ("RLS por defecto denegado", nunca "RLS por defecto abierto").

## Estados
No aplica — RLS es un mecanismo de acceso, no una entidad.

## Permisos
Este documento **es** la implementación de permisos a nivel de datos; deriva de `03-Business-Rules/01_Roles.md` sin redefinirlo.

## Dependencias
- Depende de: `03-Business-Rules/01_Roles.md`, `04-Data-Model/02_Relationships.md`, `05-API/02_Auth.md`, `01_Security_Model.md`.
- De este documento dependen: la implementación de base de datos (fuera de la Biblia), `07-QA` (pruebas de fuga de datos cross-tenant son obligatorias).

## Casos límite

- **Un Staff con perfil Guardian es trasladado de sede.** El claim `sede_activa` del token cambia en la siguiente emisión de token (`05-API/02_Auth.md`); hasta que eso ocurra, un token ya emitido con la `sede_activa` anterior no debe seguir otorgando acceso `branch_id` a la sede antigua — se fuerza la expiración del access token vigente al momento del traslado (`04-Data-Model/04_Audit.md`, evento de traslado).
- **Un Staff pierde el perfil Guardian mientras tiene una sesión activa.** El claim `es_guardian` del token deja de estar presente en la siguiente emisión; el acceso de alcance 🏢 debe revocarse de inmediato, no esperar a que el access token expire por tiempo — se fuerza revocación de sesión en el mismo evento de degradación (`03-Business-Rules/01_Roles.md`, Reglas especiales de herencia).
- **Una migración de datos histórica (script de mantenimiento) necesita leer across-tenant por una razón operativa legítima** (ej. recalcular un KPI agregado de plataforma). Se ejecuta con un rol de servicio de infraestructura que bypassa RLS explícitamente y de forma auditada a nivel de infraestructura (fuera de las políticas de rol de producto) — nunca usando las credenciales de un usuario de producto, ni siquiera SuperSU.
- **Se detecta en una auditoría de seguridad que una tabla nueva se desplegó sin política de RLS declarada.** Se trata como incidente de seguridad (`01_Security_Model.md`) de severidad alta, se bloquea el acceso a esa tabla inmediatamente hasta declarar la política, y se documenta en el `Architecture_Decision_Log.md` como una lección aprendida de proceso.

## Criterios de aceptación
- [ ] Toda tabla de dominio tiene una política de RLS activa antes de su primer despliegue a producción, sin excepciones.
- [ ] Una prueba automatizada de "fuga cross-tenant" (intentar leer datos de un `negocio_id` distinto al del token) falla consistentemente con acceso denegado, para cada entidad de la tabla de arriba.

## Checklist
- [x] Completo
- [ ] Revisado

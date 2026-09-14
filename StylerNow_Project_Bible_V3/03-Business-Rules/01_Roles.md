# 01 — Roles (Matriz Maestra de Permisos)

## Objetivo
Definir, sin ambigüedad, los **4 tipos de cuenta reales** del sistema y sus permisos exactos por módulo, para que ninguna superficie (`02-UX`), ninguna política de RLS (`06-Security/02_RLS.md`) ni ningún endpoint (`05-API`) inventen una regla de acceso no prevista aquí. Esta es la versión corregida y definitiva del modelo de roles — sustituye por completo al modelo anterior de 5 roles con "Manager de Sede" como cuenta independiente (ver ADL-009).

## Alcance
Cubre las 4 cuentas del sistema (Cliente, Staff, Barbería, SuperSU), el perfil operativo Guardian (una promoción de Staff, no una cuenta), y la matriz completa de permisos por módulo de producto. No cubre autenticación (`05-API/02_Auth.md`) ni la implementación técnica de RLS (`06-Security/02_RLS.md`), que consumen este documento como fuente.

## Reglas

### Principios de arquitectura

1. **Solo existen 4 tipos de cuenta**: Barbería, Staff, Cliente y SuperSU.
2. **Guardian es un perfil operativo del Staff, no una cuenta independiente.** Un usuario con perfil Guardian sigue siendo, en todo lo demás, una cuenta Staff: conserva su `staff_id`, su historial, su Nivel PRO/EXPERT/MASTER — únicamente gana un conjunto de permisos adicional con alcance de sede.
3. **Todo Staff pertenece a una única Barbería.** A diferencia del modelo anterior (que permitía a un Staff tener vínculos activos con más de un Negocio simultáneamente), en el modelo corregido un Staff tiene una sola relación de empleo activa a la vez. Ver ADL-009 para el detalle de esta corrección y su impacto.
4. **Todo Staff tiene una sede activa** (`branch_id`), incluido el Staff con perfil Guardian, cuyo alcance de permisos de sede se calcula exactamente sobre esa `branch_id` activa (`sede_activa`).
5. **El rol Barbería es el único que puede administrar su negocio y trasladar personal entre sedes.** Ninguna acción estructural (crear/eliminar sede, invitar/remover Staff, otorgar/quitar el perfil Guardian, trasladar Staff entre sedes) está disponible para Guardian — Guardian opera dentro de su sede, nunca sobre la estructura del negocio.
6. **SuperSU no tiene restricciones** y posee acceso total a toda la plataforma, incluidos los datos de todas las Barberías.

> **Nota de nomenclatura del rol "Barbería":** el nombre del rol usa la palabra "Barbería" por decisión de producto para el MVP, aunque la plataforma es multi-vertical desde el día uno (`01-PRD/01_Product_Vision.md`). La entidad de datos subyacente sigue siendo genérica (`negocio`/`business_id`, ver `Glossary.md`) — "Barbería" es únicamente la etiqueta de rol/cuenta que ve un dueño de negocio de cualquier vertical (salón, spa, estudio de tatuajes, etc.) en la UI y en esta matriz. Esta es una excepción deliberada y acotada a la etiqueta del rol, no una reversión del principio de `Glossary.md` de no nombrar entidades de datos por vertical.

### Las 4 cuentas + 1 perfil operativo

| Cuenta/Perfil | Se asigna a nivel de | Es una cuenta independiente |
|---|---|---|
| **Cliente** | Usuario global (no atado a una Barbería) | Sí |
| **Staff** | Usuario dentro de una única Barbería | Sí |
| **Guardian** | Perfil operativo otorgado a un Staff, con alcance de su `sede_activa` | **No** — es un perfil sobre una cuenta Staff existente |
| **Barbería** | Usuario dueño de un Negocio | Sí |
| **SuperSU** | Usuario de plataforma StylerNow (interno) | Sí |

### Jerarquía de autoridad

```
SuperSU  (acceso total a toda la plataforma)
   │
Barbería  (acceso total a su propio negocio — todas sus sedes)
   │
Guardian  (perfil de Staff con acceso a su sede activa)
   │
Staff  (acceso a sus propios recursos)
   │
Cliente  (acceso a sus propios recursos, sin jerarquía sobre nadie)
```

### Leyenda de permisos

| Símbolo | Significado |
|---|---|
| ✅ | Permitido |
| 🔒 | Solo su propio recurso |
| 🏢 | Solo su sede (`sede_activa` / `branch_id`) |
| 🌐 | Todas las sedes del negocio (`business_id`) |
| 👑 | Acceso total |
| ❌ | No permitido |

### Matriz maestra de permisos

#### Marketplace
| Acción | Cliente | Staff | Guardian | Barbería | SuperSU |
|---|:---:|:---:|:---:|:---:|:---:|
| Buscar negocios | ✅ | ✅ | ✅ | ✅ | 👑 |
| Ver promociones | ✅ | ✅ | ✅ | ✅ | 👑 |
| Ver reseñas | ✅ | ✅ | ✅ | ✅ | 👑 |
| Compartir negocio | ✅ | ✅ | ✅ | ✅ | 👑 |
| Guardar favoritos | ✅ | 🔒 | 🔒 | 🔒 | 👑 |
| Crear anuncios | ❌ | ❌ | ❌ | 🌐 | 👑 |
| Moderar Marketplace | ❌ | ❌ | ❌ | ❌ | 👑 |

#### Perfil del Usuario
| Acción | Cliente | Staff | Guardian | Barbería | SuperSU |
|---|:---:|:---:|:---:|:---:|:---:|
| Editar perfil | 🔒 | 🔒 | 🔒 | 🔒 | 👑 |
| Cambiar contraseña | 🔒 | 🔒 | 🔒 | 🔒 | 👑 |
| Configurar notificaciones | 🔒 | 🔒 | 🔒 | 🔒 | 👑 |
| Ver actividad | 🔒 | 🔒 | 🔒 | 🌐 | 👑 |

#### Reservas
| Acción | Cliente | Staff | Guardian | Barbería | SuperSU |
|---|:---:|:---:|:---:|:---:|:---:|
| Crear reserva | ✅ | 🔒 | 🏢 | 🌐 | 👑 |
| Reprogramar | 🔒 | 🔒 | 🏢 | 🌐 | 👑 |
| Cancelar | 🔒 | 🔒 | 🏢 | 🌐 | 👑 |
| Confirmar asistencia (check-in) | 🔒 | 🔒 | 🏢 | 🌐 | 👑 |
| Ver detalle | 🔒 | 🔒 | 🏢 | 🌐 | 👑 |
| Reasignar profesional | ❌ | ❌ | 🏢 | 🌐 | 👑 |
| Crear lista de espera | 🔒¹ | ❌ | 🏢 | 🌐 | 👑 |

¹ El Cliente crea/se une a su propia entrada de Lista de espera (`03-Business-Rules/10_Waitlist_System.md`); Guardian/Barbería pueden además anotar manualmente a un Cliente (ej. reserva telefónica) dentro de su alcance.

#### Agenda
| Acción | Cliente | Staff | Guardian | Barbería | SuperSU |
|---|:---:|:---:|:---:|:---:|:---:|
| Ver agenda propia | ❌ | 🔒 | 🔒 | 🌐 | 👑 |
| Ver agenda completa (de la sede) | ❌ | ❌ | 🏢 | 🌐 | 👑 |
| Bloquear horario propio | ❌ | 🔒 | 🏢 | 🌐 | 👑 |
| Desbloquear horario | ❌ | ❌ | 🏢 | 🌐 | 👑 |
| Configurar vacaciones | ❌ | 🔒 | 🏢 | 🌐 | 👑 |

#### Servicios
| Acción | Cliente | Staff | Guardian | Barbería | SuperSU |
|---|:---:|:---:|:---:|:---:|:---:|
| Ver servicios | ✅ | ✅ | ✅ | 🌐 | 👑 |
| Crear servicio | ❌ | ❌ | ❌ | 🌐 | 👑 |
| Editar duración | ❌ | ❌ | 🏢 | 🌐 | 👑 |
| Activar/Desactivar | ❌ | ❌ | 🏢 | 🌐 | 👑 |
| Cambiar precio | ❌ | ❌ | ❌ | 🌐 | 👑 |

#### Gestión del Staff
| Acción | Cliente | Staff | Guardian | Barbería | SuperSU |
|---|:---:|:---:|:---:|:---:|:---:|
| Ver compañeros | ❌ | 🏢 | 🏢 | 🌐 | 👑 |
| Invitar Staff | ❌ | ❌ | ❌ | 🌐 | 👑 |
| Convertir en Guardian | ❌ | ❌ | ❌ | 🌐 | 👑 |
| Quitar perfil Guardian | ❌ | ❌ | ❌ | 🌐 | 👑 |
| Cambiar sede (traslado) | ❌ | ❌ | ❌ | 🌐 | 👑 |
| Suspender Staff | ❌ | ❌ | ❌ | 🌐 | 👑 |
| Eliminar acceso | ❌ | ❌ | ❌ | 🌐 | 👑 |
| Cambiar horarios de otro Staff | ❌ | ❌ | 🏢 | 🌐 | 👑 |

#### Gestión de Sedes
| Acción | Cliente | Staff | Guardian | Barbería | SuperSU |
|---|:---:|:---:|:---:|:---:|:---:|
| Ver sede | 🔒 | 🏢 | 🏢 | 🌐 | 👑 |
| Crear sede | ❌ | ❌ | ❌ | 🌐 | 👑 |
| Editar sede | ❌ | ❌ | 🏢 | 🌐 | 👑 |
| Cerrar temporalmente | ❌ | ❌ | 🏢 | 🌐 | 👑 |
| Eliminar sede | ❌ | ❌ | ❌ | 🌐 | 👑 |

#### Clientes (CRM)
| Acción | Cliente | Staff | Guardian | Barbería | SuperSU |
|---|:---:|:---:|:---:|:---:|:---:|
| Ver historial propio | 🔒 | ❌ | ❌ | ❌ | 👑 |
| Ver historial de Cliente atendido | ❌ | 🔒 | 🏢 | 🌐 | 👑 |
| Agregar notas | ❌ | 🔒 | 🏢 | 🌐 | 👑 |
| Etiquetar clientes | ❌ | ❌ | 🏢 | 🌐 | 👑 |
| Exportar clientes | ❌ | ❌ | ❌ | 🌐 | 👑 |

#### Finanzas
| Acción | Cliente | Staff | Guardian | Barbería | SuperSU |
|---|:---:|:---:|:---:|:---:|:---:|
| Ver Wallet | 🔒 | 🔒 | 🔒 | 🌐 | 👑 |
| Ver ingresos personales | ❌ | 🔒 | 🔒 | ❌ | 👑 |
| Ver ingresos de sede | ❌ | ❌ | 🏢 | 🌐 | 👑 |
| Ver ingresos globales | ❌ | ❌ | ❌ | 🌐 | 👑 |
| Configurar comisiones | ❌ | ❌ | ❌ | 🌐 | 👑 |
| Solicitar retiro | ❌ | 🔒 | 🔒 | 🌐 | 👑 |
| Descargar reportes | ❌ | ❌ | 🏢 | 🌐 | 👑 |

#### Inventario
| Acción | Cliente | Staff | Guardian | Barbería | SuperSU |
|---|:---:|:---:|:---:|:---:|:---:|
| Ver inventario | ❌ | ❌ | 🏢 | 🌐 | 👑 |
| Registrar salida | ❌ | ❌ | 🏢 | 🌐 | 👑 |
| Registrar entrada | ❌ | ❌ | 🏢 | 🌐 | 👑 |
| Solicitar reposición | ❌ | ❌ | 🏢 | 🌐 | 👑 |
| Configurar reglas | ❌ | ❌ | ❌ | 🌐 | 👑 |

> El módulo de Inventario aparece en esta matriz de permisos porque el negocio lo requiere, pero **no tiene todavía un documento de reglas de negocio ni modelo de datos propio** en la Biblia — es una Decisión abierta registrada en ADL-009: se especificará como módulo completo (entidades, reglas, estados, API) en una fase posterior, priorizada en `01-PRD/04_Roadmap.md`. Esta matriz fija sus permisos por adelantado para que, cuando se construya, no requiera revisar el modelo de roles.

#### Publicidad y Marketing
| Acción | Cliente | Staff | Guardian | Barbería | SuperSU |
|---|:---:|:---:|:---:|:---:|:---:|
| Ver campañas | ❌ | ❌ | 🏢 | 🌐 | 👑 |
| Crear campaña | ❌ | ❌ | ❌ | 🌐 | 👑 |
| Activar anuncios | ❌ | ❌ | ❌ | 🌐 | 👑 |
| Administrar presupuesto | ❌ | ❌ | ❌ | 🌐 | 👑 |

Ver `08-Growth-Monetization/06_Advertising_System.md` para el detalle completo de este módulo.

#### Fidelización
| Acción | Cliente | Staff | Guardian | Barbería | SuperSU |
|---|:---:|:---:|:---:|:---:|:---:|
| Ver puntos (Cliente) / Ver Nivel (Staff) | 🔒 | 🔒 | 🔒 | 🌐 | 👑 |
| Canjear beneficios | 🔒 | ❌ | ❌ | 🌐 | 👑 |
| Configurar recompensas | ❌ | ❌ | ❌ | 🌐 | 👑 |
| Ver niveles PRO/EXPERT/MASTER de todo el Staff | ❌ | ❌ | 🏢 | 🌐 | 👑 |

#### Configuración del Negocio
| Acción | Cliente | Staff | Guardian | Barbería | SuperSU |
|---|:---:|:---:|:---:|:---:|:---:|
| Editar datos generales | ❌ | ❌ | ❌ | 🌐 | 👑 |
| Cambiar horarios globales | ❌ | ❌ | 🏢¹ | 🌐 | 👑 |
| Configurar políticas (cancelación, Seña) | ❌ | ❌ | ❌ | 🌐 | 👑 |
| Configurar métodos de pago | ❌ | ❌ | ❌ | 🌐 | 👑 |
| Configurar planes (elegir/solicitar cambio) | ❌ | ❌ | ❌ | 🌐 | 👑 |

¹ Guardian solo edita el horario base de su propia sede, nunca de otra sede del negocio.

#### Soporte
| Acción | Cliente | Staff | Guardian | Barbería | SuperSU |
|---|:---:|:---:|:---:|:---:|:---:|
| Crear ticket | 🔒 | 🔒 | 🔒 | 🔒 | 👑 |
| Ver ticket propio | 🔒 | 🔒 | 🔒 | 🔒 | 👑 |
| Responder ticket propio | 🔒 | 🔒 | 🔒 | 🔒 | 👑 |
| Gestionar todos los tickets | ❌ | ❌ | ❌ | ❌ | 👑 |

#### Administración Global (exclusivo SuperSU)
| Acción | Cliente | Staff | Guardian | Barbería | SuperSU |
|---|:---:|:---:|:---:|:---:|:---:|
| CMS global | ❌ | ❌ | ❌ | ❌ | 👑 |
| Moderar contenido | ❌ | ❌ | ❌ | ❌ | 👑 |
| Gestionar planes SaaS | ❌ | ❌ | ❌ | ❌ | 👑 |
| Feature Flags | ❌ | ❌ | ❌ | ❌ | 👑 |
| Auditoría global | ❌ | ❌ | ❌ | ❌ | 👑 |
| Configuración del sistema | ❌ | ❌ | ❌ | ❌ | 👑 |

### Reglas especiales de herencia de permisos

> El resumen normativo de esta sección es la fuente de la regla; el detalle operativo completo (flujo paso a paso, resolución de Reservas en conflicto, estructura exacta de los eventos de auditoría, casos límite adicionales) vive en `Guardian_Lifecycle.md` (asignación/retiro del perfil Guardian) y `Staff_Transfer_Workflow.md` (traslado entre sedes, válido para cualquier Staff con o sin Guardian) — no se duplica aquí.

#### Traslado de Staff (incluye Staff con perfil Guardian)

Cuando la Barbería traslada un Staff a otra sede:
1. Cambia `branch_id` (su `sede_activa`).
2. Se revocan automáticamente todos los permisos asociados a la sede anterior — incluido, si tenía perfil Guardian, el alcance 🏢 sobre la sede anterior.
3. Se otorgan los permisos de la nueva sede — si conserva el perfil Guardian, su alcance 🏢 pasa a ser la nueva `sede_activa` de inmediato.
4. Se mantiene íntegro el historial del empleado (Reservas atendidas, puntaje PRO/EXPERT/MASTER, Clientes atendidos — ver `03-Business-Rules/05_Staff_Rewards.md`, que ya establecía que el puntaje es por Negocio, no por Sede).
5. Se registra un evento de auditoría inmutable (`04-Data-Model/04_Audit.md`) con la sede anterior, la sede nueva, y el actor (Barbería) que ejecutó el traslado.

#### Promoción a Guardian

Cuando la Barbería otorga el perfil Guardian a un Staff:
- El Staff conserva su cuenta (mismo `staff_id`, mismo login).
- Conserva íntegro su historial.
- Conserva su Nivel (PRO, EXPERT o MASTER) sin ningún cambio — el perfil Guardian no otorga ni quita puntaje.
- Únicamente cambia su conjunto de permisos: pasa de alcance 🔒 (solo sus propios recursos) a alcance 🏢 (toda su `sede_activa`) en los módulos donde la matriz de arriba lo define.
- Se registra evento de auditoría.

#### Degradación de Guardian (quitar el perfil)

Si la Barbería le retira el perfil Guardian a un Staff:
- Vuelve automáticamente a los permisos estándar de Staff (alcance 🔒).
- Mantiene íntegro su historial.
- Mantiene su Nivel PRO/EXPERT/MASTER sin cambios.
- Pierde inmediatamente los permisos administrativos de alcance 🏢 — no hay periodo de gracia; la pérdida de acceso es efectiva en el mismo instante de la degradación.
- Se registra evento de auditoría.

### Reglas obligatorias para Backend (RLS)

Esta matriz se traduce en autorización de datos exactamente así (implementación completa en `06-Security/02_RLS.md`):

- **Cliente**: acceso únicamente a sus propios recursos (`user_id`).
- **Staff**: acceso a sus propios recursos y a los Clientes que él mismo atendió (`staff_id`).
- **Guardian**: acceso únicamente a recursos donde `branch_id = sede_activa` del propio usuario.
- **Barbería**: acceso a todos los recursos donde `business_id = negocio` del propio usuario.
- **SuperSU**: acceso total, sin restricciones.

## Estados
El perfil Guardian sobre un `vinculo_staff_negocio` tiene su propio campo de estado (`es_guardian: boolean`, con `sede_activa` como el `branch_id` vigente) — ver `04-Data-Model/01_Entities.md` y `04-Data-Model/03_State_Machines.md`. El ciclo de vida del vínculo Staff-Barbería en sí (`INVITADO` → `ACTIVO` → `SUSPENDIDO`/`RETIRADO`) es independiente del perfil Guardian: un Staff puede ganar o perder el perfil Guardian múltiples veces mientras su vínculo permanece `ACTIVO`.

## Permisos
Este documento **es** la fuente de la matriz de permisos; no depende de otro documento para definirla.

## Dependencias
- Depende de: `01-PRD/02_Functional_Architecture.md`, `Glossary.md`, ADL-009, `ADR_002_Role_Architecture.md`.
- De este documento dependen: `06-Security/02_RLS.md` (implementación), `05-API/02_Auth.md` (scopes de token), todas las carpetas de `02-UX`, `04-Data-Model/01_Entities.md` (campos `sede_activa`/`es_guardian`), `Guardian_Lifecycle.md`, `Staff_Transfer_Workflow.md`.

## Casos límite

- **Un Staff con perfil Guardian es trasladado a una sede donde ya hay otro Guardian.** Ambos pueden coexistir — no hay límite de un solo Guardian por sede; es una decisión operativa de la Barbería cuántos Guardian asigna por sede.
- **La Barbería quita el perfil Guardian mientras ese usuario tiene una acción de alcance 🏢 en curso** (ej. a mitad de editar el horario de la sede). La acción en curso se invalida en el servidor en el siguiente request (la sesión no "hereda" permisos ya revocados); el cliente debe re-autenticar el alcance, consistente con `05-API/02_Auth.md`.
- **Un Staff con perfil Guardian es promovido a Barbería** (caso de negocio de 1 persona que crece y transfiere la titularidad, o un Guardian de confianza que compra o hereda el negocio). No es una "promoción" automática dentro de este modelo — requiere que la Barbería actual transfiera explícitamente la titularidad de la cuenta Barbería, un proceso administrativo distinto de otorgar/quitar el perfil Guardian, y se documenta como Decisión abierta de proceso operativo (fuera de alcance de V1 automatizarlo; se gestiona manualmente vía soporte/SuperSU si ocurre).
- **La Barbería elimina su propia cuenta mientras es la única cuenta Barbería del negocio.** Bloqueado: el sistema exige transferir la titularidad a otro usuario antes de permitir la baja, para que el negocio nunca quede sin cuenta Barbería — consistente con la regla ya establecida para "Admin de Negocio" en versiones previas de este documento.
- **SuperSU necesita revisar el negocio de una Barbería sospechosa de fraude.** Usa el modo impersonación auditado (ver Modo impersonación más abajo), nunca acceso directo silencioso.
- **Un Staff sin perfil Guardian intenta acceder a un endpoint de alcance 🏢 manipulando su token o payload.** Bloqueado en el servidor por RLS (`06-Security/02_RLS.md`), no solo oculto en la UI.

### Modo impersonación (SuperSU)

SuperSU puede entrar temporalmente al contexto de una Barbería específica para dar soporte. Reglas:
- Requiere selección explícita de la Barbería y motivo (texto libre obligatorio).
- Genera un evento de auditoría inmutable visible para la Barbería afectada.
- Expira automáticamente a los 30 minutos de inactividad.
- No puede usarse para modificar comisión, Plan o datos financieros de la Barbería — solo para diagnóstico y soporte operativo (agenda, Reservas, Staff). Cambios financieros requieren acción explícita desde el propio SuperSU CMS, no desde dentro de la impersonación.

## Criterios de aceptación
- [ ] Cada endpoint de `05-API` tiene un rol/alcance mínimo requerido que coincide exactamente con esta matriz.
- [ ] Ninguna pantalla de `02-UX` muestra una acción que el rol/perfil activo no puede ejecutar según esta tabla (se oculta, no se deshabilita sin explicación).
- [ ] Toda acción de impersonación, traslado, promoción o degradación de Guardian genera un evento de auditoría verificable.
- [ ] Ningún documento de la Biblia usa "Manager de Sede" como nombre de cuenta independiente (término retirado, ver ADL-009).

## Checklist
- [x] Completo — versión corregida
- [ ] Revisado

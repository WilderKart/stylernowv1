# Glossary — Definiciones Oficiales de StylerNow

## Objetivo

Fijar el significado único y obligatorio de cada término del sistema. Ningún documento de esta Biblia puede usar un término definido aquí con un significado distinto. Si un documento necesita un matiz adicional, debe enlazar a esta entrada y añadir el matiz, nunca redefinir.

## Alcance

Aplica a los 4 productos (Cliente PWA, Panel Negocio, App Staff, SuperSU), a las 10 carpetas de la Biblia, al modelo de datos, a la API y a QA. Todo nombre de tabla, endpoint, estado o caso de prueba debe usar la terminología de este documento.

## Regla de oro

**StylerNow es multi-vertical desde el día uno.** Ningún término oficial puede nombrar una vertical específica (ej. "barbero", "corte de pelo", "silla de barbería"). Los ejemplos de barbería que aparecen en otros documentos son ilustrativos, no normativos.

---

## Entidades núcleo

### Negocio
Cuenta tenant de StylerNow. Es la unidad de facturación SaaS (tiene un Plan) y la unidad de aislamiento de datos (RLS particiona por `negocio_id`). Un Negocio puede operar en cualquier vertical de belleza/bienestar/cuidado personal (barbería, salón, spa, estudio de tatuajes, etc.) o combinar varias ("multi-servicio"). Un Negocio tiene una o más Sedes.

### Sede
Ubicación física operativa de un Negocio (una dirección, un horario base, una zona horaria). Un Negocio en plan Raven o Jarl tiene exactamente 1 Sede; un Negocio en plan Valhalla o Allfather tiene 2 o más. Toda Reserva pertenece a exactamente una Sede.

### Staff
**Término genérico y obligatorio** para cualquier persona que presta un Servicio dentro de un Negocio: barbero, estilista, manicurista, lashista, tatuador, masajista, esteticista, entrenador de grooming, etc. Ningún documento, tabla, endpoint o pantalla puede usar "barbero" como nombre de entidad — "barbero" es, como mucho, un valor del campo `especialidad` de un Staff. Un Staff pertenece a **una única** Barbería (ver ADL-009) y tiene una `sede_activa` (`branch_id`) y un `nivel` (ver Sistema PRO/EXPERT/MASTER).

### Guardian
**No es una cuenta independiente.** Es un perfil operativo que la cuenta Barbería otorga o retira sobre una cuenta Staff existente. Un Staff con perfil Guardian conserva su identidad, historial y Nivel PRO/EXPERT/MASTER sin cambios, y gana permisos de alcance 🏢 (toda su `sede_activa`) en los módulos definidos por `03-Business-Rules/01_Roles.md`. Corresponde al rol que en una versión anterior de esta Biblia se llamaba, incorrectamente, "Manager de Sede" como cuenta independiente — ver ADL-009.

### Cliente
Usuario final que descubre Negocios, agenda Reservas y paga a través de la Cliente PWA. Un Cliente puede reservar en cualquier Negocio de la plataforma (no está atado a uno).

### SuperSU
Rol de plataforma (no de Negocio) que opera el SuperSU CMS: aprueba/suspende Negocios, configura comisión de plataforma, modera reseñas, gestiona Planes y Publicidad a nivel red. Acceso total sin restricciones (👑). Antes referido como "Super Admin" — ver ADL-009.

### Barbería
Rol/cuenta del dueño de un Negocio (antes referido como "Admin de Negocio" — ver ADL-009). El nombre de este rol usa la palabra "Barbería" como decisión de producto para el MVP; la entidad de datos subyacente (`negocio`) sigue siendo genérica y multi-vertical (ver `03-Business-Rules/01_Roles.md`, nota de nomenclatura). Acceso total (🌐) a todas las Sedes de su propio Negocio.

### Servicio
Unidad de trabajo que un Negocio ofrece y un Cliente puede reservar (ej. "Corte clásico", "Manicure semipermanente", "Sesión de tatuaje pequeño"). Tiene duración, precio base y, opcionalmente, un Recurso requerido.

### Recurso
Activo físico limitado que un Servicio puede requerir además del Staff: una silla, una camilla, una cabina de tatuaje, una cama de masaje. Existe para que negocios donde el cuello de botella no es el Staff sino el espacio físico (ej. un spa con 3 camillas y 5 masajistas) puedan modelar su capacidad real. Ver `04-Data-Model/01_Entities.md`.

### Reserva
Instancia transaccional central del sistema: un Cliente + un Servicio (o combo de Servicios) + un Staff (o "el primero disponible") + una Sede + un rango horario + un Recurso (si aplica). Tiene una máquina de estados propia (ver `04-Data-Model/03_State_Machines.md`).

### No-show
Estado de una Reserva confirmada en la que el Cliente no se presentó y no canceló dentro de la ventana permitida. Ver `03-Business-Rules/09_No_Show_Policy.md`.

### Lista de espera (Waitlist)
Mecanismo por el cual un Cliente se registra para un horario/Staff que hoy está lleno y es notificado automáticamente si se libera un cupo. Ver `03-Business-Rules/10_Waitlist_System.md`.

### Punto
Unidad de fidelización otorgada a un Cliente por completar Reservas, dejar reseñas, referir, etc. Distinto de los puntos del Sistema PRO/EXPERT/MASTER, que aplican a Staff, no a Cliente. Ver `03-Business-Rules/04_Lealtad.md`.

### Nivel (Staff)
Posición de un Staff en el Sistema PRO / EXPERT / MASTER, calculada por producción, calidad y puntualidad. Ver `03-Business-Rules/05_Staff_Rewards.md`.

### Marketplace
Superficie de descubrimiento pública dentro de la Cliente PWA donde los Negocios compiten por visibilidad mediante un Score (ver `08-Growth-Monetization/01_Marketplace_Algorithm.md`).

### Wallet
Billetera interna asociada a un Negocio (saldo de comisiones, reembolsos pendientes, créditos publicitarios) y, opcionalmente, a un Cliente (crédito por cancelaciones, referidos). No es un medio de pago externo: es un saldo contable dentro de StylerNow que se puede aplicar a cobros futuros o solicitar en retiro (Negocio) según reglas de `08-Growth-Monetization/02_Commissions.md`.

### Plan
Nivel de suscripción SaaS de un Negocio: Raven, Jarl, Valhalla, Allfather. Define límites (Sedes, Staff, Servicios) y funcionalidades habilitadas. Ver `08-Growth-Monetization/04_Subscriptions_Lifecycle.md`.

### Comisión
Porcentaje que StylerNow retiene sobre una transacción (seña o pago completo procesado en la plataforma). Configurable por SuperSU a nivel plataforma y, dentro de ese máximo, por Negocio hacia su Staff. Ver `08-Growth-Monetization/02_Commissions.md`.

### Propina (Tip)
Monto opcional que un Cliente añade a favor de un Staff específico. Ver `08-Growth-Monetization/03_Tips_Distribution.md`.

### Seña (Deposit)
Monto parcial cobrado al Cliente al confirmar una Reserva, para reducir el riesgo de No-show. Se descuenta del total a pagar en Sede.

---

## Cuentas y perfiles del sistema

Solo existen **4 cuentas reales**. Guardian es un perfil, no una cuenta (ver ADL-009).

| Cuenta / Perfil | Superficie | Alcance de datos |
|---|---|---|
| Cliente | Cliente PWA | Sus propias Reservas, su propio perfil, su Wallet (`user_id`) |
| Staff | App Staff | Sus propios recursos y los Clientes que él mismo atendió (`staff_id`) |
| Staff con perfil **Guardian** | App Staff / Panel Negocio (alcance de sede) | Todo lo de su `sede_activa` (`branch_id`) |
| **Barbería** | Panel Negocio | Todo su Negocio, todas las Sedes (`business_id`) |
| **SuperSU** | SuperSU CMS | Toda la plataforma, sin restricciones |

Matriz completa de permisos: `03-Business-Rules/01_Roles.md`.

## Convenciones de nombres obligatorias

- Toda entidad de negocio se nombra en español dentro de la documentación (`Negocio`, `Reserva`, `Staff`) y en `snake_case` singular en el modelo de datos (`negocio`, `reserva`, `staff`).
- Los identificadores de estado se escriben en `SCREAMING_SNAKE_CASE` (ej. `PENDIENTE_PAGO`, `CONFIRMADA`, `NO_SHOW`).
- Nunca se usa "barbero", "corte", "silla" como nombre de campo, tabla, endpoint o estado. Solo como valor de dato o como ejemplo ilustrativo explícitamente marcado como tal.

## Checklist
- [x] Completo
- [ ] Revisado

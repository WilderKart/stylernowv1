# 02 — Onboarding

## Objetivo
Especificar las pantallas y reglas de onboarding para los tres tipos de cuenta que se dan de alta en StylerNow: Cliente, Staff (por invitación) y Negocio.

## Alcance
Flujos de primer uso hasta que la cuenta queda operativa. No cubre autenticación técnica (`05-API/02_Auth.md`) ni el detalle de cada pantalla posterior al onboarding (documentos siguientes de esta carpeta).

## Reglas

### Onboarding de Cliente (Cliente PWA)

1. **Splash/Slides de valor** (3 pantallas, ver mockup `C1-Onboarding`): reserva en 60 segundos, paga tu seña y evita perder el turno, gana puntos.
2. **Registro/Login**: celular (OTP) o email, o continuar con Google (ver mockup `C2-Login`).
3. **Consentimiento de datos**: Política de Tratamiento de Datos (`06-Security/04_Compliance_Colombia.md`), aceptación obligatoria antes de continuar.
4. **Permiso de ubicación** (opcional, mejora el Marketplace "cerca de mí" — `03-Business-Rules/06_Marketplace_Ads.md`); si se rechaza, el Cliente puede buscar por ciudad/dirección manualmente, el flujo no se bloquea.
5. **Permiso de notificaciones** (opcional, recomendado explícitamente porque los recordatorios reducen No-show — `03-Business-Rules/09_No_Show_Policy.md`); si se rechaza, el Cliente ve un recordatorio en pantalla dentro de la app en su próxima apertura, sin push.
6. Aterriza en Home (Marketplace).

### Onboarding de Staff (por invitación)

1. Recibe invitación por email/SMS con link único de un solo uso, expira en 7 días.
2. Si no tiene cuenta StylerNow: crea cuenta (mismo flujo de Registro que Cliente, comparten identidad — ver `05-API/02_Auth.md`).
3. Si ya tiene cuenta (ej. ya es Cliente): solo confirma la aceptación de la invitación con su sesión existente.
4. Completa perfil de Staff: foto, bio, especialidad (ver `Glossary.md`).
5. El vínculo pasa a `ACTIVO` (`03-Business-Rules/01_Roles.md`) tras la aceptación; la Barbería/Guardian configura su disponibilidad y Servicios asignados por separado (no bloquea la activación del vínculo).
6. Aterriza en App Staff, agenda del día (vacía si aún no tiene disponibilidad configurada, con mensaje explicativo).

### Onboarding de Negocio (wizard, ver mockup `B1-Onboarding`)

Wizard de 4 pasos obligatorios, con progreso guardado entre pasos (la Barbería puede cerrar y continuar después):

1. **Datos del negocio**: nombre, categoría(s) — selección múltiple entre las 10 verticales de `01-PRD/01_Product_Vision.md`, logo, contacto.
2. **Sedes**: al menos 1 Sede obligatoria (dirección, horario base). Sedes adicionales según el Plan elegido.
3. **Servicios y precios**: al menos 1 Servicio obligatorio para poder enviar a aprobación.
4. **Invitar barberos/Staff** (paso opcional para continuar — un Negocio de 1 persona puede completar el onboarding sin invitar a nadie más, usando su propia cuenta como Staff también).

Al completar el paso 3 como mínimo, el Negocio puede enviarse a aprobación (`03-Business-Rules/01_Roles.md`, SuperSU aprueba) — queda en `PENDIENTE_APROBACION` y no es visible en el Marketplace hasta ser aprobado.

## Estados
El `negocio` entra en `PENDIENTE_APROBACION` al completar el mínimo del wizard (ver `04-Data-Model/03_State_Machines.md`). El `vinculo_staff_negocio` entra en `INVITADO` al enviarse la invitación y pasa a `ACTIVO` al aceptarse.

## Permisos
- Cualquier persona puede iniciar el onboarding de Cliente sin restricción.
- Solo una Barbería existente (o el creador inicial) puede invitar Staff.
- Solo SuperSU aprueba o rechaza un Negocio en `PENDIENTE_APROBACION`.

## Dependencias
- Depende de: `03-Business-Rules/01_Roles.md`, `05-API/02_Auth.md`, `06-Security/04_Compliance_Colombia.md`, `01-PRD/03_Monetization.md` (elección de Plan durante onboarding de Negocio).
- De este documento dependen: `07-QA/02_Client.md`, `07-QA/03_Staff.md`, `07-QA/04_Business.md`.

## Casos límite

- **Una invitación de Staff expira sin ser aceptada.** El vínculo nunca llega a crearse (queda en un estado previo de "invitación", no en `INVITADO` del `vinculo_staff_negocio` propiamente dicho); la Barbería puede reenviar una invitación nueva sin límite de intentos.
- **Un Negocio cierra la app a mitad del wizard, antes del paso 3.** El progreso se guarda; al volver a abrir, retoma exactamente en el paso donde quedó, con los datos ya ingresados intactos.
- **Un Cliente rechaza el consentimiento de datos.** No puede continuar — es obligatorio, a diferencia de ubicación y notificaciones (que son opcionales). La app explica claramente por qué es necesario antes de bloquear el flujo (transparencia, no solo un bloqueo seco).

## Criterios de aceptación
- [ ] Ningún Negocio puede enviarse a aprobación sin al menos 1 Sede y 1 Servicio.
- [ ] El progreso del wizard de Negocio persiste entre sesiones.
- [ ] Ninguna pantalla de onboarding solicita un dato sin explicar su finalidad, consistente con `06-Security/04_Compliance_Colombia.md`.

## Checklist
- [x] Completo
- [ ] Revisado

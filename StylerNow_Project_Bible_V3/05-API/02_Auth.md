# 02 — Auth

## Objetivo
Definir cómo se autentica y autoriza cada request, de modo que el token en sí sea la fuente de verdad del alcance de datos (nunca un parámetro que el cliente pueda manipular).

## Alcance
Autenticación (quién eres) y autorización a nivel de API (qué puedes hacer). El detalle de la matriz de roles vive en `03-Business-Rules/01_Roles.md`; la implementación de aislamiento de datos a nivel de base de datos vive en `06-Security/02_RLS.md`.

## Reglas

### Métodos de autenticación por rol

| Rol | Método |
|---|---|
| Cliente | OTP por celular (SMS) o email, o proveedor social (Google) — sesión con JWT + refresh token |
| Staff | Invitación por email/celular del Negocio → activa cuenta con contraseña o el mismo flujo OTP del Cliente (una persona puede ser ambos con la misma cuenta, ver `03-Business-Rules/01_Roles.md`) |
| Barbería / Guardian | Email + contraseña, con verificación de email obligatoria antes del primer acceso |
| SuperSU | Email + contraseña + autenticación de 2 factores obligatoria (sin excepción) |

### Estructura del token (JWT)

Claims obligatorios: `sub` (id de usuario), `rol` (uno de los 5 roles), `negocio_id` (presente solo si el rol está atado a un Negocio; puede ser un array si el usuario tiene vínculo con más de un Negocio — ver `03-Business-Rules/01_Roles.md`), `sede_id` (solo para Guardian), `exp`, `iat`.

El backend nunca confía en un `negocio_id` enviado en el body o query de una petición para decisiones de alcance — siempre deriva el alcance del claim del token verificado. Si una petición incluye un `negocio_id` en el payload que no coincide con el del token (y el rol no es SuperSU), se rechaza con `403 FORBIDDEN`, no se "corrige silenciosamente" usando el del token.

### Sesión activa multi-negocio

Un usuario con vínculo a más de un Negocio (Staff en dos Negocios, o una persona que es Barbería de dos Negocios) selecciona un "contexto activo" al iniciar sesión en Panel Negocio/App Staff; el token de sesión refleja ese contexto único a la vez — cambiar de contexto emite un token nuevo, nunca opera con ambos contextos simultáneamente en una sola sesión (ver `01-PRD/02_Functional_Architecture.md`, caso límite de rol combinado).

### Expiración y refresh

- Access token: 15 minutos de vida.
- Refresh token: 30 días, rotatorio (cada uso de refresh emite uno nuevo e invalida el anterior — detecta robo de token: si un refresh token ya usado se reintenta, se invalida toda la cadena de sesión y se fuerza reautenticación).

### Modo impersonación de SuperSU

Genera un token de impersonación de vida corta (30 minutos, ver `03-Business-Rules/01_Roles.md`) con un claim adicional `impersonated_by` que identifica al SuperSU real — todo evento de auditoría generado durante la impersonación registra ambos: el `actor_id` operativo (el Negocio impersonado) y el `impersonated_by` real.

### Autenticación de webhooks entrantes (pasarela de pago)

No usa el mismo esquema de JWT — se valida por firma criptográfica del payload (HMAC con secreto compartido con la pasarela), verificada en cada request antes de procesar cualquier efecto de negocio. Ver `06_Webhooks.md`.

## Estados
La sesión de un usuario no es una entidad de negocio con máquina de estados propia en esta Biblia — es un mecanismo técnico (ver `10-Operations/04_Logs_Policy.md` para su registro operativo).

## Permisos
Este documento implementa técnicamente la matriz de `03-Business-Rules/01_Roles.md` — no define permisos nuevos, los transporta.

## Dependencias
- Depende de: `03-Business-Rules/01_Roles.md`, `01_Standards.md`.
- De este documento dependen: `06-Security/01_Security_Model.md`, `06-Security/02_RLS.md`, todos los demás documentos de `05-API`.

## Casos límite

- **Un Staff acepta una invitación de un Negocio mientras ya tiene sesión activa como Cliente.** Ambas identidades (Cliente y Staff) viven bajo el mismo `usuario_id` si el email/celular coincide — no se crean cuentas duplicadas; el usuario simplemente gana un nuevo `rol` disponible para seleccionar contexto.
- **Un refresh token robado se usa por un atacante después de que el usuario legítimo ya lo usó una vez.** La detección de reuso de refresh token invalida toda la cadena de sesión (tanto la del atacante como la legítima), forzando reautenticación completa — es la respuesta estándar de seguridad ante sospecha de robo de token, incluso a costa de inconvenientes al usuario legítimo.
- **SuperSU inicia impersonación y su sesión de 2FA expira a mitad del proceso.** La sesión de impersonación se invalida inmediatamente junto con la sesión principal — nunca queda una sesión de impersonación viva sin una sesión de SuperSU autenticada y vigente detrás.

## Criterios de aceptación
- [ ] Ningún endpoint deriva alcance de datos de un valor del payload que no coincida con el token verificado.
- [ ] Un reuso de refresh token invalida toda la cadena de sesión, verificable con una prueba de seguridad automatizada.
- [ ] Toda acción durante impersonación queda auditada con ambos actores (impersonado e impersonador).

## Checklist
- [x] Completo
- [ ] Revisado

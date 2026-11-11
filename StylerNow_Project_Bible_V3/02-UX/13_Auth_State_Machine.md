# 13 — Máquina de Estados de Identidad (ADR-015, Fase C)

## Objetivo
Documentar el contrato oficial del flujo de identidad de StylerNow — todo el
código de `src/app/login/actions.ts`, `src/lib/auth/*` y los callbacks de
Supabase debe obedecer esta tabla. Un estado o transición nuevo se agrega
primero acá, después en código.

## Diagrama oficial

```text
Invitado
   │  OTP válido (signInWithOtp + verifyOtp)
   ▼
OTP Verificado
   │  crearContrasena() — obligatorio la primera vez
   ▼
Contraseña creada  (perfil.password_establecida = true)
   │
   ▼
Cuenta activa ──────────────► Google vinculado (Fase 7, infraestructura lista — sin implementar)
   │
   ├──────────────────────► Recovery (solicitarRecuperacion → link → restablecerContrasena)
   │                              │
   │                              ▼
   │                        Cuenta activa (Session Version incrementada — sesiones viejas inválidas)
   │
   └──────────────────────► Suspendido (solo aplica a Staff: vinculo_staff_negocio.estado)
                                   │  reactivar_staff()
                                   ▼
                             Cuenta activa
```

## Tabla de transiciones

| Estado actual | Evento | Nuevo estado | Implementación |
|---|---|---|---|
| Invitado | OTP válido | OTP Verificado | `verificarCodigo()` |
| OTP Verificado | Crear contraseña | Contraseña creada | `crearContrasena()` → `perfil.password_establecida = true` |
| Contraseña creada | (automático) | Cuenta activa | Sin acción adicional — es el estado estable |
| Cuenta activa | Google vinculado | Cuenta activa | Fase 7 — interfaz `AuthProvider` lista (`src/lib/auth/providers/tipos.ts`), Google sin implementar todavía |
| Cuenta activa | Login con contraseña | Cuenta activa | `iniciarSesionConContrasena()` |
| Cuenta activa | Solicita recuperación | Recovery | `solicitarRecuperacion()` — nunca revela si el email existe |
| Recovery | Nueva contraseña | Cuenta activa | `restablecerContrasena()` — incrementa `session_version` (invalida sesiones previas) |
| Cuenta activa | Cambio de contraseña voluntario | Cuenta activa | `cambiarContrasena()` — exige la contraseña actual, incrementa `session_version` |
| Cuenta activa (Staff) | Suspensión | Suspendido | `suspender_staff()` (RPC, ya existente) — incrementa `session_version` desde ADR-015 |
| Suspendido | Reactivar | Cuenta activa | `reactivar_staff()` (RPC, ya existente) |
| Cuenta activa (Staff) | Traslado de sede | Cuenta activa (nueva sede) | `trasladar_staff()` — incrementa `session_version` desde ADR-015 |

## Login Matrix (ADR-015, Fase D)

Contrato oficial de qué método de autenticación puede usar cada rol. Ver
`Identity_Provider_Platform.md` para la arquitectura de proveedores.

| Rol | Password | Google | Apple |
|---|:---:|:---:|:---:|
| Cliente | ✅ | ✅ | Preparado |
| Barbería | ✅ | ✅ | Preparado |
| Staff | ✅ | ✅ | Preparado |
| Guardian | ✅ | ✅ | Preparado |
| SuperSU | ✅ | ❌ | ❌ |

SuperSU con Google se bloquea en `requireSuperSU()` (`src/lib/auth/require-supersu.ts`):
si `app_metadata.provider === "google"`, se cierra la sesión y se manda de
vuelta a `/login` — nunca se confía en que el frontend no muestre el botón,
la regla vive en el servidor.

## Vinculación de proveedores (Google)

```
Google → ¿existe un auth.users con este correo verificado?
              │
        Sí ───┴─── No
        │           │
   Vincula la     Crea un auth.users nuevo (handle_new_user() → perfil)
   identidad        │
   Google a la    Rol: Cliente (no existe negocio/vinculo_staff_negocio
   cuenta          todavía — es el mismo fallback "NINGUNO" que ya usa
   existente,      cualquier cuenta nueva por OTP)
   conserva el       │
   rol tal cual    Completa perfil (mismo desvío que OTP: sin teléfono
   ya lo tenía     → /perfil?bienvenida=1)
```

**Barbería/Staff/Guardian nunca se crean automáticamente vía Google** — esos
roles siempre requieren una acción explícita posterior (completar el wizard
de onboarding, o aceptar una invitación de Staff), exactamente igual que hoy
con OTP. El proveedor de login nunca decide el rol.

## Notas de implementación

- **"Suspendido" no es un estado global de cuenta** — es específico del vínculo Staff↔Negocio (`vinculo_staff_negocio.estado`). Cliente/Barbería/SuperSU no tienen un estado de suspensión hoy (`perfil.es_supersu`/`negocio.estado` son mecanismos distintos, fuera de esta máquina).
- **SuperSU no pasa por "Contraseña creada"** — se crea directamente con contraseña vía SQL/Admin API (nunca por OTP), y su siguiente paso obligatorio es MFA (Fase 8, preparado pero no forzado todavía — ver `Contexto.sesion.aal` en `src/lib/auth/tipos.ts`).
- **Session Version** (`perfil.session_version`) es la implementación real de "las sesiones viejas quedan inválidas" — requiere el Custom Access Token Hook de Supabase habilitado en el Dashboard (Authentication → Hooks) para que el claim viaje en el JWT; la columna y los incrementos ya están en producción (migraciones 081-083), el hook es un paso manual pendiente.
- **Rate limiting** (`intento_auth` + `verificar_rate_limit_auth()`) protege las transiciones "OTP válido", "Login con contraseña" y "Solicita recuperación" — 5 intentos fallidos por email en una ventana de 15 minutos.

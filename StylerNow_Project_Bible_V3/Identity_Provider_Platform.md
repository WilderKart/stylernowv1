# Identity Provider Platform (ADR-015, Fase D)

## Objetivo
Documentar la arquitectura de proveedores de identidad de StylerNow para que
agregar un proveedor OAuth nuevo (Microsoft, GitHub, etc.) sea implementar
una interfaz, nunca reescribir el núcleo de autenticación.

## Arquitectura

```
src/lib/auth/providers/
  tipos.ts              — contrato AuthProvider (login/callback/link/unlink/isEnabled)
  google-provider.ts     — implementación real, isEnabled() = true
  apple-provider.ts      — implementación preparada, isEnabled() = false
  provider-registry.ts   — PROVEEDORES_OAUTH[] + METODOS_AUTH (incluye Password)
```

Todo proveedor OAuth comparte el **mismo callback físico**
(`src/app/auth/callback/route.ts`, PKCE, `exchangeCodeForSession`) — no hay
un callback por proveedor. Se distinguen después del intercambio, leyendo
`user.app_metadata.provider`, nunca antes.

## Contrato `AuthProvider`

```ts
interface AuthProvider {
  readonly id: string;
  readonly name: string;
  login(redirectTo: string): Promise<{ ok: true; url: string } | { ok: false; error: string }>;
  callback(code: string): Promise<{ ok: true; userId: string } | { ok: false; error: string }>;
  link(): Promise<{ ok: true } | { ok: false; error: string }>;
  unlink(): Promise<{ ok: true } | { ok: false; error: string }>;
  isEnabled(): boolean;
}
```

`callback()` existe en el contrato por completitud (un proveedor futuro con
un intercambio distinto al PKCE de Supabase podría necesitarlo), pero
Google/Apple no lo usan en la práctica — el intercambio real vive en
`/auth/callback`, compartido.

## Proveedores

| Proveedor | Estado | Archivo |
|---|---|---|
| Password | Activo (no es un `AuthProvider` — no tiene callback OAuth, ver `login/actions.ts`) | `src/lib/auth/password*.ts` |
| Google | Activo | `src/lib/auth/providers/google-provider.ts` |
| Apple | Preparado, `isEnabled()=false` | `src/lib/auth/providers/apple-provider.ts` |

## Regla de oro: el rol nunca sale del proveedor

Ningún proveedor (ni Password, ni Google, ni el futuro Apple) decide el rol
de la persona. El rol siempre se deriva después del login, de la misma
manera sin importar el método:

```
negocio.owner_user_id       → Barbería
vinculo_staff_negocio        → Staff / Guardian
perfil.es_supersu            → SuperSU
(ninguno de los anteriores)  → Cliente
```

`resolverContexto()` / `obtenerContextoStaff()` / `requireSuperSU()` no
saben ni les importa si la sesión vino de OTP, contraseña o Google.

## Flujo de vinculación (Google)

Ver "Vinculación de proveedores" en `02-UX/13_Auth_State_Machine.md` — un
correo ya existente se vincula a la cuenta existente conservando su rol;
un correo nuevo crea una cuenta Cliente, nunca Barbería/Staff/Guardian
automáticamente.

## Expansión futura

Agregar Microsoft, GitHub, etc.:
1. Crear `src/lib/auth/providers/microsoft-provider.ts` implementando `AuthProvider`, calcado de `google-provider.ts`.
2. Agregarlo a `PROVEEDORES_OAUTH` en `provider-registry.ts`.
3. Agregar el botón en `formulario.tsx` (mismo patrón que "Continuar con Google").
4. Habilitar el proveedor en Supabase Dashboard con sus credenciales.

Ningún guard (`requireRole`/`resolverContexto`/`requireSuperSU`), ninguna
RLS, ni `/auth/callback` necesitan cambios — todos ya son agnósticos al
proveedor.

## Apple — preparado, no implementado

`apple-provider.ts` implementa el contrato completo con `isEnabled()` fijo
en `false`. El día que existan credenciales de Sign in with Apple:
1. Cambiar `isEnabled()` a `true`.
2. Completar `login()`/`link()`/`unlink()` con el mismo patrón de `google-provider.ts` (`signInWithOAuth({ provider: "apple" })`).
3. Habilitar el proveedor en Supabase Dashboard.

Nada más del núcleo cambia.

# Sentry — monitoreo de errores

Organización `stylernow`, proyecto `stylernow-app` (Next.js). Configurado el 2026-11-14.

## Qué captura
- Errores del navegador (excepciones y promesas rechazadas) y de los límites de error de la app
  (`app/error.tsx`, `global-error.tsx`, `panel/error.tsx`, `panel/marca/error.tsx`, `admin/planes/error.tsx`).
- Errores de servidor: render, Server Actions, Route Handlers y el proxy (`instrumentation.ts` → `onRequestError`).
- Trazas de rendimiento: muestra del 10 % en producción.
- **No** hay Session Replay (la app muestra datos personales y de pago).

## Privacidad (cero confianza)
Todo evento pasa por `src/lib/sentry/comun.ts` antes de salir:
- Se eliminan cookies, cuerpo y **todas** las cabeceras de la petición.
- Del usuario solo viaja su id interno; nunca correo, IP ni nombre.
- Correos y JWT dentro de mensajes se enmascaran; las claves tipo `token`, `password`, `tarjeta`, `telefono`… se reemplazan por `[Filtrado]`.
- Los parámetros sensibles de las URLs (`?code=`, `?token=`) se enmascaran. Las migas de pan descartan `console.log`.
- `request_id` (el mismo id que queda en la auditoría de la base) se guarda como etiqueta para cruzar un error con su rastro.
- Probado con una prueba automática (`tests/sentry-limpieza.test.ts`) y de punta a punta contra Sentry.
- Ajustes de la organización: Enhanced Privacy, depuradores de datos obligatorios, no guardar IPs, sin enlaces públicos de incidencias ni solicitudes para unirse.

## Cómo viajan los eventos
El navegador envía a `/api/monitoring` (misma origen, `src/app/api/monitoring/route.ts`) y el servidor reenvía a Sentry.
Así el CSP de `proxy.ts` no necesita abrirse a un dominio externo (cuando se active `CSP_ENFORCE=1` seguirá funcionando) y no lo
bloquean los bloqueadores de anuncios. `/api/**` no exige sesión en el proxy, por eso también llegan los errores de login y landing.

## Variables de entorno
| Variable | Dónde | Notas |
|---|---|---|
| `NEXT_PUBLIC_SENTRY_DSN` | Vercel (Production y Preview) y `.env.local` | Sin ella Sentry queda apagado. No es un secreto, pero va por variable. |
| `NEXT_PUBLIC_SENTRY_ENV` | opcional | `production`/`staging`. Si falta usa `VERCEL_ENV`. |
| `SENTRY_AUTH_TOKEN` | Vercel (solo build) | **Secreto.** Sube los source maps. Sin él el build funciona, pero los errores se ven minificados. |
| `NEXT_PUBLIC_SENTRY_ENABLE_DEV=1` | opcional | Para probar el envío desde `next dev`. Por defecto solo se envía desde un build de producción. |

Para el token: Sentry → Settings → Developer Settings → Organization Tokens (permiso de build/release). Se pega solo en Vercel.

## Qué se ignora a propósito
`NEXT_REDIRECT`, `NEXT_NOT_FOUND`, `forbidden()`/`unauthorized()` (control de flujo), `AbortError`, `Failed to fetch`/`Load failed`
(cortes de red del usuario), `ResizeObserver` y extensiones del navegador.

## Alertas
Regla predeterminada "Send a notification for high priority issues" → correo. Se pueden añadir reglas (p. ej. pico de errores en `/api/pagos/**`)
desde Alerts en Sentry.

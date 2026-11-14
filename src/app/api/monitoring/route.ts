/**
 * Túnel de Sentry: el navegador envía aquí sus eventos (misma origen) y el servidor los reenvía a Sentry.
 * Está bajo /api/ a propósito: src/proxy.ts deja pasar /api/** sin exigir sesión, así los errores de
 * páginas públicas (login, landing) también llegan. Solo reenvía al DSN configurado en el servidor.
 */
export { POST } from "@sentry/nextjs/tunnel";

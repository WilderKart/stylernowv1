import * as Sentry from "@sentry/nextjs";
import { opcionesBase } from "@/lib/sentry/comun";

/**
 * Sentry en el navegador. Se ejecuta antes de que la app sea interactiva.
 * Sin Session Replay a propósito (la app muestra datos personales y de pago).
 * Los eventos viajan por /api/monitoring (misma origen): no requiere abrir el CSP a un dominio externo
 * y no lo bloquean los bloqueadores de anuncios.
 */
Sentry.init({
  ...opcionesBase(),
  tunnel: "/api/monitoring",
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;

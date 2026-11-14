import * as Sentry from "@sentry/nextjs";

/** Carga la configuración de Sentry según el runtime en que arranca Next. */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");
  }
  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }
}

/** Next avisa aquí de todo error de servidor no controlado (render, acciones, rutas). */
export const onRequestError = Sentry.captureRequestError;

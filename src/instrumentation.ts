import * as Sentry from "@sentry/nextjs";
import { enviarAlertaOperativa, type DetalleAlerta } from "@/lib/observabilidad/alertas";

/** Carga la configuración de Sentry según el runtime en que arranca Next. */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");
  }
  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }
}

type SolicitudError = { method?: string; pathname?: string };
type ContextoError = { digest?: string };

export const onRequestError = (...args: Parameters<typeof Sentry.captureRequestError>) => {
  const solicitud = args[1] as SolicitudError | undefined;
  const contexto = args[2] as ContextoError | undefined;
  const ruta = solicitud?.pathname || "ruta-desconocida";
  const detalle: DetalleAlerta = {
    metodo: solicitud?.method || "DESCONOCIDO",
    ruta,
    digest: contexto?.digest || "sin-digest",
  };
  void enviarAlertaOperativa({ tipo: "ERROR_5XX", titulo: `Error 5xx en ${ruta}`, detalle });
  return Sentry.captureRequestError(...args);
};

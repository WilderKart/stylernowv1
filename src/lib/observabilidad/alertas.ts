import * as Sentry from "@sentry/nextjs";

export type TipoAlerta = "PRUEBA" | "ERROR_5XX" | "WEBHOOK_ERROR" | "SALUD";
export type SeveridadAlerta = "info" | "warning" | "error";
export type ResultadoAlerta = "enviada" | "sin_destino" | "fallida";
export type ValorDetalle = string | number | boolean;
export type DetalleAlerta = Record<string, ValorDetalle>;

type ParametrosAlerta = {
  tipo: TipoAlerta;
  titulo: string;
  detalle?: DetalleAlerta;
  severidad?: SeveridadAlerta;
};

const CLAVE_SENSIBLE =
  /(token|secret|password|passwd|contrase|authorization|cookie|api[-_]?key|apikey|jwt|otp|clave|tarjeta|card|cvv|cvc|iban|cedula|documento|email|correo|telefono|phone|celular|whatsapp|session|refresh|signature|firma)/i;
const EMAIL = /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g;
const JWT = /eyJ[\w-]{8,}\.[\w-]{8,}\.[\w-]{8,}/g;
const MASCARA = "[Filtrado]";
const MAX_TEXTO = 240;
const MAX_DETALLE = 20;

export function limpiarTextoAlerta(texto: string): string {
  return texto.replace(JWT, MASCARA).replace(EMAIL, "[email]").replace(/[\r\n]+/g, " ").trim().slice(0, MAX_TEXTO);
}

export function limpiarDetalleAlerta(detalle: DetalleAlerta): DetalleAlerta {
  const salida: DetalleAlerta = {};
  for (const [clave, valor] of Object.entries(detalle).slice(0, MAX_DETALLE)) {
    if (CLAVE_SENSIBLE.test(clave)) continue;
    salida[clave] = typeof valor === "string" ? limpiarTextoAlerta(valor) : valor;
  }
  return salida;
}

export function construirEventoAlerta({ tipo, titulo, detalle = {} }: ParametrosAlerta) {
  return {
    tipo,
    titulo: limpiarTextoAlerta(titulo) || tipo,
    detalle: limpiarDetalleAlerta(detalle),
    entorno: limpiarTextoAlerta(process.env.NEXT_PUBLIC_SENTRY_ENV || process.env.NEXT_PUBLIC_VERCEL_ENV || process.env.NODE_ENV || "desconocido"),
    version: limpiarTextoAlerta(process.env.NEXT_PUBLIC_APP_VERSION || "desconocida"),
    timestamp: new Date().toISOString(),
  };
}

export async function enviarAlertaOperativa(parametros: ParametrosAlerta): Promise<ResultadoAlerta> {
  const evento = construirEventoAlerta(parametros);
  const nivel = parametros.severidad === "info" ? "info" : parametros.severidad === "warning" ? "warning" : "error";

  Sentry.captureMessage(`[${evento.tipo}] ${evento.titulo}`, {
    level: nivel,
    extra: { alerta: evento },
  });

  const destino = process.env.ALERTAS_WEBHOOK_URL?.trim();
  if (!destino) return "sin_destino";

  const controlador = new AbortController();
  const temporizador = setTimeout(() => controlador.abort(), 3000);
  try {
    const url = new URL(destino);
    const esLocal = url.protocol === "http:" && ["localhost", "127.0.0.1", "::1"].includes(url.hostname);
    if (url.protocol !== "https:" && !esLocal) return "fallida";

    const cabeceras: Record<string, string> = {
      "content-type": "application/json",
      "user-agent": "stylernow-alertas/1",
    };
    const token = process.env.ALERTAS_WEBHOOK_TOKEN?.trim();
    if (token) cabeceras.authorization = `Bearer ${token}`;

    const respuesta = await fetch(url, {
      method: "POST",
      headers: cabeceras,
      body: JSON.stringify(evento),
      signal: controlador.signal,
      cache: "no-store",
    });
    return respuesta.ok ? "enviada" : "fallida";
  } catch {
    return "fallida";
  } finally {
    clearTimeout(temporizador);
  }
}

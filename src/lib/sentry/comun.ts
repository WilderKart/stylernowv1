import type { Breadcrumb, ErrorEvent, init } from "@sentry/nextjs";

type TransactionEvent = Parameters<NonNullable<NonNullable<Parameters<typeof init>[0]>["beforeSendTransaction"]>>[0];

/**
 * Configuración común de Sentry (cliente, servidor y edge).
 *
 * Criterio: StylerNow maneja pagos, datos personales y sesiones. Sentry recibe el MÍNIMO para diagnosticar:
 *  - sin PII por defecto (`sendDefaultPii: false`), sin Session Replay;
 *  - toda cookie, cabecera de autenticación, cuerpo de petición y parámetro sensible se elimina o se enmascara
 *    ANTES de salir del servidor/navegador (`limpiarEvento`);
 *  - del usuario solo viaja su id interno (nunca correo, IP ni nombre);
 *  - los errores de flujo normal (redirect, notFound, forbidden, cortes de red) no son incidentes y se ignoran.
 */

const DSN = process.env.NEXT_PUBLIC_SENTRY_DSN;
const ENTORNO = process.env.NEXT_PUBLIC_SENTRY_ENV || process.env.NEXT_PUBLIC_VERCEL_ENV || process.env.NODE_ENV || "development";
const EN_PRODUCCION = process.env.NODE_ENV === "production";
/** Solo se envía desde un build de producción; en desarrollo, solo si se pide a propósito (NEXT_PUBLIC_SENTRY_ENABLE_DEV=1). */
const HABILITADO = Boolean(DSN) && (EN_PRODUCCION || process.env.NEXT_PUBLIC_SENTRY_ENABLE_DEV === "1");

/** Nombres de campo/parámetro cuyo valor nunca debe salir. */
const CLAVE_SENSIBLE =
  /(token|secret|password|passwd|contrase|authorization|cookie|api[-_]?key|apikey|jwt|otp|clave|tarjeta|card|cvv|cvc|iban|cedula|documento|email|correo|telefono|phone|celular|whatsapp|session|refresh|signature|firma|(^|[-_])code$|(^|[-_])nit$)/i;

const EMAIL = /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g;
const JWT = /eyJ[\w-]{8,}\.[\w-]{8,}\.[\w-]{8,}/g;
const MASCARA = "[Filtrado]";

function limpiarTexto(texto: string): string {
  return texto.replace(JWT, MASCARA).replace(EMAIL, "[email]");
}

/** Enmascara recursivamente los valores de claves sensibles y los correos/JWT dentro de textos. */
function limpiarValor(valor: unknown, profundidad = 0): unknown {
  if (typeof valor === "string") return limpiarTexto(valor);
  if (valor === null || typeof valor !== "object") return valor;
  if (profundidad > 6) return MASCARA;
  if (Array.isArray(valor)) return valor.map((v) => limpiarValor(v, profundidad + 1));
  const salida: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(valor)) {
    salida[k] = CLAVE_SENSIBLE.test(k) ? MASCARA : limpiarValor(v, profundidad + 1);
  }
  return salida;
}

/** Quita de una URL los parámetros sensibles (?code=, ?token=, ?access_token=…) y limpia el texto. */
function limpiarUrl(url: string): string {
  try {
    const u = new URL(url, "http://local.invalid");
    let cambio = false;
    for (const k of [...u.searchParams.keys()]) {
      if (CLAVE_SENSIBLE.test(k)) {
        u.searchParams.set(k, MASCARA);
        cambio = true;
      }
    }
    if (!cambio) return limpiarTexto(url);
    const relativa = !/^[a-z][a-z0-9+.-]*:/i.test(url);
    return limpiarTexto(relativa ? `${u.pathname}${u.search}${u.hash}` : u.toString());
  } catch {
    return limpiarTexto(url);
  }
}

type EventoConPeticion = ErrorEvent | TransactionEvent;

/** Se aplica a todo evento antes de enviarlo. Devuelve el evento limpio (nunca null: lo que se descarta lo decide `ignoreErrors`). */
export function limpiarEvento<T extends EventoConPeticion>(evento: T): T {
  const req = evento.request;
  if (req) {
    // El id de petición lo genera el servidor (proxy.ts) y es el mismo que queda en la auditoría de la base:
    // se conserva como etiqueta para poder cruzar un error con su rastro, y se descartan todas las demás cabeceras.
    const cab = req.headers ?? {};
    const idPeticion = cab["x-request-id"] ?? cab["X-Request-Id"] ?? cab["x-request-id-origen"];
    if (idPeticion) evento.tags = { ...evento.tags, request_id: String(idPeticion).slice(0, 64) };
    delete req.cookies;
    delete req.data;
    req.headers = {};
    if (req.url) req.url = limpiarUrl(req.url);
    if (typeof req.query_string === "string") req.query_string = limpiarUrl(`?${req.query_string}`).replace(/^\?/, "");
    else if (req.query_string) req.query_string = limpiarValor(req.query_string) as typeof req.query_string;
  }

  if (evento.user) evento.user = evento.user.id ? { id: String(evento.user.id) } : undefined;

  if ("message" in evento && typeof evento.message === "string") evento.message = limpiarTexto(evento.message);
  if ("exception" in evento) {
    for (const ex of evento.exception?.values ?? []) {
      if (ex.value) ex.value = limpiarTexto(ex.value);
    }
  }
  if (evento.extra) evento.extra = limpiarValor(evento.extra) as typeof evento.extra;
  if (evento.contexts) evento.contexts = limpiarValor(evento.contexts) as typeof evento.contexts;
  if (evento.breadcrumbs) {
    evento.breadcrumbs = evento.breadcrumbs.map(limpiarMigaja).filter((m): m is Breadcrumb => m !== null);
  }
  return evento;
}

/** Las migas de pan (clics, navegación, fetch) pueden arrastrar URLs con tokens o texto con datos personales. */
export function limpiarMigaja(m: Breadcrumb): Breadcrumb | null {
  // Los console.* de la app pueden contener datos de usuario: solo se conservan los de error.
  if (m.category === "console" && m.level !== "error") return null;
  if (m.message) m.message = limpiarTexto(m.message);
  if (m.data) {
    const datos = limpiarValor(m.data) as Record<string, unknown>;
    for (const k of ["url", "from", "to"]) if (typeof datos[k] === "string") datos[k] = limpiarUrl(datos[k] as string);
    m.data = datos;
  }
  return m;
}

/** Errores que no son incidentes: control de flujo de Next, cortes de red del usuario, ruido de extensiones y del navegador. */
const IGNORAR = [
  /NEXT_REDIRECT/,
  /NEXT_NOT_FOUND/,
  /NEXT_HTTP_ERROR_FALLBACK/,
  /NEXT_UNAUTHORIZED/,
  /NEXT_FORBIDDEN/,
  "ResizeObserver loop limit exceeded",
  "ResizeObserver loop completed with undelivered notifications",
  "Non-Error promise rejection captured",
  "AbortError",
  "The operation was aborted",
  "Failed to fetch",
  "Load failed",
  "NetworkError when attempting to fetch resource",
  "cancelled",
];

const URL_AJENAS = [/^chrome-extension:/i, /^moz-extension:/i, /^safari-extension:/i, /^safari-web-extension:/i, /extensions\//i];

export function opcionesBase() {
  return {
    dsn: DSN,
    enabled: HABILITADO,
    environment: ENTORNO,
    sendDefaultPii: false,
    // Rendimiento: muestreo bajo (los incidentes se capturan siempre; las trazas son una muestra).
    tracesSampleRate: EN_PRODUCCION ? 0.1 : 1,
    ignoreErrors: IGNORAR,
    denyUrls: URL_AJENAS,
    beforeSend: (evento: ErrorEvent) => limpiarEvento(evento),
    beforeSendTransaction: (evento: TransactionEvent) => limpiarEvento(evento),
    beforeBreadcrumb: (m: Breadcrumb) => limpiarMigaja(m),
  };
}

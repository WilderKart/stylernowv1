/**
 * Renderizado de plantillas del outbox. Contrato idéntico al de `_notif_render_texto` (migración 124):
 * solo `{{clave}}` exacto (letras, dígitos y guion bajo); claves sin valor se reemplazan por vacío.
 * En HTML cada valor se escapa: los datos vienen de la base (nombres que escribió un usuario) y
 * nunca se insertan como marcado.
 */
export type DatosPlantilla = Record<string, unknown>;

const VARIABLE = /\{\{([A-Za-z0-9_]+)\}\}/g;

export function escaparHtml(valor: string): string {
  return valor
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function valorTexto(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "string") return v;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  return "";
}

export function renderizarTexto(plantilla: string, datos: DatosPlantilla): string {
  return plantilla.replace(VARIABLE, (_, clave: string) => valorTexto(datos[clave]));
}

export function renderizarHtml(plantilla: string, datos: DatosPlantilla): string {
  return plantilla.replace(VARIABLE, (_, clave: string) => escaparHtml(valorTexto(datos[clave])));
}

const RUTA_SEGURA = /^\/(?!\/)[A-Za-z0-9\-_/]*$/;

/** Ruta interna validada (nunca una URL externa ni `//host`). Si no es válida, la bandeja de avisos. */
export function rutaSegura(ruta: unknown): string {
  return typeof ruta === "string" && ruta.length <= 200 && RUTA_SEGURA.test(ruta) ? ruta : "/notificaciones";
}

export function construirEnlace(ruta: unknown, base: string): string {
  const raiz = base.replace(/\/+$/, "");
  return `${raiz}${rutaSegura(ruta)}`;
}

const TEXTOS_CORREO = {
  es: {
    ver: "Ver detalle",
    pie: "Recibes este correo por una operación en tu cuenta de StylerNow. Puedes ajustar tus avisos en",
    ajustes: "Notificaciones",
  },
  en: {
    ver: "View details",
    pie: "You are receiving this email because of activity in your StylerNow account. You can adjust your alerts in",
    ajustes: "Notifications",
  },
} as const;

/**
 * Envuelve el cuerpo (ya renderizado y escapado) en el layout del correo.
 * `cuerpoHtml` proviene de una plantilla de la base (controlada por la plataforma), no del usuario.
 */
export function envolverCorreo(opts: {
  asunto: string;
  cuerpoHtml: string;
  enlace: string;
  base: string;
  idioma: "es" | "en";
}): string {
  const t = TEXTOS_CORREO[opts.idioma] ?? TEXTOS_CORREO.es;
  const ajustes = construirEnlace("/notificaciones", opts.base);
  return [
    `<!doctype html><html lang="${opts.idioma}"><head><meta charset="utf-8"><title>${escaparHtml(opts.asunto)}</title></head>`,
    `<body style="margin:0;padding:24px;background:#f4f4f4;font-family:Arial,Helvetica,sans-serif;color:#111">`,
    `<div style="max-width:560px;margin:0 auto;background:#fff;border:2px solid #111;padding:24px">`,
    `<p style="margin:0 0 16px;font-weight:bold;letter-spacing:.04em">STYLERNOW</p>`,
    `<h1 style="font-size:20px;margin:0 0 16px">${escaparHtml(opts.asunto)}</h1>`,
    opts.cuerpoHtml,
    `<p style="margin:24px 0"><a href="${escaparHtml(opts.enlace)}" style="background:#111;color:#fff;padding:12px 18px;text-decoration:none;display:inline-block">${t.ver}</a></p>`,
    `<p style="font-size:12px;color:#555;margin:24px 0 0">${t.pie} <a href="${escaparHtml(ajustes)}">${t.ajustes}</a>.</p>`,
    `</div></body></html>`,
  ].join("");
}

/** Versión en texto plano para clientes de correo sin HTML. */
export function textoPlanoDeHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

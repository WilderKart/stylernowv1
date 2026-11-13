import type { MensajeSaliente } from "./adaptadores";
import type { Canal } from "./estados";
import { construirEnlace, envolverCorreo, renderizarHtml, renderizarTexto, rutaSegura, textoPlanoDeHtml } from "./plantillas";
import type { SuscripcionPush } from "./web-push";

/** Fila que devuelve `notif_outbox_tomar` (plantilla ya resuelta por la base: override del negocio o global). */
export interface FilaOutbox {
  id: string;
  evento: string;
  canal: Canal;
  idioma: string;
  datos: Record<string, unknown> | null;
  email: string | null;
  asunto: string | null;
  cuerpo: string | null;
  push_suscripciones: SuscripcionPush[] | null;
}

/** Convierte una fila del outbox en el mensaje que recibe el adaptador. Null si no hay plantilla. */
export function armarMensaje(fila: FilaOutbox, base: string): MensajeSaliente | null {
  if (!fila.asunto || !fila.cuerpo) return null;
  const idioma = fila.idioma === "en" ? "en" : "es";
  const datos = { ...(fila.datos ?? {}) };
  const ruta = rutaSegura(datos.ruta);
  const enlace = construirEnlace(ruta, base);
  datos.enlace = enlace;
  const asunto = renderizarTexto(fila.asunto, datos).slice(0, 200);
  if (fila.canal === "EMAIL") {
    const cuerpoHtml = renderizarHtml(fila.cuerpo, datos);
    return {
      id: fila.id,
      canal: "EMAIL",
      idioma,
      asunto,
      html: envolverCorreo({ asunto, cuerpoHtml, enlace, base, idioma }),
      texto: `${textoPlanoDeHtml(cuerpoHtml)}\n\n${enlace}`,
      ruta,
      email: fila.email,
    };
  }
  return {
    id: fila.id,
    canal: fila.canal,
    idioma,
    asunto,
    texto: renderizarTexto(fila.cuerpo, datos),
    ruta,
    push: Array.isArray(fila.push_suscripciones) ? fila.push_suscripciones : [],
  };
}

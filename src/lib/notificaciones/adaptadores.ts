import type { Canal } from "./estados";
import { cargarClavesVapid, enviarPushA, type SuscripcionPush } from "./web-push";

/**
 * Contrato neutral de proveedor. Reglas para cualquier adaptador:
 *  - `ok: true` SOLO con el id que devolvió el proveedor (o, en push, la evidencia HTTP 201 del push service).
 *  - Nunca se registran en logs ni en la base los cuerpos de los mensajes (llevan datos personales).
 *  - Las credenciales viven en variables de entorno del servidor; si faltan, el adaptador es "no habilitado".
 */
export interface MensajeSaliente {
  id: string;
  canal: Canal;
  idioma: "es" | "en";
  asunto: string;
  texto: string;
  html?: string;
  /** Ruta interna validada que abre el aviso. */
  ruta: string;
  email?: string | null;
  push?: SuscripcionPush[];
}

export type ResultadoEnvio =
  | { ok: true; idExterno: string; expirados?: string[] }
  | { ok: false; codigo: string; reintentable: boolean; expirados?: string[] };

export interface AdaptadorCanal {
  readonly nombre: string;
  readonly canal: Canal;
  readonly habilitado: boolean;
  enviar(msg: MensajeSaliente): Promise<ResultadoEnvio>;
}

type Entorno = Record<string, string | undefined>;
type FetchLike = (url: string, init: RequestInit) => Promise<Response>;

export function adaptadorNoHabilitado(canal: Canal): AdaptadorCanal {
  return {
    nombre: "NO_HABILITADO",
    canal,
    habilitado: false,
    async enviar() {
      return { ok: false, codigo: "CANAL_NO_HABILITADO", reintentable: false };
    },
  };
}

const REMITENTE_POR_DEFECTO = "StylerNow <notificaciones@mail.stylernow.com>";

export function adaptadorResend(env: Entorno, fetchImpl: FetchLike = fetch): AdaptadorCanal {
  const token = env.RESEND_API_KEY?.trim();
  if (!token) return adaptadorNoHabilitado("EMAIL");
  const remitente = env.NOTIFICACIONES_EMAIL_REMITENTE?.trim() || REMITENTE_POR_DEFECTO;
  return {
    nombre: "RESEND",
    canal: "EMAIL",
    habilitado: true,
    async enviar(msg) {
      if (!msg.email || !/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(msg.email)) {
        return { ok: false, codigo: "SIN_DESTINO", reintentable: false };
      }
      let res: Response;
      try {
        res = await fetchImpl("https://api.resend.com/emails", {
          method: "POST",
          redirect: "error",
          signal: AbortSignal.timeout(15_000),
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
            // Reintentar con la misma clave no duplica el correo del lado de Resend.
            "Idempotency-Key": `outbox-${msg.id}`,
          },
          body: JSON.stringify({ from: remitente, to: [msg.email], subject: msg.asunto, html: msg.html, text: msg.texto }),
        });
      } catch {
        return { ok: false, codigo: "ERROR_RED", reintentable: true };
      }
      if (!res.ok) {
        return { ok: false, codigo: `HTTP_${res.status}`, reintentable: res.status === 429 || res.status >= 500 };
      }
      let id: unknown = null;
      try {
        id = ((await res.json()) as { id?: unknown }).id;
      } catch {
        id = null;
      }
      // Sin id del proveedor no hay evidencia: se reintenta (la Idempotency-Key evita el duplicado).
      if (typeof id !== "string" || id.length === 0) return { ok: false, codigo: "RESPUESTA_SIN_ID", reintentable: true };
      return { ok: true, idExterno: `resend:${id}` };
    },
  };
}

export function adaptadorWebPush(env: Entorno, fetchImpl: FetchLike = fetch): AdaptadorCanal {
  const claves = cargarClavesVapid(env);
  if (!claves) return adaptadorNoHabilitado("PUSH");
  return {
    nombre: "WEB_PUSH_VAPID",
    canal: "PUSH",
    habilitado: true,
    async enviar(msg) {
      const subs = msg.push ?? [];
      if (subs.length === 0) return { ok: false, codigo: "SIN_SUSCRIPCION_PUSH", reintentable: false };
      const payload = Buffer.from(
        JSON.stringify({ id: msg.id, titulo: msg.asunto.slice(0, 120), cuerpo: msg.texto.slice(0, 300), ruta: msg.ruta }),
      );
      const ids: string[] = [];
      const expirados: string[] = [];
      let reintentable = false;
      let ultimo = "SIN_SUSCRIPCION_PUSH";
      for (const s of subs) {
        const r = await enviarPushA(s, payload, claves, fetchImpl);
        if (r.ok) ids.push(r.idExterno);
        else {
          ultimo = r.codigo;
          if (r.expirada) expirados.push(s.endpoint);
          if (r.reintentable) reintentable = true;
        }
      }
      if (ids.length > 0) return { ok: true, idExterno: ids.join(" ").slice(0, 300), expirados };
      if (expirados.length === subs.length) return { ok: false, codigo: "SIN_SUSCRIPCION_PUSH", reintentable: false, expirados };
      return { ok: false, codigo: ultimo, reintentable, expirados };
    },
  };
}

/** Punto único de selección. Sin credenciales, el canal queda "no habilitado" (nunca se simula un envío). */
export function seleccionarAdaptador(canal: Canal, env: Entorno = process.env, fetchImpl: FetchLike = fetch): AdaptadorCanal {
  if (canal === "EMAIL") return adaptadorResend(env, fetchImpl);
  if (canal === "PUSH") return adaptadorWebPush(env, fetchImpl);
  // PANEL se entrega dentro de la base (notif_entregar_panel), no por un adaptador.
  return adaptadorNoHabilitado(canal);
}

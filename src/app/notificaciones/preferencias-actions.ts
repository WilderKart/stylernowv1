"use server";

import { endpointPushValido } from "@/lib/notificaciones/web-push";
import { createClient } from "@/lib/supabase/server";

/**
 * Preferencias de notificación y suscripción push (migración 124).
 * Cero confianza: la identidad sale de la sesión (auth.uid() en la RPC); el navegador solo envía
 * evento/canal/valor o la suscripción, y todo se valida aquí y otra vez en la base.
 */
type Res = { ok: true } | { ok: false; error: string };
type RpcSinTipos = {
  rpc: (n: string, a?: object) => Promise<{ data: unknown; error: { message: string } | null }>;
};

const MENSAJES: Record<string, string> = {
  NO_AUTENTICADO: "Inicia sesión para continuar.",
  PREFERENCIA_ESENCIAL: "Este correo es obligatorio: confirma operaciones de tu cita o de tus pagos.",
  EVENTO_DESCONOCIDO: "Aviso desconocido.",
  VALOR_INVALIDO: "Valor inválido.",
  SUSCRIPCION_PUSH_INVALIDA: "Este navegador no entregó una suscripción válida.",
};

function traducir(mensaje: string): string {
  const codigo = Object.keys(MENSAJES).find((c) => mensaje.includes(c));
  return codigo ? MENSAJES[codigo] : "No pudimos guardar el cambio. Intenta de nuevo.";
}

async function clienteConSesion() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  return supabase as unknown as RpcSinTipos;
}

export async function guardarPreferenciaAction(evento: string, canal: string, activo: boolean): Promise<Res> {
  if (typeof evento !== "string" || !/^[A-Z][A-Z0-9_]{2,60}$/.test(evento)) return { ok: false, error: MENSAJES.EVENTO_DESCONOCIDO };
  if (canal !== "EMAIL" && canal !== "PUSH") return { ok: false, error: MENSAJES.VALOR_INVALIDO };
  if (typeof activo !== "boolean") return { ok: false, error: MENSAJES.VALOR_INVALIDO };
  const sb = await clienteConSesion();
  if (!sb) return { ok: false, error: MENSAJES.NO_AUTENTICADO };
  const { error } = await sb.rpc("notif_preferencia_guardar", { p_evento: evento, p_canal: canal, p_activo: activo });
  return error ? { ok: false, error: traducir(error.message) } : { ok: true };
}

const B64URL_P256DH = /^[A-Za-z0-9_-]{86,88}={0,2}$/;
const B64URL_AUTH = /^[A-Za-z0-9_-]{21,24}={0,2}$/;

export async function suscribirPushAction(sub: { endpoint?: unknown; keys?: { p256dh?: unknown; auth?: unknown } }): Promise<Res> {
  const endpoint = sub?.endpoint;
  const p256dh = sub?.keys?.p256dh;
  const auth = sub?.keys?.auth;
  if (!endpointPushValido(endpoint) || typeof p256dh !== "string" || !B64URL_P256DH.test(p256dh)
      || typeof auth !== "string" || !B64URL_AUTH.test(auth)) {
    return { ok: false, error: MENSAJES.SUSCRIPCION_PUSH_INVALIDA };
  }
  const sb = await clienteConSesion();
  if (!sb) return { ok: false, error: MENSAJES.NO_AUTENTICADO };
  const { error } = await sb.rpc("notif_push_suscribir", { p_endpoint: endpoint, p_p256dh: p256dh, p_auth: auth });
  return error ? { ok: false, error: traducir(error.message) } : { ok: true };
}

export async function desuscribirPushAction(endpoint: string): Promise<Res> {
  if (typeof endpoint !== "string" || endpoint.length > 1024) return { ok: false, error: MENSAJES.VALOR_INVALIDO };
  const sb = await clienteConSesion();
  if (!sb) return { ok: false, error: MENSAJES.NO_AUTENTICADO };
  const { error } = await sb.rpc("notif_push_desuscribir", { p_endpoint: endpoint });
  return error ? { ok: false, error: traducir(error.message) } : { ok: true };
}

import "server-only";

import { ipDelLlamador } from "@/lib/rate-limit";

/**
 * Verificación de Cloudflare Turnstile EN EL SERVIDOR (el widget del navegador solo entrega un token;
 * la decisión siempre se toma aquí con la clave secreta, que nunca sale del servidor).
 *
 * Acciones protegidas: registro, ingreso con contraseña y recuperación de contraseña.
 *
 * Sin `TURNSTILE_SECRET_KEY`:
 *  · en producción de Vercel se FALLA CERRADO (se rechaza): un despliegue mal configurado no debe
 *    quedar sin protección contra bots sin que nadie lo note;
 *  · en local / vista previa se omite, para no bloquear el desarrollo.
 * Cualquier error de red con Cloudflare también falla cerrado.
 */
export type AccionTurnstile = "registro" | "ingreso" | "recuperar" | "solicitud" | "seguimiento";

const URL_VERIFICAR = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

export async function verificarTurnstile(token: unknown, accion: AccionTurnstile): Promise<boolean> {
  const secreto = process.env.TURNSTILE_SECRET_KEY?.trim();
  if (!secreto) {
    if (process.env.VERCEL_ENV === "production") {
      console.error("[turnstile] TURNSTILE_SECRET_KEY no está configurada en producción: se rechaza la acción", accion);
      return false;
    }
    return true;
  }
  if (typeof token !== "string" || token.length < 10 || token.length > 2048) return false;

  const cuerpo = new URLSearchParams({ secret: secreto, response: token });
  const ip = await ipDelLlamador();
  if (ip && ip !== "sin-ip") cuerpo.set("remoteip", ip);

  try {
    const r = await fetch(URL_VERIFICAR, { method: "POST", body: cuerpo, signal: AbortSignal.timeout(8000), cache: "no-store" });
    const datos = (await r.json()) as { success?: boolean; action?: string; "error-codes"?: string[] };
    if (datos.success !== true) {
      console.warn("[turnstile] token rechazado", accion, datos["error-codes"]?.join(",") ?? "");
      return false;
    }
    // El token debe haberse emitido para ESTA acción (no se reutiliza el del ingreso para registrarse).
    if (datos.action && datos.action !== accion) return false;
    return true;
  } catch (e) {
    console.error("[turnstile] no se pudo verificar", accion, e instanceof Error ? e.message : e);
    return false;
  }
}

export const MENSAJE_TURNSTILE = "No pudimos confirmar que eres una persona. Espera unos segundos e inténtalo de nuevo.";

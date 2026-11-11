"use server";

import { contarNoLeidas, marcarNotificacionLeida, marcarTodasLeidas } from "@/lib/cliente/notificaciones";

/** La identidad sale de la sesión (auth.uid() en la RPC); el navegador solo envía el id de la notificación. */
export async function marcarLeidaAction(id: string): Promise<{ ok: boolean; error?: string }> {
  if (typeof id !== "string" || id.length < 8 || id.length > 64) return { ok: false, error: "Notificación inválida." };
  const r = await marcarNotificacionLeida(id);
  return r.ok ? { ok: true } : { ok: false, error: r.error };
}

export async function marcarTodasLeidasAction(): Promise<{ ok: boolean; error?: string }> {
  const r = await marcarTodasLeidas();
  return r.ok ? { ok: true } : { ok: false, error: r.error };
}

export async function contarNoLeidasAction(): Promise<number> {
  const r = await contarNoLeidas();
  return r.ok ? Number(r.data) || 0 : 0;
}

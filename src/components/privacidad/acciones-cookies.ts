"use server";

import { guardarPrivacidad } from "@/lib/cliente/privacidad";

/**
 * Guarda la elección del banner de cookies SOLO si hay sesión (la identidad sale de la
 * sesión en servidor, nunca del navegador). Sin sesión devuelve ok:false y el banner
 * conserva la decisión en localStorage.
 */
export async function guardarEleccionCookies(analitica: boolean): Promise<{ ok: boolean }> {
  const r = await guardarPrivacidad({ analitica: analitica === true });
  return { ok: r.ok };
}

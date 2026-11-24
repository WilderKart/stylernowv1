/** Preferencia de apariencia (claro / oscuro / automático). Compartido por servidor y navegador. */

export const COOKIE_TEMA = "sn_tema"; // lo que la persona eligió: light | dark | auto
export const COOKIE_TEMA_SISTEMA = "sn_tema_sis"; // lo que el dispositivo prefiere (se actualiza en el navegador)

export type ModoTema = "light" | "dark" | "auto";
export type TemaEfectivo = "light" | "dark";

export const esModoTema = (v: unknown): v is ModoTema => v === "light" || v === "dark" || v === "auto";
export const esTemaEfectivo = (v: unknown): v is TemaEfectivo => v === "light" || v === "dark";

/**
 * Tema que se pinta en el servidor, para que la página llegue ya en oscuro (sin destello).
 * En «auto» se usa lo que el dispositivo declaró la última vez (cookie del sistema); la primera vez, claro.
 */
export function temaEfectivo(modo: string | undefined, sistema: string | undefined): TemaEfectivo {
  if (modo === "dark") return "dark";
  if (modo === "light") return "light";
  if (modo === "auto") return sistema === "dark" ? "dark" : "light";
  return "light";
}

import "server-only";

import { cookies } from "next/headers";
import { COOKIE_IDIOMA, IDIOMA_BASE, crearTraductor, esIdioma, type Idioma } from "./diccionario";

/** Idioma de la persona: cookie `sn_idioma` (se fija en Ajustes → Idioma y región). Sin cookie, español. */
export async function obtenerIdioma(): Promise<Idioma> {
  try {
    const valor = (await cookies()).get(COOKIE_IDIOMA)?.value;
    return esIdioma(valor) ? valor : IDIOMA_BASE;
  } catch {
    return IDIOMA_BASE;
  }
}

/** Traductor para Server Components: `const t = await obtenerT(); t("nav.explorar")`. */
export async function obtenerT() {
  return crearTraductor(await obtenerIdioma());
}

/** Fija la cookie de idioma (solo desde Server Actions / Route Handlers). */
export async function fijarIdioma(idioma: Idioma) {
  try {
    (await cookies()).set(COOKIE_IDIOMA, idioma, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
  } catch {
    /* fuera de un contexto que permita escribir cookies: se ignora */
  }
}

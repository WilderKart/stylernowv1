"use server";

import { actualizarIdiomaRegion, guardarPermisos, type EstadoPermiso, type Idioma, type Pais } from "@/lib/cliente/preferencias";

const PAISES: readonly Pais[] = ["CO", "US", "MX", "ES"];
const IDIOMAS: readonly Idioma[] = ["es", "en"];
const PERMISOS: readonly EstadoPermiso[] = ["PERMITIDO", "MAS_TARDE"];

type Res = { ok: true } | { ok: false; error: string };

/** C11 «Continuar». Se valida el dominio aquí y otra vez en la RPC; la identidad sale de la sesión. */
export async function guardarIdiomaRegionAction(pais: string, locale: string): Promise<Res> {
  if (!PAISES.includes(pais as Pais)) return { ok: false, error: "País no disponible." };
  if (!IDIOMAS.includes(locale as Idioma)) return { ok: false, error: "Idioma no disponible." };
  const r = await actualizarIdiomaRegion(pais as Pais, locale as Idioma);
  return r.ok ? { ok: true } : { ok: false, error: r.error };
}

/** C12. `null` = sin cambio. `completar` marca el onboarding como terminado (botón «Empezar»). */
export async function guardarPermisosAction(
  ubicacion: string | null,
  notificaciones: string | null,
  completar: boolean,
): Promise<Res> {
  const u = ubicacion === null ? null : PERMISOS.includes(ubicacion as EstadoPermiso) ? (ubicacion as EstadoPermiso) : undefined;
  const n = notificaciones === null ? null : PERMISOS.includes(notificaciones as EstadoPermiso) ? (notificaciones as EstadoPermiso) : undefined;
  if (u === undefined || n === undefined) return { ok: false, error: "Valor de permiso inválido." };
  const r = await guardarPermisos(u, n, completar === true);
  return r.ok ? { ok: true } : { ok: false, error: r.error };
}

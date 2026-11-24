import "server-only";

import { cookies } from "next/headers";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { categoriaRegistroDe } from "@/lib/auth/destino-inicial";
import { categoriaDeAspecto, esCategoriaRegistro, type CategoriaRegistro } from "./vertical";

/**
 * Categoría que da aspecto a toda la app (spa, salón y uñas cambian colores y fuentes; barbería y tattoo no).
 * Es SOLO decorativa: va en una cookie que el servidor valida contra la lista permitida al leerla y que nunca
 * decide permisos ni acceso a datos.
 */
export const COOKIE_CATEGORIA = "sn_vert";

export async function fijarCategoriaAspecto(categoria: CategoriaRegistro | null): Promise<void> {
  try {
    const c = await cookies();
    if (!categoria) return void c.delete(COOKIE_CATEGORIA);
    c.set(COOKIE_CATEGORIA, categoria, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax", secure: process.env.NODE_ENV === "production" });
  } catch {
    /* fuera de un contexto que permita cookies: el aspecto simplemente no se guarda */
  }
}

export async function obtenerCategoriaAspecto(): Promise<CategoriaRegistro | null> {
  try {
    const v = (await cookies()).get(COOKIE_CATEGORIA)?.value;
    return esCategoriaRegistro(v) ? v : null;
  } catch {
    return null;
  }
}

/** Tras ingresar: el aspecto sigue a lo que la persona eligió (interés del cliente, tipo al registrarse o su negocio). */
export async function fijarAspectoDeCuenta(supabase: SupabaseClient, user: User): Promise<void> {
  const [{ data: perfil }, { data: negocio }] = await Promise.all([
    supabase.from("perfil").select("categorias_interes").eq("id", user.id).maybeSingle(),
    supabase.from("negocio").select("categoria").eq("owner_user_id", user.id).limit(1).maybeSingle(),
  ]);
  const candidata = negocio?.categoria?.[0] ?? perfil?.categorias_interes?.[0] ?? categoriaRegistroDe(user);
  await fijarCategoriaAspecto(categoriaDeAspecto(candidata));
}

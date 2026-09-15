import "server-only";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

/**
 * Guarda de acceso del SuperSU CMS (Fase 3) — superficie completamente
 * separada del Panel Negocio: `02-UX/10_Super_Admin.md` es explícito en
 * que "ninguna acción de este CMS es accesible desde ninguna otra
 * superficie". No reutiliza `resolverContexto()` (ese resolutor es para
 * los roles del lado Negocio — Barbería/Guardian/Staff) — acá el único
 * chequeo real es `perfil.es_supersu`, la misma columna que ya usa
 * `is_supersu()` del lado de la base (RLS/RPCs), así nunca hay dos
 * fuentes de verdad distintas sobre quién es SuperSU.
 */
export async function requireSuperSU() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/admin");

  const { data: perfil } = await supabase.from("perfil").select("es_supersu, nombre").eq("id", user.id).maybeSingle();
  if (!perfil?.es_supersu) redirect("/panel");

  return { userId: user.id, nombre: perfil.nombre };
}

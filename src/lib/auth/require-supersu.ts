import "server-only";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

/**
 * Guarda de acceso del SuperSU CMS (Fase 3) — superficie completamente
 * separada del Panel Negocio: `02-UX/10_Super_Admin.md` es explícito en
 * que "ninguna acción de este CMS es accesible desde ninguna otra
 * superficie". No reutiliza `resolverContexto()` (ese resolutor es para
 * los roles del lado Negocio — Barbería/Guardian/Staff) — aquí el único
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

  // ADR-015, Fase D: SuperSU nunca entra con Google — solo correo + contraseña
  // (+ MFA, fase siguiente). Si esta cuenta autenticó vía Google, se cierra la
  // sesión y se manda de nuevo a /login en vez de dejarla pasar.
  if (user.app_metadata?.provider === "google") {
    await supabase.auth.signOut();
    redirect("/login?next=/admin&error=supersu_requiere_password");
  }

  return { userId: user.id, nombre: perfil.nombre };
}

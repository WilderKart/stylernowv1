import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

/**
 * Guarda de las Server Actions del Super Admin (/admin). Una Server Action es un endpoint POST invocable sin pasar por la
 * interfaz, así que la autorización se decide AQUÍ, en el servidor, con la sesión y la columna `perfil.es_supersu` (la misma
 * fuente que usa `is_supersu()` en la base), nunca con nada que mande el navegador. La base vuelve a exigirlo en cada RPC/RLS
 * (segunda capa); esta es la primera.
 *
 * A diferencia de `requireSuperSU()` (páginas), no redirige: devuelve un resultado para que cada acción responda con su
 * propio `{ ok: false, error }`. Igual que en las páginas, una cuenta que autenticó con Google nunca actúa como Super Admin.
 */
export type AutorizacionSuperSU =
  | { ok: true; supabase: SupabaseClient<Database>; userId: string }
  | { ok: false; error: string };

export async function autorizarSuperSU(): Promise<AutorizacionSuperSU> {
  const supabase = (await createClient()) as SupabaseClient<Database>;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Tu sesión expiró. Vuelve a iniciar sesión." };

  const { data: perfil } = await supabase.from("perfil").select("es_supersu").eq("id", user.id).maybeSingle();
  if (perfil?.es_supersu !== true || user.app_metadata?.provider === "google") {
    return { ok: false, error: "No tienes permiso de SuperSU." };
  }
  return { ok: true, supabase, userId: user.id };
}

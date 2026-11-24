"use server";

import { createClient } from "@/lib/supabase/server";
import { esCategoriaRegistro } from "@/lib/tema/vertical";
import { revalidatePath } from "next/cache";

/** Guarda el servicio que busca el cliente (interés del perfil). Solo da aspecto a su portada; nunca permisos. */
export async function guardarServicioPreferido(categoria: unknown): Promise<{ ok: true } | { ok: false; error: string }> {
  if (categoria !== null && !esCategoriaRegistro(categoria)) return { ok: false, error: "Opción no válida." };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Inicia sesión de nuevo." };
  const { error } = await supabase
    .from("perfil")
    .update({ categorias_interes: categoria ? [categoria] : [] })
    .eq("id", user.id);
  if (error) return { ok: false, error: "No pudimos guardar tu elección. Intenta de nuevo." };
  revalidatePath("/");
  return { ok: true };
}

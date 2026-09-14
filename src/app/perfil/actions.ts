"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export type ResultadoPerfil = { ok: true } | { ok: false; error: string };

/**
 * Edición del propio perfil (03-Business-Rules/01_Roles.md, "Editar perfil": 🔒
 * solo su propio recurso). RLS `perfil_update_propio` ya limita la fila al dueño
 * de la sesión — este action no necesita repetir esa validación, solo saneamos
 * el dato antes de escribir.
 */
export async function actualizarPerfil(datos: {
  nombre: string;
  telefono: string;
}): Promise<ResultadoPerfil> {
  const nombre = datos.nombre.trim();
  const telefono = datos.telefono.trim();

  if (nombre.length < 2) {
    return { ok: false, error: "El nombre es muy corto." };
  }
  if (telefono && !/^\+?[0-9\s-]{7,15}$/.test(telefono)) {
    return { ok: false, error: "Revisá el formato del teléfono." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Tu sesión expiró. Volvé a iniciar sesión." };

  const { error } = await supabase
    .from("perfil")
    .update({ nombre, telefono: telefono || null })
    .eq("id", user.id);

  if (error) return { ok: false, error: error.message };

  revalidatePath("/perfil");
  return { ok: true };
}

export async function cerrarSesion() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
}

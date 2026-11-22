"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

type Resultado = { ok: true } | { ok: false; error: string };

/** Descripción y contacto del perfil público. Solo el propietario; la base de datos (RLS) lo vuelve a exigir. */
export async function guardarPerfilPublico(datos: {
  negocioId: string;
  descripcion: string;
  telefono: string;
  email: string;
}): Promise<Resultado> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Inicia sesión de nuevo." };
  if (datos.telefono.trim() && datos.telefono.replace(/\D/g, "").length < 7) return { ok: false, error: "Escribe un teléfono válido." };
  if (datos.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(datos.email.trim())) return { ok: false, error: "El correo no parece válido." };

  const { data, error } = await supabase
    .from("negocio")
    .update({
      descripcion: datos.descripcion.trim().slice(0, 600) || null,
      telefono_contacto: datos.telefono.trim() || null,
      email_contacto: datos.email.trim().toLowerCase() || null,
    })
    .eq("id", datos.negocioId)
    .eq("owner_user_id", user.id)
    .select("id");
  if (error || !data || data.length === 0) return { ok: false, error: "No pudimos guardar los cambios." };
  revalidatePath("/panel");
  revalidatePath("/panel/perfil-publico");
  return { ok: true };
}

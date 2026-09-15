"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export type ResultadoPerfil = { ok: true } | { ok: false; error: string };

/**
 * Edición del propio perfil (03-Business-Rules/01_Roles.md, "Editar perfil": 🔒
 * solo su propio recurso). RLS `perfil_update_propio` ya limita la fila al dueño
 * de la sesión — este action no necesita repetir esa validación, solo saneamos
 * el dato antes de escribir.
 *
 * Solo `nombre` es obligatorio. Teléfono, fecha de nacimiento e intereses son
 * opcionales pero incentivados en la UI (recordatorios de cita, promociones
 * relevantes, futuros beneficios de fidelización) — nunca bloquean el uso de
 * la app si se dejan vacíos.
 */
export async function actualizarPerfil(datos: {
  nombre: string;
  codigoPais: string;
  telefonoLocal: string;
  fechaNacimiento: string;
  categoriasInteres: string[];
}): Promise<ResultadoPerfil> {
  const nombre = datos.nombre.trim();
  const telefonoLocal = datos.telefonoLocal.replace(/\D/g, "");

  if (nombre.length < 2) {
    return { ok: false, error: "El nombre es muy corto." };
  }
  if (telefonoLocal && (telefonoLocal.length < 6 || telefonoLocal.length > 12)) {
    return { ok: false, error: "Revisá el número de celular." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Tu sesión expiró. Volvé a iniciar sesión." };

  const { error } = await supabase
    .from("perfil")
    .update({
      nombre,
      telefono: telefonoLocal ? `${datos.codigoPais}${telefonoLocal}` : null,
      fecha_nacimiento: datos.fechaNacimiento || null,
      categorias_interes: datos.categoriasInteres,
    })
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

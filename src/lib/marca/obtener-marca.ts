import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export interface MarcaPublica {
  nombreMarca: string;
  slogan: string | null;
  logoUrl: string | null;
  colorPrimario: string;
  colorSecundario: string;
}

const HEX = /^#[0-9A-Fa-f]{6}$/;

/**
 * Devuelve la marca del negocio solo si está PUBLICADA (RLS marca_select_publicada
 * también lo garantiza para lectores anónimos). Devuelve null si no hay marca,
 * es borrador o los colores guardados no son válidos.
 */
export async function obtenerMarcaPublica(negocioId: string): Promise<MarcaPublica | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("negocio_marca")
    .select("nombre_marca, slogan, logo_url, color_primario, color_secundario, estado")
    .eq("negocio_id", negocioId)
    .eq("estado", "PUBLICADA")
    .maybeSingle();
  if (!data || !HEX.test(data.color_primario) || !HEX.test(data.color_secundario)) return null;

  // Si el add-on se desactivó, la marca publicada deja de mostrarse. Se lee con service_role
  // solo este booleano: la RLS de negocio_addon únicamente deja leerlo al dueño.
  const { data: addon } = await createAdminClient()
    .from("negocio_addon")
    .select("activo")
    .eq("negocio_id", negocioId)
    .eq("addon_codigo", "MI_MARCA")
    .maybeSingle();
  if (!addon?.activo) return null;
  return {
    nombreMarca: data.nombre_marca,
    slogan: data.slogan,
    logoUrl: data.logo_url,
    colorPrimario: data.color_primario,
    colorSecundario: data.color_secundario,
  };
}

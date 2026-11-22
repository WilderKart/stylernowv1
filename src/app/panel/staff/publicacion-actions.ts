"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

/**
 * Publicación del profesional en la agenda pública (marketplace / negocio_staff_publico). Exige DOS cosas distintas de la fachada o galería
 * del negocio: foto PROFESIONAL (staff.foto_url) y consentimiento EXPRESO de publicación (AUTORIZACION_STAFF_PUBLICACION), con evidencia
 * inmutable (fecha, versión del texto, actor, huella). Sin una de las dos el profesional usa sus funciones privadas pero no aparece.
 * La regla la hace cumplir la base de datos (staff_es_publicable); esto solo la muestra y llama a las funciones de evidencia.
 */

type Resultado<T = undefined> =
  | ({ ok: true } & (T extends undefined ? object : { data: T }))
  | { ok: false; error: string };

export interface EstadoPublicacion {
  fotoUrl: string | null;
  tratamiento: "ACEPTA" | "REVOCA" | string | null;
  tratamientoAt: string | null;
  publicacion: "ACEPTA" | "REVOCA" | string | null;
  publicacionAt: string | null;
  /** Lo que ve hoy el público: foto + consentimiento vigente (o la ventana de transición para vínculos antiguos). */
  publicable: boolean;
}

const MENSAJES: Record<string, string> = {
  REQUIERE_TRATAMIENTO: "Primero debes aceptar el tratamiento de tus datos.",
  SIN_VINCULO: "Todavía no tienes un perfil profesional activo en este negocio.",
  NO_AUTORIZADO: "No tienes permiso para esta acción.",
  NO_AUTENTICADO: "Tu sesión expiró. Vuelve a iniciar sesión.",
  TEXTO_NO_DISPONIBLE: "El texto de la autorización no está disponible todavía. Intenta más tarde.",
};

function traducir(m: string) {
  const k = Object.keys(MENSAJES).find((c) => m.includes(c));
  return k ? MENSAJES[k] : m;
}

async function usuario() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("NO_AUTENTICADO");
  return { supabase, userId: user.id };
}

export async function obtenerEstadoPublicacion(negocioId: string): Promise<Resultado<EstadoPublicacion>> {
  try {
    const { supabase, userId } = await usuario();
    const [{ data: filas, error }, { data: staff }] = await Promise.all([
      supabase.rpc("estado_autorizaciones_staff", { p_negocio: negocioId }),
      supabase.from("staff").select("foto_url").eq("usuario_id", userId).maybeSingle(),
    ]);
    if (error) return { ok: false, error: traducir(error.message) };
    const mia = (filas ?? []).find((f) => f.staff_id === userId);
    if (!mia) return { ok: false, error: MENSAJES.SIN_VINCULO };
    return {
      ok: true,
      data: {
        fotoUrl: staff?.foto_url ?? null,
        tratamiento: mia.tratamiento,
        tratamientoAt: mia.tratamiento_at,
        publicacion: mia.publicacion,
        publicacionAt: mia.publicacion_at,
        publicable: Boolean(mia.publicable),
      },
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? traducir(e.message) : "Error inesperado." };
  }
}

/** Ambas casillas deben llegar marcadas por la persona (nada premarcado): el servidor rechaza si no. */
export async function autorizarPublicacion(datos: { aceptaTratamiento: boolean; aceptaPublicacion: boolean }): Promise<Resultado> {
  try {
    if (datos.aceptaPublicacion !== true) return { ok: false, error: "Marca la casilla de autorización para publicar tu imagen." };
    const { supabase } = await usuario();
    if (datos.aceptaTratamiento === true) {
      const t = await supabase.rpc("autorizar_staff", { p_documento: "AUTORIZACION_STAFF_TRATAMIENTO", p_canal: "perfil" });
      if (t.error) return { ok: false, error: traducir(t.error.message) };
    }
    const { error } = await supabase.rpc("autorizar_staff", { p_documento: "AUTORIZACION_STAFF_PUBLICACION", p_canal: "perfil" });
    if (error) return { ok: false, error: traducir(error.message) };
    revalidatePath("/panel");
    revalidatePath("/staff/perfil");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? traducir(e.message) : "Error inesperado." };
  }
}

/** Retira el consentimiento: deja de mostrarse de inmediato y queda evidencia de la revocación. */
export async function retirarPublicacion(): Promise<Resultado> {
  try {
    const { supabase } = await usuario();
    const { error } = await supabase.rpc("revocar_publicacion_staff");
    if (error) return { ok: false, error: traducir(error.message) };
    revalidatePath("/panel");
    revalidatePath("/staff/perfil");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? traducir(e.message) : "Error inesperado." };
  }
}

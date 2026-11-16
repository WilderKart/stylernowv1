import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import type { createClient } from "@/lib/supabase/server";
import type { User } from "@supabase/supabase-js";

/**
 * Tipo de cuenta elegido en «Crear cuenta» (rediseño 2026-11-16).
 *
 * REGLA: la intención NO es un permiso. Solo decide a qué pantalla se lleva a la persona después
 * de registrarse o de ingresar. Ser dueño de un negocio sigue dependiendo únicamente de tener un
 * `negocio` propio (`owner_user_id = auth.uid()`, impuesto por RLS al crearlo en el onboarding);
 * el Super Admin solo existe en la base de datos (`perfil.es_supersu`). Nada de lo que hay aquí
 * otorga, quita ni consulta roles administrativos.
 *
 * Se guarda en `app_metadata` (solo escribible con la clave de servicio), nunca en
 * `user_metadata`, que la persona puede editar desde el navegador.
 */
export type IntencionRegistro = "cliente" | "negocio";

export const RUTA_ONBOARDING = "/panel/onboarding";

type ClienteSupabase = Awaited<ReturnType<typeof createClient>>;

export function intencionDe(user: Pick<User, "app_metadata"> | null | undefined): IntencionRegistro | null {
  const v = user?.app_metadata?.intencion_registro;
  return v === "cliente" || v === "negocio" ? v : null;
}

/** Destino que corresponde a la intención elegida (sin `next` explícito). */
export function destinoPorIntencion(intencion: IntencionRegistro, siguiente: string) {
  if (intencion === "negocio") return RUTA_ONBOARDING;
  // Un cliente nunca termina en el onboarding de negocio por un `next` heredado de otra pantalla.
  return siguiente.startsWith(RUTA_ONBOARDING) ? "/" : siguiente;
}

/**
 * Guarda la intención con la clave de servicio. GoTrue fusiona `app_metadata` por clave, así que
 * `registro_pendiente` (migración 127) y `provider` se conservan. Un fallo aquí no rompe el
 * registro: la persona solo pierde el desvío automático (puede ir a «Para negocios» cuando quiera).
 */
export async function fijarIntencionRegistro(userId: string, intencion: IntencionRegistro) {
  try {
    const admin = createAdminClient();
    const { error } = await admin.auth.admin.updateUserById(userId, { app_metadata: { intencion_registro: intencion } });
    if (error) console.error("[fijarIntencionRegistro]", error.message);
  } catch (e) {
    console.error("[fijarIntencionRegistro]", e instanceof Error ? e.message : e);
  }
}

/**
 * A dónde va una sesión ya completa (perfil hecho) que no pidió un destino concreto.
 *  · `next` explícito y válido (ya pasó por destinoSeguro) → ese.
 *  · Se registró como negocio y aún no terminó el onboarding → /panel/onboarding (retoma donde
 *    quedó; el asistente reutiliza su negocio, nunca crea otro).
 *  · Se registró como negocio y su negocio está completo → /panel.
 *  · Cualquier otro caso → / (área de cliente).
 * La consulta del negocio pasa por RLS con la sesión de la persona: solo ve los suyos.
 */
export async function destinoInicial(supabase: ClienteSupabase, user: User, siguiente: string) {
  if (siguiente !== "/") return siguiente;
  if (intencionDe(user) !== "negocio") return "/";
  const { data } = await supabase
    .from("negocio")
    .select("id")
    .eq("owner_user_id", user.id)
    .eq("onboarding_completo", true)
    .limit(1);
  return data && data.length > 0 ? "/panel" : RUTA_ONBOARDING;
}

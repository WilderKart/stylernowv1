"use server";

import { aceptarTextosLegales, registrarAceptacionLegal } from "@/lib/auth/aceptacion-legal";
import { createClient } from "@/lib/supabase/server";

/**
 * Recalcula server-side qué versiones materiales siguen pendientes (nunca
 * confía en una lista de ids que vendría del cliente — zero-trust, mismo
 * criterio que el resto del proyecto) y las acepta todas de una vez.
 */
export async function aceptarPendientes(): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Tenés que iniciar sesión de nuevo." };

  const { pendientesMateriales } = await registrarAceptacionLegal(supabase, user.id);
  await aceptarTextosLegales(
    supabase,
    user.id,
    pendientesMateriales.map((t) => t.id)
  );
  return { ok: true };
}

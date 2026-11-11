"use server";

import { listarResenasProfesional, type ResenaProfesional } from "@/lib/cliente/profesionales";
import { createClient } from "@/lib/supabase/server";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
import { TAM_PAGINA_RESENAS } from "./constantes";

/** «Ver más»: el negocio sale del slug en el servidor, nunca de un id enviado por el navegador. */
export async function masResenasAction(
  slug: string,
  staffId: string,
  offset: number
): Promise<{ ok: true; resenas: ResenaProfesional[] } | { ok: false; error: string }> {
  if (!UUID.test(staffId) || !Number.isInteger(offset) || offset < 0 || offset > 1000) {
    return { ok: false, error: "Solicitud no válida." };
  }
  const supabase = await createClient();
  const { data: negocio } = await supabase.from("negocio").select("id").eq("slug", slug).eq("estado", "ACTIVO").maybeSingle();
  if (!negocio) return { ok: false, error: "Negocio no disponible." };
  const r = await listarResenasProfesional(negocio.id, staffId, { limite: TAM_PAGINA_RESENAS, offset });
  return r.ok ? { ok: true, resenas: r.data } : { ok: false, error: r.error };
}

"use server";

import { createClient } from "@/lib/supabase/server";

type Resultado<T = undefined> =
  | ({ ok: true } & (T extends undefined ? object : { data: T }))
  | { ok: false; error: string };

export interface EventoAuditoria {
  id: string;
  entidadTipo: string;
  entidadId: string | null;
  accion: string;
  actorTipo: string;
  motivo: string | null;
  createdAt: string;
}

export async function listarAuditoriaNegocio(entidadTipo?: string): Promise<Resultado<EventoAuditoria[]>> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new Error("NO_AUTENTICADO");

    let q = supabase
      .from("evento_auditoria")
      .select("id, entidad_tipo, entidad_id, accion, actor_tipo, motivo, created_at")
      .order("created_at", { ascending: false })
      .limit(200);
    if (entidadTipo) q = q.eq("entidad_tipo", entidadTipo);
    const { data, error } = await q;
    if (error) return { ok: false, error: error.message };
    return {
      ok: true,
      data: (data ?? []).map((e) => ({
        id: e.id,
        entidadTipo: e.entidad_tipo,
        entidadId: e.entidad_id,
        accion: e.accion,
        actorTipo: e.actor_tipo,
        motivo: e.motivo,
        createdAt: e.created_at,
      })),
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error inesperado." };
  }
}

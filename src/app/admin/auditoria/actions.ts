"use server";

import { createClient } from "@/lib/supabase/server";

type Resultado<T = undefined> =
  | ({ ok: true } & (T extends undefined ? object : { data: T }))
  | { ok: false; error: string };

async function usuarioActual() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("NO_AUTENTICADO");
  return { supabase, userId: user.id };
}

export interface EventoAuditoriaAdmin {
  id: string;
  entidadTipo: string;
  entidadId: string | null;
  accion: string;
  actorTipo: string;
  negocioNombre: string | null;
  motivo: string | null;
  createdAt: string;
}

export async function listarAuditoriaAdmin(filtros: { entidadTipo?: string; actorTipo?: string }): Promise<Resultado<EventoAuditoriaAdmin[]>> {
  try {
    const { supabase } = await usuarioActual();
    let q = supabase
      .from("evento_auditoria")
      .select("id, entidad_tipo, entidad_id, accion, actor_tipo, motivo, created_at, negocio:negocio_id (nombre)")
      .order("created_at", { ascending: false })
      .limit(200);
    if (filtros.entidadTipo) q = q.eq("entidad_tipo", filtros.entidadTipo);
    if (filtros.actorTipo)
      q = q.eq(
        "actor_tipo",
        filtros.actorTipo as "CLIENTE" | "STAFF" | "GUARDIAN" | "BARBERIA" | "SUPERSU" | "SISTEMA"
      );
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
        negocioNombre: (e.negocio as unknown as { nombre: string } | null)?.nombre ?? null,
        motivo: e.motivo,
        createdAt: e.created_at,
      })),
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error inesperado." };
  }
}

"use server";

import { createClient } from "@/lib/supabase/server";
import { z } from "zod";
import { aEvento, esquemaFiltros, POR_PAGINA, rangoFechas, UUID_RE, type FilaAuditoria, type PaginaAuditoria } from "@/lib/auditoria/listado";

/**
 * Auditoría de toda la plataforma (SuperSU). Cero confianza: se verifica aquí que la sesión sea
 * SuperSU y la RPC `auditoria_listar` (migración 123) lo vuelve a exigir en la base. Los filtros que
 * llegan del navegador se validan con zod antes de usarse.
 */

type Resultado<T> = { ok: true; data: T } | { ok: false; error: string };
type RpcSinTipos = { rpc: (n: string, a?: object) => Promise<{ data: unknown; error: { message: string } | null }> };

async function sesionSuperSU() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("NO_AUTENTICADO");
  const { data: perfil } = await supabase.from("perfil").select("es_supersu").eq("id", user.id).maybeSingle();
  if (!perfil?.es_supersu) throw new Error("NO_AUTORIZADO");
  return supabase;
}

function mensaje(e: unknown) {
  const m = e instanceof Error ? e.message : String(e);
  if (m.includes("NO_AUTENTICADO")) return "Tu sesión expiró. Vuelve a iniciar sesión.";
  if (m.includes("NO_AUTORIZADO")) return "No tienes permiso de SuperSU.";
  return "No pudimos cargar la auditoría.";
}

const esquemaAdmin = esquemaFiltros.extend({
  negocio: z.string().trim().max(80).optional(),
});

export interface NegocioOpcion {
  id: string;
  nombre: string;
}

export async function listarAuditoriaAdmin(entrada: z.input<typeof esquemaAdmin>): Promise<Resultado<PaginaAuditoria>> {
  try {
    const supabase = await sesionSuperSU();
    const f = esquemaAdmin.parse(entrada);

    // El filtro de negocio acepta un id exacto; el buscador por nombre usa buscarNegociosAuditoria().
    const negocioId = f.negocio && UUID_RE.test(f.negocio) ? f.negocio : null;
    if (f.negocio && !negocioId) return { ok: false, error: "Elige un negocio de la lista." };

    const { data, error } = await (supabase as unknown as RpcSinTipos).rpc("auditoria_listar", {
      p_negocio_id: negocioId,
      p_entidad_tipo: f.entidad ?? null,
      p_accion: f.accion ?? null,
      ...rangoFechas(f.desde, f.hasta),
      p_limite: POR_PAGINA + 1,
      p_offset: (f.pagina - 1) * POR_PAGINA,
    });
    if (error) return { ok: false, error: mensaje(new Error(error.message)) };
    const filas = (data ?? []) as FilaAuditoria[];
    return {
      ok: true,
      data: { eventos: filas.slice(0, POR_PAGINA).map(aEvento), pagina: f.pagina, hayMas: filas.length > POR_PAGINA },
    };
  } catch (e) {
    if (e instanceof z.ZodError) return { ok: false, error: "Filtros inválidos." };
    return { ok: false, error: mensaje(e) };
  }
}

export async function listarEntidadesAdmin(): Promise<Resultado<string[]>> {
  try {
    const supabase = await sesionSuperSU();
    const { data, error } = await (supabase as unknown as RpcSinTipos).rpc("auditoria_entidades", { p_negocio_id: null });
    if (error) return { ok: false, error: mensaje(new Error(error.message)) };
    return { ok: true, data: (data ?? []) as string[] };
  } catch (e) {
    return { ok: false, error: mensaje(e) };
  }
}

export async function buscarNegociosAuditoria(texto: string): Promise<Resultado<NegocioOpcion[]>> {
  try {
    const supabase = await sesionSuperSU();
    const t = z.string().trim().min(2).max(80).parse(texto).replace(/[%_\\,()]/g, " ");
    const { data, error } = await supabase
      .from("negocio")
      .select("id, nombre")
      .ilike("nombre", `%${t}%`)
      .order("nombre")
      .limit(10);
    if (error) return { ok: false, error: mensaje(new Error(error.message)) };
    return { ok: true, data: (data ?? []).map((n) => ({ id: n.id, nombre: n.nombre })) };
  } catch (e) {
    if (e instanceof z.ZodError) return { ok: true, data: [] };
    return { ok: false, error: mensaje(e) };
  }
}

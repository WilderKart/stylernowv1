"use server";

import { resolverContexto } from "@/lib/auth/resolver-contexto";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";
import { aEvento, esquemaFiltros, POR_PAGINA, rangoFechas, type FilaAuditoria, type PaginaAuditoria } from "@/lib/auditoria/listado";

/**
 * Auditoría del propio negocio (solo el dueño, 04_Audit.md). Cero confianza: el negocio se toma de la
 * sesión en el servidor (resolverContexto), nunca del navegador, y la RPC `auditoria_listar`
 * (migración 123) vuelve a exigir en la base que quien llama sea el dueño de ese negocio.
 */

type Resultado<T> = { ok: true; data: T } | { ok: false; error: string };
type RpcSinTipos = { rpc: (n: string, a?: object) => Promise<{ data: unknown; error: { message: string } | null }> };

async function negocioDelDueno() {
  const contexto = await resolverContexto();
  if (!contexto.userId) throw new Error("NO_AUTENTICADO");
  if (contexto.rol !== "BARBERIA" || !contexto.negocioId) throw new Error("NO_AUTORIZADO");
  return { supabase: await createClient(), negocioId: contexto.negocioId };
}

function mensaje(e: unknown) {
  const m = e instanceof Error ? e.message : String(e);
  if (m.includes("NO_AUTENTICADO")) return "Tu sesión expiró. Vuelve a iniciar sesión.";
  if (m.includes("NO_AUTORIZADO")) return "Solo la cuenta dueña del negocio puede ver la auditoría.";
  return "No pudimos cargar la auditoría.";
}

export async function listarAuditoriaNegocio(entrada: z.input<typeof esquemaFiltros>): Promise<Resultado<PaginaAuditoria>> {
  try {
    const { supabase, negocioId } = await negocioDelDueno();
    const f = esquemaFiltros.parse(entrada);
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

export async function listarEntidadesNegocio(): Promise<Resultado<string[]>> {
  try {
    const { supabase, negocioId } = await negocioDelDueno();
    const { data, error } = await (supabase as unknown as RpcSinTipos).rpc("auditoria_entidades", { p_negocio_id: negocioId });
    if (error) return { ok: false, error: mensaje(new Error(error.message)) };
    return { ok: true, data: (data ?? []) as string[] };
  } catch (e) {
    return { ok: false, error: mensaje(e) };
  }
}

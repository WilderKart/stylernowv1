"use server";

import { autorizarSuperSU } from "@/lib/auth/autorizar-supersu";
import { rpcAdmin } from "./_componentes/rpc";

export type ResultadoBusqueda = {
  negocios: { id: string; nombre: string; detalle: string }[];
  usuarios: { id: string; nombre: string | null; detalle: string | null }[];
  reservas: { id: string; nombre: string; detalle: string }[];
};

/** Buscador global del Super Admin. La base exige is_supersu() (migración 137). */
export async function buscarGlobal(q: string): Promise<ResultadoBusqueda | null> {
  // Autorización en el servidor (Super Admin); la base la vuelve a exigir en admin_buscar.
  const g = await autorizarSuperSU();
  if (!g.ok) return null;
  const texto = String(q ?? "").trim().slice(0, 80);
  if (texto.length < 2) return { negocios: [], usuarios: [], reservas: [] };
  const r = await rpcAdmin<ResultadoBusqueda>("admin_buscar", { p_q: texto });
  return r.ok ? r.data : null;
}

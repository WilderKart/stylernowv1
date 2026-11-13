import "server-only";

import { resolverContexto } from "@/lib/auth/resolver-contexto";
import { createClient } from "@/lib/supabase/server";
import { COLUMNAS_LIBRO, rangoFechas, type FiltrosLibro, type MovimientoLibro, type TotalLibro } from "./filtros";

/**
 * Consultas del libro financiero. Siempre con el cliente del USUARIO (nunca service_role):
 * la RLS de `libro_movimiento` es la que decide qué filas ve cada quien. El negocio sale de la
 * sesión verificada en el servidor; solo Super Admin puede elegir otro negocio o ver StylerNow.
 */

export const TAMANO_PAGINA = 50;
/** Tope de filas por exportación (evita respuestas enormes; se informa si se alcanza). */
export const MAX_EXPORTACION = 50_000;

type Cliente = Awaited<ReturnType<typeof createClient>>;

/** Tabla/RPC de la migración 122, aún sin tipos generados. */
type Consulta = {
  select: (c: string, o?: { count: "exact" }) => Consulta;
  eq: (c: string, v: string) => Consulta;
  gte: (c: string, v: string) => Consulta;
  lt: (c: string, v: string) => Consulta;
  or: (f: string) => Consulta;
  order: (c: string, o: { ascending: boolean }) => Consulta;
  range: (a: number, b: number) => Promise<{ data: unknown[] | null; count: number | null; error: { message: string } | null }>;
};
type SinTipos = {
  from: (t: string) => Consulta;
  rpc: (n: string, a: object) => Promise<{ data: unknown; error: { message: string } | null }>;
};

export interface AlcanceLibro {
  supabase: Cliente;
  esSuperSU: boolean;
  /** Negocio efectivo del filtro; null = todos (solo Super Admin). */
  negocioId: string | null;
}

export async function alcanceLibro(modo: "panel" | "admin", negocioSolicitado?: string): Promise<AlcanceLibro> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("NO_AUTENTICADO");

  if (modo === "admin") {
    const { data: perfil } = await supabase.from("perfil").select("es_supersu").eq("id", user.id).maybeSingle();
    if (!perfil?.es_supersu) throw new Error("NO_AUTORIZADO");
    return { supabase, esSuperSU: true, negocioId: negocioSolicitado ?? null };
  }

  const contexto = await resolverContexto();
  if (contexto.rol !== "BARBERIA" || !contexto.negocioId || contexto.userId !== user.id) throw new Error("NO_AUTORIZADO");
  // Un negocio nunca elige otro negocio: se ignora cualquier id que llegue del navegador.
  return { supabase, esSuperSU: false, negocioId: contexto.negocioId };
}

function aplicarFiltros(q: Consulta, a: AlcanceLibro, f: FiltrosLibro) {
  const { desde, hasta } = rangoFechas(f);
  if (a.negocioId) q = q.eq("negocio_id", a.negocioId);
  if (!a.esSuperSU) q = q.eq("entidad", "NEGOCIO");
  else if (f.entidad) q = q.eq("entidad", f.entidad);
  if (desde) q = q.gte("ocurrido_at", desde);
  if (hasta) q = q.lt("ocurrido_at", hasta);
  if (f.categoria) q = q.eq("categoria", f.categoria);
  if (f.estado) q = q.eq("estado", f.estado);
  if (f.referencia) {
    // La referencia ya viene validada (solo [A-Za-z0-9-]); si es UUID busca por ids, si no por id externo.
    const r = f.referencia;
    q = /^[0-9a-f-]{36}$/i.test(r)
      ? q.or(`referencia_id.eq.${r},pago_id.eq.${r},reserva_id.eq.${r},reembolso_id.eq.${r},id.eq.${r}`)
      : q.eq("id_externo", r);
  }
  return q;
}

export async function listarMovimientos(a: AlcanceLibro, f: FiltrosLibro) {
  const desdeFila = (f.pagina - 1) * TAMANO_PAGINA;
  const q = aplicarFiltros((a.supabase as unknown as SinTipos).from("libro_movimiento").select(COLUMNAS_LIBRO, { count: "exact" }), a, f)
    .order("ocurrido_at", { ascending: false })
    .order("id", { ascending: false });
  const { data, count, error } = await q.range(desdeFila, desdeFila + TAMANO_PAGINA - 1);
  if (error) throw new Error("LIBRO_NO_DISPONIBLE");
  return { filas: (data ?? []) as MovimientoLibro[], total: count ?? 0 };
}

export async function totalesLibro(a: AlcanceLibro, f: FiltrosLibro): Promise<TotalLibro[]> {
  const { desde, hasta } = rangoFechas(f);
  const { data, error } = await (a.supabase as unknown as SinTipos).rpc("libro_totales", {
    p_negocio_id: a.negocioId,
    p_desde: desde,
    p_hasta: hasta,
    p_categoria: f.categoria ?? null,
    p_estado: f.estado ?? null,
    p_entidad: a.esSuperSU ? (f.entidad ?? null) : "NEGOCIO",
  });
  if (error) throw new Error("LIBRO_NO_DISPONIBLE");
  return ((data ?? []) as TotalLibro[]).map((t) => ({ ...t, cantidad: Number(t.cantidad), total: Number(t.total) }));
}

/** Todas las filas del filtro (paginando de a 1000), hasta MAX_EXPORTACION. */
export async function movimientosParaExportar(a: AlcanceLibro, f: FiltrosLibro) {
  const filas: MovimientoLibro[] = [];
  for (let inicio = 0; inicio < MAX_EXPORTACION; inicio += 1000) {
    const q = aplicarFiltros((a.supabase as unknown as SinTipos).from("libro_movimiento").select(COLUMNAS_LIBRO), a, f)
      .order("ocurrido_at", { ascending: true })
      .order("id", { ascending: true });
    const { data, error } = await q.range(inicio, Math.min(inicio + 999, MAX_EXPORTACION - 1));
    if (error) throw new Error("LIBRO_NO_DISPONIBLE");
    const lote = (data ?? []) as MovimientoLibro[];
    filas.push(...lote);
    if (lote.length < 1000) return { filas, truncado: false };
  }
  return { filas, truncado: true };
}

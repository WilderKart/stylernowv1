import "server-only";
import { createClient } from "@/lib/supabase/server";
import { rpcAdmin } from "./_componentes/rpc";
import type { ContadoresAdmin } from "./barra-lateral";

/**
 * Datos del panel Super Admin. Todo sale de la base real con la sesión del Super Admin (RLS con
 * is_supersu()); nada se inventa. Las páginas que lo usan ya pasaron por requireSuperSU() en el layout.
 */

const ZONA = "America/Bogota";

export async function contadoresAdmin(): Promise<ContadoresAdmin> {
  const supabase = await createClient();
  const [neg, tic, res] = await Promise.all([
    supabase.from("negocio").select("id", { count: "exact", head: true }).eq("estado", "PENDIENTE_APROBACION"),
    supabase.from("ticket_soporte").select("id", { count: "exact", head: true }).in("estado", ["ABIERTO", "EN_PROCESO"]),
    supabase.from("resena").select("id", { count: "exact", head: true }).eq("estado", "REPORTADA"),
  ]);
  return {
    negociosPendientes: neg.count ?? 0,
    ticketsAbiertos: tic.count ?? 0,
    resenasReportadas: res.count ?? 0,
  };
}

export type DiaReservas = { dia: string; etiqueta: string; reservas: number; canceladas: number };
export type Actividad = { id: string; titulo: string; detalle: string; fecha: string; tipo: string };

export interface Tablero {
  usuarios: number;
  negociosPorEstado: Record<"ACTIVO" | "PENDIENTE_APROBACION" | "SUSPENDIDO" | "RECHAZADO" | "CANCELADO", number>;
  totalNegocios: number;
  reservas14: DiaReservas[];
  totalReservas14: number;
  totalCanceladas14: number;
  actividad: Actividad[];
}

const ACCIONES: Record<string, string> = {
  PRUEBA_INICIADA: "Prueba gratuita iniciada",
  NEGOCIO_APROBADO: "Negocio aprobado",
  NEGOCIO_RECHAZADO: "Negocio rechazado",
  NEGOCIO_SUSPENDIDO: "Negocio suspendido",
  NEGOCIO_REACTIVADO: "Negocio reactivado",
};

function tituloAccion(accion: string) {
  if (ACCIONES[accion]) return ACCIONES[accion];
  const t = accion.replace(/_/g, " ").toLowerCase();
  return t.charAt(0).toUpperCase() + t.slice(1);
}

function contarNegocios(supabase: Awaited<ReturnType<typeof createClient>>, estado: "ACTIVO" | "PENDIENTE_APROBACION" | "SUSPENDIDO" | "RECHAZADO" | "CANCELADO") {
  return supabase.from("negocio").select("id", { count: "exact", head: true }).eq("estado", estado);
}

export async function obtenerTablero(desde: Date, hasta: Date): Promise<Tablero> {
  const supabase = await createClient();

  const [perf, nAct, nPen, nSus, nRec, nCan, serie, evts] = await Promise.all([
    supabase.from("perfil").select("id", { count: "exact", head: true }),
    // Conteo exacto por estado en la base (sin traer filas ni topes).
    contarNegocios(supabase, "ACTIVO"),
    contarNegocios(supabase, "PENDIENTE_APROBACION"),
    contarNegocios(supabase, "SUSPENDIDO"),
    contarNegocios(supabase, "RECHAZADO"),
    contarNegocios(supabase, "CANCELADO"),
    // Serie diaria agregada en la base (zona horaria de Colombia), migración 137.
    rpcAdmin<{ serie: { dia: string; reservas: number; canceladas: number }[] }>("admin_reporte", {
      p_desde: desde.toISOString(),
      p_hasta: hasta.toISOString(),
    }),
    supabase
      .from("evento_auditoria")
      .select("id, entidad_tipo, accion, actor_tipo, negocio_id, created_at")
      .order("created_at", { ascending: false })
      .limit(6),
  ]);

  const negociosPorEstado: Tablero["negociosPorEstado"] = {
    ACTIVO: nAct.count ?? 0,
    PENDIENTE_APROBACION: nPen.count ?? 0,
    SUSPENDIDO: nSus.count ?? 0,
    RECHAZADO: nRec.count ?? 0,
    CANCELADO: nCan.count ?? 0,
  };

  const dias: DiaReservas[] = (serie.ok ? serie.data.serie : []).map((d) => ({
    dia: d.dia,
    etiqueta: new Intl.DateTimeFormat("es-CO", { timeZone: ZONA, day: "2-digit", month: "short" })
      .format(new Date(`${d.dia}T12:00:00-05:00`))
      .replace(".", ""),
    reservas: d.reservas,
    canceladas: d.canceladas,
  }));

  // Nombres de los negocios de la actividad reciente (una sola consulta).
  const eventos = evts.data ?? [];
  const ids = [...new Set(eventos.map((e) => e.negocio_id).filter((x): x is string => !!x))];
  const nombres = new Map<string, string>();
  if (ids.length > 0) {
    const { data } = await supabase.from("negocio").select("id, nombre").in("id", ids);
    for (const n of data ?? []) nombres.set(n.id, n.nombre);
  }

  return {
    usuarios: perf.count ?? 0,
    negociosPorEstado,
    totalNegocios: Object.values(negociosPorEstado).reduce((a, b) => a + b, 0),
    reservas14: dias,
    totalReservas14: dias.reduce((a, d) => a + d.reservas, 0),
    totalCanceladas14: dias.reduce((a, d) => a + d.canceladas, 0),
    actividad: eventos.map((e) => ({
      id: e.id,
      tipo: e.entidad_tipo,
      titulo: tituloAccion(e.accion),
      detalle: [e.negocio_id ? nombres.get(e.negocio_id) : null, e.actor_tipo?.toLowerCase()].filter(Boolean).join(" · "),
      fecha: e.created_at,
    })),
  };
}

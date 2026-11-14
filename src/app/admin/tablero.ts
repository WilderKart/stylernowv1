import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { ContadoresAdmin } from "./barra-lateral";

/**
 * Datos del panel Super Admin. Todo sale de la base real con la sesión del Super Admin (RLS con
 * is_supersu()); nada se inventa. Las páginas que lo usan ya pasaron por requireSuperSU() en el layout.
 */

const ZONA = "America/Bogota";
const diaLocal = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: ZONA }).format(d); // AAAA-MM-DD

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

export async function obtenerTablero(): Promise<Tablero> {
  const supabase = await createClient();
  const hoy = new Date();
  const desde = new Date(hoy.getTime() - 13 * 86_400_000);
  desde.setUTCHours(0, 0, 0, 0);
  // Margen de un día hacia atrás por la zona horaria; luego se agrupa por día de Bogotá.
  const desdeConsulta = new Date(desde.getTime() - 86_400_000).toISOString();

  const [perf, negs, resv, evts] = await Promise.all([
    supabase.from("perfil").select("id", { count: "exact", head: true }),
    supabase.from("negocio").select("estado").limit(10_000),
    supabase.from("reserva").select("created_at, estado").gte("created_at", desdeConsulta).limit(20_000),
    supabase
      .from("evento_auditoria")
      .select("id, entidad_tipo, accion, actor_tipo, negocio_id, created_at")
      .order("created_at", { ascending: false })
      .limit(6),
  ]);

  const negociosPorEstado: Tablero["negociosPorEstado"] = {
    ACTIVO: 0,
    PENDIENTE_APROBACION: 0,
    SUSPENDIDO: 0,
    RECHAZADO: 0,
    CANCELADO: 0,
  };
  for (const n of negs.data ?? []) {
    const e = n.estado as keyof typeof negociosPorEstado;
    if (e in negociosPorEstado) negociosPorEstado[e] += 1;
  }

  const dias: DiaReservas[] = [];
  const indice = new Map<string, DiaReservas>();
  for (let i = 13; i >= 0; i--) {
    const d = new Date(hoy.getTime() - i * 86_400_000);
    const clave = diaLocal(d);
    const fila = {
      dia: clave,
      etiqueta: new Intl.DateTimeFormat("es-CO", { timeZone: ZONA, day: "2-digit", month: "short" }).format(d).replace(".", ""),
      reservas: 0,
      canceladas: 0,
    };
    dias.push(fila);
    indice.set(clave, fila);
  }
  for (const r of resv.data ?? []) {
    const fila = indice.get(diaLocal(new Date(r.created_at)));
    if (!fila) continue;
    fila.reservas += 1;
    if (r.estado === "CANCELADA" || r.estado === "NO_SHOW") fila.canceladas += 1;
  }

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

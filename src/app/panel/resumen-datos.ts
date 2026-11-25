import { createClient } from "@/lib/supabase/server";
import { obtenerFuncionesReportes, obtenerIngresosPeriodo, obtenerServiciosTop } from "./reportes/actions";

/**
 * Datos de los widgets del Resumen (spa, salón y uñas). Módulo de servidor SIN "use server": no es un endpoint, solo
 * lo importa la página, que ya resolvió el contexto y el negocio autorizado. Todo pasa por RLS/RPC con la sesión del
 * usuario y respeta las banderas del plan (Reportes). Si algo falla o el plan no lo incluye, el widget lo dice; nunca
 * se inventan cifras.
 */

export interface MiembroEquipo {
  nombre: string;
  fotoUrl: string | null;
  especialidad: string | null;
}
export interface Notificacion {
  clave: string;
  titulo: string;
  detalle: string;
  cuando: string;
  href: string;
  tono: "violet" | "amber" | "blue";
}
export interface DatosResumenSuave {
  equipo: { total: number; miembros: MiembroEquipo[] };
  clientesActivos: number | null;
  citasAyer: number | null;
  servicios: { disponible: boolean; items: { nombre: string; veces: number }[] };
  ingresos: { disponible: boolean; puntos: { etiqueta: string; valor: number }[]; mesActual: number; mesAnterior: number | null };
  notificaciones: Notificacion[];
}

const hoyBogota = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Bogota" }).format(new Date());
function hace(iso: string) {
  const min = Math.max(Math.round((Date.now() - new Date(iso).getTime()) / 60000), 0);
  if (min < 1) return "Ahora";
  if (min < 60) return `Hace ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `Hace ${h} h`;
  const d = Math.round(h / 24);
  return `Hace ${d} ${d === 1 ? "día" : "días"}`;
}
const MESES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

function sumarDias(iso: string, dias: number) {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

export async function cargarDatosResumenSuave(negocioId: string, activo: boolean): Promise<DatosResumenSuave> {
  const supabase = await createClient();
  const hoy = hoyBogota();
  const ayer = sumarDias(hoy, -1);
  // Cinco meses: el actual y los cuatro anteriores.
  const [aa, mm] = hoy.split("-").map(Number);
  const inicio = new Date(Date.UTC(aa, mm - 1 - 4, 1)).toISOString().slice(0, 10);

  const rpc = supabase.rpc as unknown as (n: string, a: Record<string, unknown>) => Promise<{ data: { total: number | string }[] | null; error: unknown }>;

  const [equipoRes, activosRes, ayerRes, funciones, recientesRes] = await Promise.all([
    supabase
      .from("vista_staff_negocio")
      .select("nombre, foto_url, especialidad", { count: "exact" })
      .eq("negocio_id", negocioId)
      .eq("estado", "ACTIVO")
      .order("nombre", { ascending: true })
      .limit(6),
    activo
      ? rpc.call(supabase, "crm_clientes_filtrados", {
          p_negocio_id: negocioId,
          p_sede_id: null,
          p_etiqueta: null,
          p_solo_consentimiento: false,
          p_patron_nombre: null,
          p_patron_telefono: null,
          p_ltv_min: null,
          p_ltv_max: null,
          p_ultima_despues: sumarDias(hoy, -90),
          p_ultima_antes: null,
          p_primera_despues: null,
          p_primera_antes: null,
          p_orden: "nombre",
          p_offset: 0,
          p_limite: 1,
        })
      : Promise.resolve({ data: null, error: null }),
    activo
      ? supabase
          .from("reserva")
          .select("id", { count: "exact", head: true })
          .eq("negocio_id", negocioId)
          .gte("hora_inicio", new Date(`${ayer}T00:00:00-05:00`).toISOString())
          .lte("hora_inicio", new Date(`${ayer}T23:59:59.999-05:00`).toISOString())
          .neq("estado", "CANCELADA")
      : Promise.resolve({ count: null }),
    obtenerFuncionesReportes(negocioId),
    activo
      ? supabase
          .from("reserva")
          .select("id, created_at, hora_inicio, cliente:cliente_id (nombre)")
          .eq("negocio_id", negocioId)
          .neq("estado", "CANCELADA")
          .order("created_at", { ascending: false })
          .limit(3)
      : Promise.resolve({ data: [] }),
  ]);

  // Servicios e ingresos dependen del plan (Reportes): se piden solo si la bandera lo permite.
  const [serviciosRes, ingresosRes] = activo
    ? await Promise.all([
        funciones.periodo ? obtenerServiciosTop(negocioId) : Promise.resolve(null),
        funciones.periodo ? obtenerIngresosPeriodo({ negocioId, desde: inicio, hasta: hoy, agrupacion: "mes" }) : Promise.resolve(null),
      ])
    : [null, null];

  const miembros: MiembroEquipo[] = (equipoRes.data ?? []).map((s) => ({ nombre: s.nombre ?? "Profesional", fotoUrl: s.foto_url ?? null, especialidad: s.especialidad ?? null }));

  const servicios = serviciosRes && serviciosRes.ok ? serviciosRes.data.slice(0, 4).map((s) => ({ nombre: s.nombre, veces: s.vecesVendido })) : [];

  // Serie de 5 meses con ceros explícitos donde no hubo ingresos (el RPC solo devuelve meses con datos).
  const porMes = new Map<string, number>();
  if (ingresosRes && ingresosRes.ok) for (const p of ingresosRes.data) porMes.set(p.periodo.slice(0, 7), p.ingresos);
  const puntos = Array.from({ length: 5 }, (_, i) => {
    const d = new Date(Date.UTC(aa, mm - 1 - (4 - i), 1));
    return { etiqueta: MESES[d.getUTCMonth()], valor: porMes.get(d.toISOString().slice(0, 7)) ?? 0 };
  });

  const notificaciones: Notificacion[] = [];
  for (const r of (recientesRes.data ?? []) as { id: string; created_at: string; hora_inicio: string; cliente: { nombre: string } | null }[]) {
    const dia = new Date(r.hora_inicio).toLocaleDateString("es-CO", { weekday: "short", day: "numeric", month: "short", timeZone: "America/Bogota" });
    const hora = new Date(r.hora_inicio).toLocaleTimeString("es-CO", { hour: "numeric", minute: "2-digit", timeZone: "America/Bogota" });
    notificaciones.push({
      clave: r.id,
      titulo: "Nueva reserva",
      detalle: `${r.cliente?.nombre ?? "Un cliente"} reservó para ${dia} a las ${hora}.`,
      cuando: hace(r.created_at),
      href: "/panel/agenda",
      tono: "violet",
    });
  }

  return {
    equipo: { total: equipoRes.count ?? miembros.length, miembros },
    clientesActivos: activosRes.data && activosRes.data.length > 0 ? Number(activosRes.data[0].total) : activo && !activosRes.error ? 0 : null,
    citasAyer: ayerRes.count ?? null,
    servicios: { disponible: funciones.periodo, items: servicios },
    ingresos: {
      disponible: funciones.periodo,
      puntos,
      mesActual: puntos[4].valor,
      mesAnterior: ingresosRes && ingresosRes.ok ? puntos[3].valor : null,
    },
    notificaciones,
  };
}

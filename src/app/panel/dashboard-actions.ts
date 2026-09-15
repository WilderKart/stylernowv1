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

// ── Resumen del día (01-PRD/05_KPIs.md: citas, ingresos, % ocupación, próxima) ─

export interface ResumenDia {
  citasHoy: number;
  ingresosHoy: number;
  ocupacionPct: number | null;
  proximaCita: { reservaId: string; horaInicio: string; staffNombre: string | null; sedeId: string } | null;
}

export async function obtenerResumenDia(negocioId: string, sedeId?: string | null): Promise<Resultado<ResumenDia>> {
  try {
    const { supabase } = await usuarioActual();
    const { data, error } = await supabase.rpc("dashboard_resumen_dia", {
      p_negocio_id: negocioId,
      p_sede_id: sedeId ?? undefined,
    });
    if (error) return { ok: false, error: error.message };

    const r = data as {
      citas_hoy: number;
      ingresos_hoy: number;
      ocupacion_pct: number | null;
      proxima_cita: { reserva_id: string; hora_inicio: string; staff_nombre: string | null; sede_id: string } | null;
    };

    return {
      ok: true,
      data: {
        citasHoy: r.citas_hoy,
        ingresosHoy: r.ingresos_hoy,
        ocupacionPct: r.ocupacion_pct,
        proximaCita: r.proxima_cita
          ? {
              reservaId: r.proxima_cita.reserva_id,
              horaInicio: r.proxima_cita.hora_inicio,
              staffNombre: r.proxima_cita.staff_nombre,
              sedeId: r.proxima_cita.sede_id,
            }
          : null,
      },
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error inesperado." };
  }
}

// ── Ranking de Staff de la semana, por comisión generada ────────────────────

export interface RankingStaffItem {
  vinculoId: string;
  nombre: string;
  fotoUrl: string | null;
  sedeNombre: string | null;
  comisionGenerada: number;
  reservasCompletadas: number;
}

export async function obtenerRankingSemana(negocioId: string, sedeId?: string | null): Promise<Resultado<RankingStaffItem[]>> {
  try {
    const { supabase } = await usuarioActual();
    const { data, error } = await supabase.rpc("dashboard_ranking_staff_semana", {
      p_negocio_id: negocioId,
      p_sede_id: sedeId ?? undefined,
    });
    if (error) return { ok: false, error: error.message };
    return {
      ok: true,
      data: (data ?? []).map((r) => ({
        vinculoId: r.vinculo_id!,
        nombre: r.nombre!,
        fotoUrl: r.foto_url,
        sedeNombre: r.sede_nombre,
        comisionGenerada: r.comision_generada!,
        reservasCompletadas: r.reservas_completadas!,
      })),
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error inesperado." };
  }
}

// ── Línea de tiempo del día — SELECT directo, RLS ya lo protege ────────────

export interface CitaDelDia {
  id: string;
  horaInicio: string;
  horaFin: string;
  estado: string;
  clienteNombre: string;
  staffNombre: string | null;
  servicios: string;
}

export async function obtenerLineaTiempoDia(negocioId: string, sedeId?: string | null): Promise<Resultado<CitaDelDia[]>> {
  try {
    const { supabase } = await usuarioActual();
    const hoy = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Bogota" }).format(new Date());
    const inicioDia = new Date(`${hoy}T00:00:00-05:00`).toISOString();
    const finDia = new Date(`${hoy}T23:59:59.999-05:00`).toISOString();

    let q = supabase
      .from("reserva")
      .select(
        `id, estado, hora_inicio, hora_fin,
         cliente:cliente_id (nombre),
         staff:staff_id (nombre),
         reserva_servicio (servicio:servicio_id (nombre))`
      )
      .eq("negocio_id", negocioId)
      .gte("hora_inicio", inicioDia)
      .lte("hora_inicio", finDia)
      .neq("estado", "CANCELADA")
      .order("hora_inicio", { ascending: true });
    if (sedeId) q = q.eq("sede_id", sedeId);

    const { data, error } = await q;
    if (error) return { ok: false, error: error.message };

    const citas: CitaDelDia[] = (data ?? []).map((r) => ({
      id: r.id,
      horaInicio: r.hora_inicio,
      horaFin: r.hora_fin,
      estado: r.estado,
      clienteNombre: (r.cliente as unknown as { nombre: string } | null)?.nombre ?? "Cliente",
      staffNombre: (r.staff as unknown as { nombre: string } | null)?.nombre ?? null,
      servicios: (r.reserva_servicio ?? [])
        .map((rs) => (rs.servicio as unknown as { nombre: string } | null)?.nombre)
        .filter(Boolean)
        .join(" + "),
    }));

    return { ok: true, data: citas };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error inesperado." };
  }
}

import "server-only";
import { createClient } from "@/lib/supabase/server";
import { obtenerCupoPlan } from "@/lib/planes/cupo";

export interface FundadorActivo {
  descuentoPct: number;
  fechaFin: string;
  planCodigo: string;
}

export interface UsoNegocio {
  sedes: number;
  /** Profesionales que ocupan cupo según la función central (incluye invitaciones vigentes y al propietario con perfil profesional). */
  staff: number;
  fundador: FundadorActivo | null;
  paisNegocio: string | null;
}

/** Uso actual y descuento fundador. RLS decide qué filas se ven; el negocio ya fue validado por verificarAccesoPanel. */
export async function obtenerUsoNegocio(negocioId: string): Promise<UsoNegocio> {
  const supabase = await createClient();
  const [sedes, cupo, fundador, negocio] = await Promise.all([
    supabase.from("sede").select("id", { count: "exact", head: true }).eq("negocio_id", negocioId).eq("cerrada_permanente", false),
    // Mismo criterio que invitar, aceptar y bajar de plan: la función central de capacidad (migración 159), no un conteo propio.
    obtenerCupoPlan(negocioId),
    supabase
      .from("suscripcion_fundador")
      .select("descuento_pct, fecha_fin, plan_codigo")
      .eq("negocio_id", negocioId)
      .eq("estado", "ACTIVO")
      .maybeSingle(),
    supabase.from("negocio").select("pais_codigo").eq("id", negocioId).maybeSingle(),
  ]);
  return {
    sedes: sedes.count ?? 0,
    staff: cupo?.staffUsado ?? 0,
    fundador: fundador.data
      ? { descuentoPct: Number(fundador.data.descuento_pct), fechaFin: fundador.data.fecha_fin, planCodigo: fundador.data.plan_codigo }
      : null,
    paisNegocio: negocio.data?.pais_codigo ?? null,
  };
}

import "server-only";
import { createClient } from "@/lib/supabase/server";

export interface FundadorActivo {
  descuentoPct: number;
  fechaFin: string;
  planCodigo: string;
}

export interface UsoNegocio {
  sedes: number;
  staff: number;
  fundador: FundadorActivo | null;
  paisNegocio: string | null;
}

/** Uso actual y descuento fundador. RLS decide qué filas se ven; el negocio ya fue validado por verificarAccesoPanel. */
export async function obtenerUsoNegocio(negocioId: string): Promise<UsoNegocio> {
  const supabase = await createClient();
  const [sedes, staff, fundador, negocio] = await Promise.all([
    supabase.from("sede").select("id", { count: "exact", head: true }).eq("negocio_id", negocioId).eq("cerrada_permanente", false),
    supabase.from("vinculo_staff_negocio").select("id", { count: "exact", head: true }).eq("negocio_id", negocioId).eq("estado", "ACTIVO"),
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
    staff: staff.count ?? 0,
    fundador: fundador.data
      ? { descuentoPct: Number(fundador.data.descuento_pct), fechaFin: fundador.data.fecha_fin, planCodigo: fundador.data.plan_codigo }
      : null,
    paisNegocio: negocio.data?.pais_codigo ?? null,
  };
}

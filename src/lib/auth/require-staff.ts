import "server-only";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export type EstadoVinculoStaff = "ACTIVO" | "SUSPENDIDO" | "INVITADO" | "RETIRADO";

export interface ContextoStaff {
  userId: string;
  vinculoId: string;
  negocioId: string;
  negocioNombre: string;
  sedeId: string | null;
  esGuardian: boolean;
  estadoVinculo: EstadoVinculoStaff;
}

/**
 * Guarda de la App Staff (Fase 4) — deliberadamente INDEPENDIENTE de
 * `resolverContexto()` (que resuelve el Panel Negocio). Un mismo usuario
 * puede ser Barbería de su propio Negocio Y tener un vínculo de Staff
 * (típico en un negocio de 1 persona, `01-PRD/02_Functional_Architecture.md`
 * caso límite "rol combinado") — ambas superficies deben quedar accesibles
 * "indistintamente", nunca forzando una sola identidad.
 *
 * A diferencia de `requireSuperSU()`/`resolverContexto()`, esta función NO
 * redirige cuando no hay vínculo activo — el layout de `/staff` necesita
 * poder renderizar un estado vacío explicando la situación (Bible: "nunca
 * una pantalla en blanco sin explicación"), así que devuelve `null` en ese
 * caso en vez de redirigir.
 */
export async function obtenerContextoStaff(): Promise<ContextoStaff | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/staff");

  const { data: vinculo } = await supabase
    .from("vinculo_staff_negocio")
    .select("id, negocio_id, sede_activa_id, es_guardian, estado, negocio:negocio_id (nombre)")
    .eq("staff_id", user.id)
    .neq("estado", "RETIRADO")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!vinculo) return null;

  return {
    userId: user.id,
    vinculoId: vinculo.id,
    negocioId: vinculo.negocio_id,
    negocioNombre: (vinculo.negocio as unknown as { nombre: string } | null)?.nombre ?? "tu negocio",
    sedeId: vinculo.sede_activa_id,
    esGuardian: vinculo.es_guardian,
    estadoVinculo: vinculo.estado as EstadoVinculoStaff,
  };
}

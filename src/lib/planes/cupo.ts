import "server-only";
import { createClient } from "@/lib/supabase/server";
import { mapearCapacidad, type CapacidadFila, type CapacidadProfesional } from "@/lib/auth/roles-equipo";

/**
 * Cupos y funciones del plan vigente de un negocio. La base de datos es la única fuente de verdad: este módulo solo lee
 * `cupo_plan_negocio` (migraciones 156 y 159), que a su vez delega la cuenta de profesionales en la función central
 * `_capacidad_profesional`. Ningún otro código vuelve a contar vínculos o invitaciones por su cuenta.
 */
export interface CupoPlan {
  planCodigo: string;
  planNombre: string;
  /** Límite de profesionales (tope del plan + adicionales contratados). null = sin tope. */
  staffTope: number | null;
  staffIncluido: number | null;
  /** Cupos ocupados: profesionales activos/suspendidos + invitaciones vigentes que prestan servicios (el propietario con perfil profesional cuenta). */
  staffUsado: number;
  sedesTope: number | null;
  sedesUsadas: number;
  guardianDisponible: boolean;
  comisiones: boolean;
  siguienteCodigo: string | null;
  siguienteNombre: string | null;
  siguienteStaff: number | null;
  capacidad: CapacidadProfesional | null;
  /** Configuración del perfil profesional del propietario para este plan (editable por SuperSU). */
  perfilPropietario: { porDefecto: boolean; autoAlta: boolean; puedeActivar: boolean; puedeDesactivar: boolean };
}

type Fila = {
  plan_codigo: string;
  plan_nombre: string;
  staff_tope: number | null;
  staff_incluido: number | null;
  staff_usado: number;
  sedes_tope: number | null;
  sedes_usadas: number;
  guardian_disponible: boolean;
  comisiones: boolean;
  siguiente_codigo: string | null;
  siguiente_nombre: string | null;
  siguiente_staff: number | null;
  capacidad: CapacidadFila | null;
  perfil_propietario: { por_defecto: boolean; auto_alta: boolean; puede_activar: boolean; puede_desactivar: boolean } | null;
};

export async function obtenerCupoPlan(negocioId: string): Promise<CupoPlan | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("cupo_plan_negocio", { p_negocio_id: negocioId });
  if (error || !data) return null;
  const f = data as unknown as Fila;
  return {
    planCodigo: f.plan_codigo,
    planNombre: f.plan_nombre,
    staffTope: f.staff_tope,
    staffIncluido: f.staff_incluido,
    staffUsado: f.staff_usado,
    sedesTope: f.sedes_tope,
    sedesUsadas: f.sedes_usadas,
    guardianDisponible: f.guardian_disponible,
    comisiones: f.comisiones,
    siguienteCodigo: f.siguiente_codigo,
    siguienteNombre: f.siguiente_nombre,
    siguienteStaff: f.siguiente_staff,
    capacidad: f.capacidad ? mapearCapacidad(f.capacidad) : null,
    perfilPropietario: {
      porDefecto: f.perfil_propietario?.por_defecto ?? false,
      autoAlta: f.perfil_propietario?.auto_alta ?? false,
      puedeActivar: f.perfil_propietario?.puede_activar ?? false,
      puedeDesactivar: f.perfil_propietario?.puede_desactivar ?? false,
    },
  };
}

/** Texto único para «el equipo ya está completo en tu plan». El propietario puede contratar barberos adicionales; el administrador debe pedírselo. */
export function textoTopeStaff(c: CupoPlan, opciones: { esPropietario?: boolean } = {}): string {
  const tope = c.staffTope ?? c.staffIncluido ?? 0;
  const base = `Tu equipo ya usa los ${tope} ${tope === 1 ? "cupo" : "cupos"} de profesional de tu plan ${c.planNombre}${(c.capacidad?.adicionalesContratados ?? 0) > 0 ? " (incluidos los barberos adicionales)" : ""}.`;
  const adicionales = opciones.esPropietario ? "agrega barberos adicionales" : "pídele al propietario que agregue barberos adicionales";
  return c.siguienteNombre
    ? `${base} Para sumar más, ${adicionales} o actualiza a ${c.siguienteNombre}${c.siguienteStaff ? ` (hasta ${c.siguienteStaff})` : ""}.`
    : `${base} Para sumar más, ${adicionales}.`;
}

/** Texto cuando el negocio ya excede su cupo (p. ej. tras la normalización): no se retira a nadie, solo se impide agregar más. */
export function textoExcesoStaff(c: CupoPlan, opciones: { esPropietario?: boolean } = {}): string | null {
  const ex = c.capacidad?.exceso ?? 0;
  if (ex <= 0) return null;
  return `Tu equipo supera en ${ex} ${ex === 1 ? "cupo" : "cupos"} lo que incluye el plan ${c.planNombre}. No retiramos a nadie, pero no podrás sumar más profesionales hasta regularizarlo: ${opciones.esPropietario ? "renueva o agrega barberos adicionales, o actualiza tu plan" : "pídele al propietario que renueve o agregue barberos adicionales, o que actualice el plan"}.`;
}

export function topeStaffAlcanzado(c: CupoPlan): boolean {
  return c.staffTope !== null && c.staffUsado >= c.staffTope;
}

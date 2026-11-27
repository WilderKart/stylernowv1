import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Acceso a las funciones y tablas del módulo de ganancias (migración 201). El cliente usa el JWT del usuario: la autoridad real
 * es la base de datos (RLS + funciones que derivan la identidad de auth.uid()); aquí solo se traducen los errores a mensajes claros.
 * Las tablas nuevas aún no están en `Database`, por eso el cliente se tipa de forma abierta SOLO en este módulo.
 */
export type Resultado<T = undefined> = ({ ok: true } & (T extends undefined ? object : { data: T })) | { ok: false; error: string };

const MENSAJES: Array<[string, string]> = [
  ["NO_AUTENTICADO", "Inicia sesión para continuar."],
  ["NO_AUTORIZADO", "No tienes permiso para esta acción."],
  ["REGLA_SOLAPADA", "Ya hay una regla activa para ese mismo alcance en esas fechas. Reemplázala o desactívala primero."],
  ["PORCENTAJE_INVALIDO", "El porcentaje debe estar entre 0 y 100."],
  ["SIN_REGISTROS_PENDIENTES", "No hay comisiones pendientes para liquidar en ese período."],
  ["SALDO_NO_POSITIVO", "El saldo de ese período no es positivo; no hay nada que liquidar."],
  ["REGISTROS_NO_ELEGIBLES", "Algunos registros ya no están disponibles para liquidar."],
  ["PERIODO_FUTURO", "El período no puede terminar en el futuro."],
  ["FECHAS_INVALIDAS", "Revisa las fechas del período."],
  ["MONTO_INVALIDO", "El monto no es válido o supera el saldo pendiente."],
  ["ANULA_LOS_PAGOS_PRIMERO", "Anula primero los pagos registrados de esta liquidación."],
  ["LIQUIDACION_NO_PAGABLE", "Esta liquidación ya no admite pagos."],
  ["MOTIVO_REQUERIDO", "Escribe un motivo claro (mínimo 10 caracteres)."],
  ["JUSTIFICACION_REQUERIDA", "Escribe una justificación (mínimo 10 caracteres)."],
  ["RESPUESTA_REQUERIDA", "Escribe una respuesta."],
  ["YA_HAY_UNA_SOLICITUD_ABIERTA", "Ya tienes una solicitud abierta para este registro."],
  ["YA_HAY_UNA_SOLICITUD_VIGENTE", "Ya hay una solicitud de soporte vigente."],
  ["ACCESO_NO_VIGENTE", "El acceso de soporte no está vigente."],
  ["ACCESO_YA_TOMADO", "Ese acceso ya lo tomó otra persona de soporte."],
  ["PROFESIONAL_INVALIDO", "El profesional no pertenece a este negocio."],
  ["SEDE_INVALIDA", "La sede no pertenece a este negocio."],
  ["SERVICIO_INVALIDO", "El servicio no pertenece a este negocio."],
  ["SERVICIO_O_CATEGORIA", "Elige un servicio o una categoría, no ambos."],
  ["USUARIO_NO_ES_DEL_EQUIPO", "Esa persona no está activa en tu equipo."],
  ["PROPIETARIO_YA_TIENE_TODO", "El propietario ya tiene todos los permisos."],
  ["REGISTRO_FINANCIERO_INMUTABLE", "Los registros financieros no se modifican; usa un ajuste."],
  ["BUSQUEDA_DEMASIADO_LARGA", "La búsqueda es demasiado larga."],
  ["EVIDENCIA_INVALIDA", "La evidencia no es válida."],
];

export function traducirError(mensaje: string | undefined): string {
  const m = mensaje ?? "";
  for (const [codigo, texto] of MENSAJES) if (m.includes(codigo)) return texto;
  return "No se pudo completar la operación. Intenta de nuevo.";
}

export async function clienteGanancias(): Promise<SupabaseClient> {
  return (await createClient()) as unknown as SupabaseClient;
}

export async function llamar<T = unknown>(nombre: string, args: Record<string, unknown> = {}): Promise<Resultado<T>> {
  try {
    const supabase = await clienteGanancias();
    const { data, error } = await supabase.rpc(nombre, args);
    if (error) return { ok: false, error: traducirError(error.message) } as Resultado<T>;
    return { ok: true, data: data as T } as Resultado<T>;
  } catch {
    return { ok: false, error: "No se pudo completar la operación. Intenta de nuevo." } as Resultado<T>;
  }
}

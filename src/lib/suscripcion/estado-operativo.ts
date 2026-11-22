import "server-only";

import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { DESCONOCIDO, interpretarEstadoOperativo, MENSAJE_RESTRINGIDA, type EstadoOperativo } from "./estado-operativo-puro";

export * from "./estado-operativo-puro";

/**
 * Espejo TypeScript del estado «suscripción restringida» (migración 164).
 *
 * NO recalcula nada: la regla vive en UNA función SQL (`negocio_estado_operativo`) que deriva el estado de las fechas en hora de Colombia.
 * Este módulo solo la llama, tipa su respuesta y traduce el error `SUSCRIPCION_RESTRINGIDA` que lanzan los disparadores/RPC.
 * Ningún cálculo de fechas de suscripción debe hacerse en el frontend ni en Server Actions.
 */

/** Lee el estado operativo de un negocio (una sola consulta por solicitud gracias a `cache`). */
export const obtenerEstadoOperativo = cache(async (negocioId: string): Promise<EstadoOperativo> => {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("negocio_estado_operativo", { p_negocio_id: negocioId });
  if (error) return DESCONOCIDO;
  return interpretarEstadoOperativo(data);
});

/** Solo el sí/no que puede ver cualquiera (página pública, marketplace): no revela fechas ni motivo. */
export async function negocioAceptaReservas(negocioId: string): Promise<boolean> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("negocio_acepta_reservas", { p_negocio_id: negocioId });
  // Si no se puede leer, no se ofrece la reserva: la base la rechazaría de todos modos.
  return !error && data === true;
}

/**
 * Guardia previa para Server Actions: da el mensaje amigable ANTES de intentar escribir. Es comodidad, no seguridad: aunque se omita,
 * la base rechaza la operación (disparadores 162 y RPC 163).
 */
export async function exigirOperativo(negocioId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const estado = await obtenerEstadoOperativo(negocioId);
  return estado.operativo ? { ok: true } : { ok: false, error: MENSAJE_RESTRINGIDA };
}

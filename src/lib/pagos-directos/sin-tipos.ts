import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Las tablas/RPC de la migración 194 aún no están en `src/types/database.ts` (se regenera con `supabase gen types`).
 * Estos accesos tipados a mano evitan `any` suelto en cada llamada; la autorización real la imponen RLS y las RPC.
 */
type Respuesta<T> = Promise<{ data: T | null; error: { message: string } | null }>;
type Consulta = {
  select: (columnas: string, opciones?: { count?: "exact"; head?: boolean }) => Consulta;
  eq: (c: string, v: string | number | boolean) => Consulta;
  in: (c: string, v: readonly string[]) => Consulta;
  order: (c: string, o?: { ascending: boolean }) => Consulta;
  limit: (n: number) => Consulta;
  maybeSingle: <T>() => Respuesta<T>;
  upsert: (fila: object, o?: { onConflict: string }) => Respuesta<null>;
  update: (fila: object) => Consulta;
  then: PromiseLike<{ data: unknown; error: { message: string } | null; count?: number | null }>["then"];
};

export function tabla(supabase: SupabaseClient, nombre: string): Consulta {
  return (supabase as unknown as { from: (n: string) => Consulta }).from(nombre);
}

export function rpcSinTipos<T = unknown>(supabase: SupabaseClient, nombre: string, args: object): Respuesta<T> {
  return (supabase as unknown as { rpc: (n: string, a: object) => Respuesta<T> }).rpc(nombre, args);
}

/** Códigos de error de las RPC de pagos directos → mensajes en español (Colombia). */
export const MENSAJES_PAGOS_DIRECTOS: Record<string, string> = {
  NO_AUTENTICADO: "Inicia sesión para continuar.",
  NO_AUTORIZADO: "No tienes permiso para esta acción. Solo el dueño del negocio puede hacerla.",
  RESERVA_NO_ENCONTRADA: "No encontramos esa reserva.",
  RESERVA_NO_PAGABLE: "La reserva expiró o ya cambió de estado. Elige un horario de nuevo.",
  RESERVA_NO_ANULABLE: "Solo se puede anular una cita confirmada que aún no ha ocurrido.",
  RESERVA_NO_COMPLETADA: "Esta acción es para citas ya completadas. Antes de la cita usa «Anular cita».",
  PAGO_NO_ENCONTRADO: "No encontramos ese pago.",
  PAGO_NO_VERIFICABLE: "Este pago ya no se puede verificar.",
  PAGO_NO_ANULABLE: "Solo se anula una cita cuyo pago está por revisar. Si ya lo verificaste, no aplica.",
  PAGO_YA_RECHAZADO: "Este pago ya estaba marcado como no recibido.",
  PAGO_YA_REGISTRADO: "Esta cita ya tiene un comprobante registrado.",
  PAGO_DIRECTO_NO_DISPONIBLE: "Este negocio no tiene activados los pagos directos.",
  MONTO_INVALIDO: "El monto no es válido.",
  MONTO_MENOR_AL_ANTICIPO: "El monto es menor al anticipo que pide el negocio.",
  COMPROBANTE_INVALIDO: "El comprobante no es válido. Sube de nuevo la captura.",
  COMPROBANTE_DUPLICADO: "Ese comprobante ya se usó en otra cita. Sube el comprobante de tu transferencia.",
  HORARIO_NO_DISPONIBLE: "Ese horario ya no está disponible. Elige otro.",
  MOTIVO_OBLIGATORIO: "Escribe un motivo de al menos 10 caracteres.",
  TIPO_INVALIDO: "Ese tipo de ajuste no aplica con el monto indicado.",
  CLIENTE_NO_ENCONTRADO: "Ese cliente no tiene historial en tu negocio.",
  SUSCRIPCION_RESTRINGIDA: "Tu suscripción no permite esta acción en este momento.",
};

export function traducirErrorPagos(mensaje: string): string {
  const clave = Object.keys(MENSAJES_PAGOS_DIRECTOS).find((k) => mensaje.includes(k));
  return clave ? MENSAJES_PAGOS_DIRECTOS[clave] : "No pudimos completar la acción. Intenta de nuevo.";
}

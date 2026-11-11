import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

/**
 * Base común de las acciones del cliente (pantallas C01–C17).
 * Todas las funciones de src/lib/cliente/* devuelven `Resultado<T>`: nunca lanzan por
 * errores de negocio, y los mensajes de error van traducidos al español.
 * El cliente jamás envía cliente_id / negocio_id / rol: salen de auth.uid() en la BD.
 */
export type Resultado<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; codigo: string };

/** Código técnico de la BD → mensaje para el usuario. */
const MENSAJES: Record<string, string> = {
  NO_AUTENTICADO: "Inicia sesión para continuar.",
  NO_AUTORIZADO: "No tienes permiso para hacer esto.",
  RESERVA_NO_ENCONTRADA: "No encontramos esa cita.",
  RESERVA_NO_ACTIVA: "Esta cita ya no está activa.",
  RESERVA_NO_REPROGRAMABLE: "Esta cita ya no se puede reprogramar.",
  RESERVA_NO_CANCELABLE: "Esta cita ya no se puede cancelar.",
  RESERVA_NO_COMPLETADA: "Solo puedes calificar citas completadas.",
  FUERA_DE_VENTANA_REPROGRAMACION: "Ya pasó el plazo para reprogramar esta cita.",
  SLOT_NO_DISPONIBLE: "Ese horario ya no está disponible. Elige otro.",
  FUERA_DE_HORARIO: "Aún no puedes avisar tu llegada. Hazlo desde 1 hora antes de la cita.",
  FUERA_DEL_LOCAL: "Parece que aún no estás en el local.",
  CALIFICACION_INVALIDA: "La calificación debe ser de 1 a 5.",
  COMENTARIO_LARGO: "El comentario no puede superar 500 caracteres.",
  YA_CALIFICADA: "Ya calificaste esta visita.",
  FUERA_DE_PLAZO_RESENA: "Ya pasó el plazo para calificar esta visita.",
  MENSAJE_VACIO: "Escribe un mensaje.",
  MENSAJE_LARGO: "El mensaje es demasiado largo.",
  MENSAJE_REQUERIDO: "Cuéntanos qué pasó (mínimo 5 caracteres).",
  CHAT_CERRADO: "El chat de esta cita ya está cerrado.",
  DEMASIADOS_MENSAJES: "Estás enviando mensajes muy rápido. Espera un momento.",
  DEMASIADOS_TICKETS: "Alcanzaste el límite de tickets por hoy.",
  DEMASIADAS_EXPORTACIONES: "Alcanzaste el límite de descargas por hoy.",
  CATEGORIA_INVALIDA: "Elige un tema válido.",
  TICKET_NO_ENCONTRADO: "No encontramos ese ticket.",
  PAIS_INVALIDO: "País no disponible.",
  IDIOMA_INVALIDO: "Idioma no disponible.",
  PERMISO_INVALIDO: "Valor de permiso inválido.",
  NOMBRE_INVALIDO: "El nombre debe tener entre 2 y 80 caracteres.",
  PERFIL_NO_ENCONTRADO: "No encontramos tu perfil.",
  PROPOSITO_INVALIDO: "Preferencia desconocida.",
  PREFERENCIAS_INVALIDAS: "Preferencias inválidas.",
  VALOR_INVALIDO: "Valor inválido.",
  FOTO_NO_ENCONTRADA: "No encontramos esa foto.",
  SIN_SALDO: "No tienes saldo disponible.",
  SALDO_INSUFICIENTE: "El monto supera tu saldo.",
  DEVOLUCION_YA_PENDIENTE: "Ya tienes una devolución en proceso.",
  FILTRO_INVALIDO: "Filtro inválido.",
  CONFIRMACION_INVALIDA: "Escribe ELIMINAR para confirmar.",
  NO_SE_PUEDE_ELIMINAR: "Tu cuenta tiene un negocio o rol activo y no se puede eliminar desde aquí.",
};

const FALLBACK = "Algo salió mal. Inténtalo de nuevo.";

/** Extrae el código (primera palabra en MAYÚSCULAS) del mensaje de Postgres y lo traduce. */
export function traducirError(mensaje: string | null | undefined): { codigo: string; error: string } {
  const m = /^([A-Z][A-Z0-9_]{2,})/.exec((mensaje ?? "").trim());
  const codigo = m?.[1] ?? "ERROR";
  return { codigo, error: MENSAJES[codigo] ?? FALLBACK };
}

type Fns = Database["public"]["Functions"];
export type ArgsDe<N extends keyof Fns> = Fns[N]["Args"];

type RpcClient = {
  rpc: (n: string, a?: object) => Promise<{ data: unknown; error: { message: string } | null }>;
};

/** Llama un RPC con la sesión del usuario (cookies). `T` es la forma esperada del retorno. */
export async function llamarRpc<T>(nombre: keyof Fns, args?: object): Promise<Resultado<T>> {
  try {
    const supabase = (await createClient()) as unknown as RpcClient;
    const { data, error } = await supabase.rpc(nombre as string, args ?? {});
    if (error) return { ok: false, ...traducirError(error.message) };
    return { ok: true, data: data as T };
  } catch {
    return { ok: false, codigo: "ERROR", error: FALLBACK };
  }
}

export function fallo<T = never>(codigo: string): Resultado<T> {
  return { ok: false, codigo, error: MENSAJES[codigo] ?? FALLBACK };
}

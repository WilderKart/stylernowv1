import "server-only";
import { createClient } from "@/lib/supabase/server";

/** RPC de la migración 137 (aún sin tipos generados). Corren con la sesión del Super Admin; la base exige is_supersu(). */
type RpcSinTipos = { rpc: (n: string, a?: object) => Promise<{ data: unknown; error: { message: string } | null }> };

const MENSAJES: Record<string, string> = {
  NO_AUTORIZADO: "No tienes permiso para esta acción.",
  MOTIVO_REQUERIDO: "Escribe un motivo (mínimo 5 caracteres).",
  NO_SOBRE_SI_MISMO: "No puedes aplicar esta acción sobre tu propia cuenta.",
  NO_SOBRE_SUPERSU: "La cuenta Super Admin solo se administra desde la base de datos.",
  USUARIO_NO_ENCONTRADO: "No encontramos ese usuario.",
  RANGO_INVALIDO: "El rango de fechas no es válido.",
  RANGO_DEMASIADO_LARGO: "Elige un rango de máximo 400 días.",
  ACCION_INVALIDA: "Acción no válida.",
};

export function traducirErrorAdmin(mensaje: string) {
  const clave = Object.keys(MENSAJES).find((k) => mensaje.includes(k));
  return clave ? MENSAJES[clave] : "No pudimos completar la operación. Intenta de nuevo.";
}

export async function rpcAdmin<T>(nombre: string, args?: object): Promise<{ ok: true; data: T } | { ok: false; error: string }> {
  const supabase = (await createClient()) as unknown as RpcSinTipos;
  const { data, error } = await supabase.rpc(nombre, args);
  if (error) return { ok: false, error: traducirErrorAdmin(error.message) };
  return { ok: true, data: data as T };
}

"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

type Resultado = { ok: true } | { ok: false; error: string };
type RpcSinTipos = { rpc: (n: string, a?: object) => Promise<{ data: unknown; error: { message: string } | null }> };

const MENSAJES: Record<string, string> = {
  NO_AUTENTICADO: "Inicia sesión de nuevo.",
  NO_AUTORIZADO: "No tienes permiso sobre este negocio.",
  TRANSICION_NO_PERMITIDA: "Ese paso no está disponible en el estado actual de tu verificación.",
  FALTAN_DOCUMENTOS: "Sube al menos un documento antes de enviar a revisión.",
  VERIFICACION_NO_EDITABLE: "Tu verificación no admite cambios en este momento.",
};

function traducir(m: string) {
  const k = Object.keys(MENSAJES).find((c) => m.includes(c));
  return k ? MENSAJES[k] : "No pudimos completar la acción. Intenta de nuevo.";
}

async function rpc(nombre: string, args: object): Promise<Resultado> {
  const supabase = await createClient();
  const { error } = await (supabase as unknown as RpcSinTipos).rpc(nombre, args);
  if (error) return { ok: false, error: traducir(error.message) };
  revalidatePath("/panel/verificacion");
  revalidatePath("/panel");
  return { ok: true };
}

export async function iniciarVerificacion(negocioId: string): Promise<Resultado> {
  return rpc("iniciar_verificacion_negocio", { p_negocio_id: negocioId });
}

export async function enviarVerificacionARevision(negocioId: string): Promise<Resultado> {
  return rpc("enviar_verificacion_a_revision", { p_negocio_id: negocioId });
}

export async function retirarDocumentoVerificacion(documentoId: string): Promise<Resultado> {
  return rpc("retirar_documento_verificacion", { p_documento_id: documentoId });
}

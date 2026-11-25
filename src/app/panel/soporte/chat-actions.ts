"use server";

import { resolverContexto } from "@/lib/auth/resolver-contexto";
import { procesarAlertasSoporte } from "@/lib/soporte/alertas";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

type Resultado<T = undefined> =
  | ({ ok: true } & (T extends undefined ? object : { data: T }))
  | { ok: false; error: string };

export type MensajeChat = {
  id: string;
  conversacionId: string;
  negocioId: string;
  remitenteRol: "BARBERIA" | "SUPERSU";
  cuerpo: string;
  createdAt: string;
  leido: boolean;
};

export type ChatSoporte = {
  conversacionId: string | null;
  negocioId: string;
  estado: "ABIERTA" | "CERRADA";
  noLeidosNegocio: number;
  ultimoMensajeAt: string | null;
  ultimoMensajePreview: string | null;
  mensajes: MensajeChat[];
};

const MENSAJES_ERROR: Record<string, string> = {
  FUNCION_NO_INCLUIDA: "El chat de soporte no está incluido en tu plan actual.",
  NO_AUTORIZADO: "No tienes permiso para usar este chat.",
  NEGOCIO_NO_ENCONTRADO: "No encontramos tu negocio.",
  MENSAJE_REQUERIDO: "Escribe un mensaje antes de enviarlo.",
  MENSAJE_LARGO: "El mensaje no puede superar los 2000 caracteres.",
  CONVERSACION_NO_ENCONTRADA: "No encontramos la conversación.",
};

function traducirError(mensaje: string) {
  const clave = Object.keys(MENSAJES_ERROR).find((k) => mensaje.includes(k));
  return clave ? MENSAJES_ERROR[clave] : mensaje;
}

async function contextoBarberia() {
  const contexto = await resolverContexto();
  if (contexto.rol !== "BARBERIA" || !contexto.negocioId) return null;
  return contexto.negocioId;
}

export async function obtenerChatSoporte(): Promise<Resultado<ChatSoporte>> {
  try {
    const negocioId = await contextoBarberia();
    if (!negocioId) return { ok: false, error: "No tienes permiso para usar este chat." };
    const supabase = await createClient();
    const { data: conversacion, error: errorConv } = await supabase
      .from("soporte_conversacion")
      .select("id, negocio_id, estado, no_leidos_negocio, ultimo_mensaje_at, ultimo_mensaje_preview")
      .eq("negocio_id", negocioId)
      .maybeSingle();
    if (errorConv) return { ok: false, error: errorConv.message };
    if (!conversacion) {
      return {
        ok: true,
        data: {
          conversacionId: null,
          negocioId,
          estado: "ABIERTA",
          noLeidosNegocio: 0,
          ultimoMensajeAt: null,
          ultimoMensajePreview: null,
          mensajes: [],
        },
      };
    }

    const { data: mensajes, error: errorMensajes } = await supabase
      .from("soporte_mensaje")
      .select("id, conversacion_id, negocio_id, remitente_rol, cuerpo, created_at, leido_at")
      .eq("conversacion_id", conversacion.id)
      .order("created_at", { ascending: true })
      .limit(200);
    if (errorMensajes) return { ok: false, error: errorMensajes.message };

    return {
      ok: true,
      data: {
        conversacionId: conversacion.id,
        negocioId: conversacion.negocio_id,
        estado: conversacion.estado as "ABIERTA" | "CERRADA",
        noLeidosNegocio: conversacion.no_leidos_negocio,
        ultimoMensajeAt: conversacion.ultimo_mensaje_at,
        ultimoMensajePreview: conversacion.ultimo_mensaje_preview,
        mensajes: (mensajes ?? []).map((m) => ({
          id: m.id,
          conversacionId: m.conversacion_id,
          negocioId: m.negocio_id,
          remitenteRol: m.remitente_rol as "BARBERIA" | "SUPERSU",
          cuerpo: m.cuerpo,
          createdAt: m.created_at,
          leido: m.leido_at !== null,
        })),
      },
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error inesperado." };
  }
}

export async function contarNoLeidosSoporte(): Promise<number> {
  try {
    const negocioId = await contextoBarberia();
    if (!negocioId) return 0;
    const supabase = await createClient();
    const { data } = await supabase
      .from("soporte_conversacion")
      .select("no_leidos_negocio")
      .eq("negocio_id", negocioId)
      .maybeSingle();
    return data?.no_leidos_negocio ?? 0;
  } catch {
    return 0;
  }
}

export async function enviarMensajeChat(cuerpo: string): Promise<Resultado> {
  try {
    const negocioId = await contextoBarberia();
    if (!negocioId) return { ok: false, error: "No tienes permiso para usar este chat." };
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("soporte_enviar_mensaje", {
      p_negocio_id: negocioId,
      p_cuerpo: cuerpo,
    });
    if (error) return { ok: false, error: traducirError(error.message) };
    const fila = Array.isArray(data) ? data[0] : null;
    if (!fila) return { ok: false, error: "No se pudo registrar el mensaje." };

    try {
      await procesarAlertasSoporte({
        negocioId: fila.negocio_id,
        conversacionId: fila.conversacion_id,
        mensajeId: fila.id,
        remitenteRol: fila.remitente_rol as "BARBERIA" | "SUPERSU",
        alertaWebhook: fila.alerta_webhook,
        alertaEmailAdmin: fila.alerta_email_admin,
        alertaEmailNegocio: fila.alerta_email_negocio,
      });
    } catch {
      void 0;
    }

    revalidatePath("/panel/soporte");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error inesperado." };
  }
}

export async function marcarChatLeido(conversacionId: string): Promise<Resultado> {
  try {
    const negocioId = await contextoBarberia();
    if (!negocioId) return { ok: false, error: "No tienes permiso para usar este chat." };
    const supabase = await createClient();
    const { error } = await supabase.rpc("soporte_marcar_leido", { p_conversacion_id: conversacionId });
    if (error) return { ok: false, error: traducirError(error.message) };
    revalidatePath("/panel/soporte");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error inesperado." };
  }
}

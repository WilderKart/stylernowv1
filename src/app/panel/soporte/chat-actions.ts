"use server";

import { resolverContexto } from "@/lib/auth/resolver-contexto";
import { procesarAlertasSoporte } from "@/lib/soporte/alertas";
import { COLUMNAS_MENSAJE, mapearMensajes } from "@/lib/soporte/mensajes";
import type { AdjuntoSubido, MensajeChat } from "@/lib/soporte/tipos";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

type Resultado<T = undefined> =
  | ({ ok: true } & (T extends undefined ? object : { data: T }))
  | { ok: false; error: string };

export type ChatSoporte = {
  /** El plan incluye el chat en vivo (desde Studio). */
  chatIncluido: boolean;
  prioritario: boolean;
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
  ADJUNTO_INVALIDO: "El archivo adjunto no es válido. Inténtalo de nuevo.",
  NO_AUTENTICADO: "Tu sesión expiró. Vuelve a iniciar sesión.",
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
    const rpcFuncion = async (clave: string) => {
      const { data } = await supabase.rpc("negocio_tiene_funcion", { p_negocio_id: negocioId, p_clave: clave });
      return data === true;
    };
    const [chatIncluido, prioritario] = await Promise.all([rpcFuncion("soporte_chat"), rpcFuncion("soporte_prioritario")]);
    const base = { chatIncluido, prioritario, negocioId, estado: "ABIERTA" as const, noLeidosNegocio: 0, ultimoMensajeAt: null, ultimoMensajePreview: null, conversacionId: null, mensajes: [] };
    // Essential no tiene chat: no se consulta nada (la base tampoco lo permitiría).
    if (!chatIncluido) return { ok: true, data: base };
    const { data: conversacion, error: errorConv } = await supabase
      .from("soporte_conversacion")
      .select("id, negocio_id, estado, no_leidos_negocio, ultimo_mensaje_at, ultimo_mensaje_preview")
      .eq("negocio_id", negocioId)
      .maybeSingle();
    if (errorConv) return { ok: false, error: errorConv.message };
    if (!conversacion) {
      return { ok: true, data: base };
    }

    const { data: mensajes, error: errorMensajes } = await supabase
      .from("soporte_mensaje")
      .select(COLUMNAS_MENSAJE)
      .eq("conversacion_id", conversacion.id)
      .order("created_at", { ascending: true })
      .limit(200);
    if (errorMensajes) return { ok: false, error: errorMensajes.message };

    return {
      ok: true,
      data: {
        chatIncluido,
        prioritario,
        conversacionId: conversacion.id,
        negocioId: conversacion.negocio_id,
        estado: conversacion.estado as "ABIERTA" | "CERRADA",
        noLeidosNegocio: conversacion.no_leidos_negocio,
        ultimoMensajeAt: conversacion.ultimo_mensaje_at,
        ultimoMensajePreview: conversacion.ultimo_mensaje_preview,
        mensajes: await mapearMensajes(supabase, mensajes ?? []),
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

/** Garantiza la conversación del negocio y devuelve su id: el navegador lo necesita para armar la ruta de subida del adjunto. */
export async function prepararAdjuntosChat(): Promise<Resultado<{ conversacionId: string; negocioId: string }>> {
  try {
    const negocioId = await contextoBarberia();
    if (!negocioId) return { ok: false, error: "No tienes permiso para usar este chat." };
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("soporte_asegurar_conversacion", { p_negocio_id: negocioId });
    if (error || !data) return { ok: false, error: traducirError(error?.message ?? "CONVERSACION_NO_ENCONTRADA") };
    return { ok: true, data: { conversacionId: data, negocioId } };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error inesperado." };
  }
}

export async function enviarMensajeChat(cuerpo: string, adjunto?: AdjuntoSubido | null): Promise<Resultado> {
  try {
    const negocioId = await contextoBarberia();
    if (!negocioId) return { ok: false, error: "No tienes permiso para usar este chat." };
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("soporte_enviar_mensaje", {
      p_negocio_id: negocioId,
      p_cuerpo: cuerpo,
      ...(adjunto ? { p_adjunto_url: adjunto.ruta, p_adjunto_tipo: adjunto.tipo, p_adjunto_nombre: adjunto.nombre } : {}),
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
        prioritario: fila.prioritario,
        tieneAdjunto: fila.tiene_adjunto,
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

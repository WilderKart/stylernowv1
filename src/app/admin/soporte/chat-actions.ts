"use server";

import { autorizarSuperSU } from "@/lib/auth/autorizar-supersu";
import { procesarAlertasSoporte } from "@/lib/soporte/alertas";
import { revalidatePath } from "next/cache";

type Resultado<T = undefined> =
  | ({ ok: true } & (T extends undefined ? object : { data: T }))
  | { ok: false; error: string };

export type ConversacionAdmin = {
  id: string;
  negocioId: string;
  negocioNombre: string | null;
  estado: "ABIERTA" | "CERRADA";
  noLeidosAdmin: number;
  ultimoMensajeAt: string | null;
  ultimoMensajePreview: string | null;
};

export type MensajeChatAdmin = {
  id: string;
  conversacionId: string;
  negocioId: string;
  remitenteRol: "BARBERIA" | "SUPERSU";
  cuerpo: string;
  createdAt: string;
  leido: boolean;
};

export type ChatAdmin = {
  conversacion: ConversacionAdmin;
  mensajes: MensajeChatAdmin[];
};

const MENSAJES_ERROR: Record<string, string> = {
  NO_AUTORIZADO: "No tienes permiso de SuperSU.",
  NEGOCIO_NO_ENCONTRADO: "No encontramos el negocio.",
  MENSAJE_REQUERIDO: "Escribe un mensaje antes de enviarlo.",
  MENSAJE_LARGO: "El mensaje no puede superar los 2000 caracteres.",
  CONVERSACION_NO_ENCONTRADA: "No encontramos la conversación.",
  FUNCION_NO_INCLUIDA: "El negocio no tiene habilitado el chat de soporte.",
};

function traducirError(mensaje: string) {
  const clave = Object.keys(MENSAJES_ERROR).find((k) => mensaje.includes(k));
  return clave ? MENSAJES_ERROR[clave] : mensaje;
}

export async function listarChatsAdmin(): Promise<Resultado<ConversacionAdmin[]>> {
  try {
    const g = await autorizarSuperSU();
    if (!g.ok) return { ok: false, error: g.error };
    const { data, error } = await g.supabase
      .from("soporte_conversacion")
      .select("id, negocio_id, estado, no_leidos_admin, ultimo_mensaje_at, ultimo_mensaje_preview, negocio:negocio_id (nombre)")
      .order("ultimo_mensaje_at", { ascending: false })
      .limit(200);
    if (error) return { ok: false, error: error.message };
    return {
      ok: true,
      data: (data ?? []).map((c) => ({
        id: c.id,
        negocioId: c.negocio_id,
        negocioNombre: (c.negocio as unknown as { nombre: string } | null)?.nombre ?? null,
        estado: c.estado as "ABIERTA" | "CERRADA",
        noLeidosAdmin: c.no_leidos_admin,
        ultimoMensajeAt: c.ultimo_mensaje_at,
        ultimoMensajePreview: c.ultimo_mensaje_preview,
      })),
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error inesperado." };
  }
}

export async function obtenerChatAdmin(conversacionId: string): Promise<Resultado<ChatAdmin>> {
  try {
    const g = await autorizarSuperSU();
    if (!g.ok) return { ok: false, error: g.error };
    const [{ data: conversacion, error: errorConv }, { data: mensajes, error: errorMensajes }] = await Promise.all([
      g.supabase
        .from("soporte_conversacion")
        .select("id, negocio_id, estado, no_leidos_admin, ultimo_mensaje_at, ultimo_mensaje_preview, negocio:negocio_id (nombre)")
        .eq("id", conversacionId)
        .maybeSingle(),
      g.supabase
        .from("soporte_mensaje")
        .select("id, conversacion_id, negocio_id, remitente_rol, cuerpo, created_at, leido_at")
        .eq("conversacion_id", conversacionId)
        .order("created_at", { ascending: true })
        .limit(200),
    ]);
    if (errorConv) return { ok: false, error: errorConv.message };
    if (!conversacion) return { ok: false, error: "No encontramos la conversación." };
    if (errorMensajes) return { ok: false, error: errorMensajes.message };

    return {
      ok: true,
      data: {
        conversacion: {
          id: conversacion.id,
          negocioId: conversacion.negocio_id,
          negocioNombre: (conversacion.negocio as unknown as { nombre: string } | null)?.nombre ?? null,
          estado: conversacion.estado as "ABIERTA" | "CERRADA",
          noLeidosAdmin: conversacion.no_leidos_admin,
          ultimoMensajeAt: conversacion.ultimo_mensaje_at,
          ultimoMensajePreview: conversacion.ultimo_mensaje_preview,
        },
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

export async function enviarMensajeChatAdmin(negocioId: string, cuerpo: string): Promise<Resultado> {
  try {
    const g = await autorizarSuperSU();
    if (!g.ok) return { ok: false, error: g.error };
    const { data, error } = await g.supabase.rpc("soporte_enviar_mensaje", {
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

    revalidatePath("/admin/soporte");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error inesperado." };
  }
}

export async function marcarChatLeidoAdmin(conversacionId: string): Promise<Resultado> {
  try {
    const g = await autorizarSuperSU();
    if (!g.ok) return { ok: false, error: g.error };
    const { error } = await g.supabase.rpc("soporte_marcar_leido", { p_conversacion_id: conversacionId });
    if (error) return { ok: false, error: traducirError(error.message) };
    revalidatePath("/admin/soporte");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error inesperado." };
  }
}

export async function cambiarEstadoChatAdmin(
  conversacionId: string,
  estado: "ABIERTA" | "CERRADA"
): Promise<Resultado> {
  try {
    const g = await autorizarSuperSU();
    if (!g.ok) return { ok: false, error: g.error };
    const { error } = await g.supabase.rpc("soporte_cambiar_estado", {
      p_conversacion_id: conversacionId,
      p_estado: estado,
    });
    if (error) return { ok: false, error: traducirError(error.message) };
    revalidatePath("/admin/soporte");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error inesperado." };
  }
}

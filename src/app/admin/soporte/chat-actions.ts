"use server";

import { autorizarSuperSU } from "@/lib/auth/autorizar-supersu";
import { procesarAlertasSoporte } from "@/lib/soporte/alertas";
import { COLUMNAS_MENSAJE, mapearMensajes } from "@/lib/soporte/mensajes";
import type { AdjuntoSubido, MensajeChat } from "@/lib/soporte/tipos";
import { revalidatePath } from "next/cache";
import { z } from "zod";

type Resultado<T = undefined> =
  | ({ ok: true } & (T extends undefined ? object : { data: T }))
  | { ok: false; error: string };

export type ConversacionAdmin = {
  id: string;
  negocioId: string;
  negocioNombre: string | null;
  ciudad: string | null;
  plan: string | null;
  prioritario: boolean;
  estado: "ABIERTA" | "CERRADA";
  noLeidosAdmin: number;
  ultimoMensajeAt: string | null;
  ultimoMensajePreview: string | null;
  createdAt: string;
};

export type MensajeChatAdmin = MensajeChat;

export type ChatAdmin = {
  conversacion: ConversacionAdmin;
  mensajes: MensajeChatAdmin[];
};

export type RespuestaRapida = { id: string; titulo: string; atajo: string; cuerpo: string; orden: number; activo: boolean };

const MENSAJES_ERROR: Record<string, string> = {
  NO_AUTORIZADO: "No tienes permiso de SuperSU.",
  NEGOCIO_NO_ENCONTRADO: "No encontramos el negocio.",
  MENSAJE_REQUERIDO: "Escribe un mensaje antes de enviarlo.",
  MENSAJE_LARGO: "El mensaje no puede superar los 2000 caracteres.",
  CONVERSACION_NO_ENCONTRADA: "No encontramos la conversación.",
  FUNCION_NO_INCLUIDA: "El negocio no tiene habilitado el chat de soporte.",
  ADJUNTO_INVALIDO: "El archivo adjunto no es válido.",
  "duplicate key": "Ya existe una respuesta rápida con ese atajo.",
};

function traducirError(mensaje: string) {
  const clave = Object.keys(MENSAJES_ERROR).find((k) => mensaje.includes(k));
  return clave ? MENSAJES_ERROR[clave] : mensaje;
}

type FilaBandeja = {
  id: string;
  negocio_id: string;
  negocio_nombre: string | null;
  ciudad: string | null;
  plan_codigo: string | null;
  prioritario: boolean;
  estado: string;
  no_leidos_admin: number;
  ultimo_mensaje_at: string | null;
  ultimo_mensaje_preview: string | null;
  created_at: string;
};

function aConversacion(c: FilaBandeja): ConversacionAdmin {
  return {
    id: c.id,
    negocioId: c.negocio_id,
    negocioNombre: c.negocio_nombre,
    ciudad: c.ciudad,
    plan: c.plan_codigo,
    prioritario: c.prioritario,
    estado: c.estado as "ABIERTA" | "CERRADA",
    noLeidosAdmin: c.no_leidos_admin,
    ultimoMensajeAt: c.ultimo_mensaje_at,
    ultimoMensajePreview: c.ultimo_mensaje_preview,
    createdAt: c.created_at,
  };
}

/** Bandeja de SuperSU: la base ordena (prioritarios primero) y revalida que quien llama sea SuperSU. */
export async function listarChatsAdmin(): Promise<Resultado<ConversacionAdmin[]>> {
  try {
    const g = await autorizarSuperSU();
    if (!g.ok) return { ok: false, error: g.error };
    const { data, error } = await g.supabase.rpc("soporte_bandeja_admin");
    if (error) return { ok: false, error: traducirError(error.message) };
    return { ok: true, data: (data ?? []).map(aConversacion) };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error inesperado." };
  }
}

export async function obtenerChatAdmin(conversacionId: string): Promise<Resultado<ChatAdmin>> {
  try {
    const g = await autorizarSuperSU();
    if (!g.ok) return { ok: false, error: g.error };
    const [{ data: bandeja, error: errorConv }, { data: mensajes, error: errorMensajes }] = await Promise.all([
      g.supabase.rpc("soporte_bandeja_admin"),
      g.supabase.from("soporte_mensaje").select(COLUMNAS_MENSAJE).eq("conversacion_id", conversacionId).order("created_at", { ascending: true }).limit(200),
    ]);
    if (errorConv) return { ok: false, error: traducirError(errorConv.message) };
    const conversacion = (bandeja ?? []).find((c) => c.id === conversacionId);
    if (!conversacion) return { ok: false, error: "No encontramos la conversación." };
    if (errorMensajes) return { ok: false, error: errorMensajes.message };
    return { ok: true, data: { conversacion: aConversacion(conversacion), mensajes: await mapearMensajes(g.supabase, mensajes ?? []) } };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error inesperado." };
  }
}

/** Garantiza la conversación del negocio y devuelve su id (ruta de subida del adjunto). */
export async function prepararAdjuntosChatAdmin(negocioId: string): Promise<Resultado<{ conversacionId: string }>> {
  try {
    const g = await autorizarSuperSU();
    if (!g.ok) return { ok: false, error: g.error };
    const { data, error } = await g.supabase.rpc("soporte_asegurar_conversacion", { p_negocio_id: negocioId });
    if (error || !data) return { ok: false, error: traducirError(error?.message ?? "CONVERSACION_NO_ENCONTRADA") };
    return { ok: true, data: { conversacionId: data } };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error inesperado." };
  }
}

export async function enviarMensajeChatAdmin(negocioId: string, cuerpo: string, adjunto?: AdjuntoSubido | null): Promise<Resultado> {
  try {
    const g = await autorizarSuperSU();
    if (!g.ok) return { ok: false, error: g.error };
    const { data, error } = await g.supabase.rpc("soporte_enviar_mensaje", {
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

// ── Respuestas rápidas (solo SuperSU; la base también lo exige por RLS) ──────────────────────────────
const esquemaRespuesta = z.object({
  id: z.string().uuid().optional(),
  titulo: z.string().trim().min(1, "Escribe un título.").max(60, "El título admite hasta 60 caracteres."),
  atajo: z
    .string()
    .trim()
    .toLowerCase()
    .transform((v) => (v.startsWith("/") ? v : `/${v}`))
    .pipe(z.string().regex(/^\/[a-z0-9_-]{2,20}$/, "El atajo usa de 2 a 20 letras, números o guiones (ej. /nequi).")),
  cuerpo: z.string().trim().min(1, "Escribe el texto de la respuesta.").max(1000, "La respuesta admite hasta 1000 caracteres."),
  activo: z.boolean().default(true),
});

export async function listarRespuestasRapidas(): Promise<Resultado<RespuestaRapida[]>> {
  try {
    const g = await autorizarSuperSU();
    if (!g.ok) return { ok: false, error: g.error };
    const { data, error } = await g.supabase.from("soporte_respuesta_rapida").select("id, titulo, atajo, cuerpo, orden, activo").order("orden", { ascending: true }).order("created_at", { ascending: true });
    if (error) return { ok: false, error: traducirError(error.message) };
    return { ok: true, data: data ?? [] };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error inesperado." };
  }
}

export async function guardarRespuestaRapida(entrada: z.input<typeof esquemaRespuesta>): Promise<Resultado> {
  try {
    const g = await autorizarSuperSU();
    if (!g.ok) return { ok: false, error: g.error };
    const p = esquemaRespuesta.safeParse(entrada);
    if (!p.success) return { ok: false, error: p.error.issues[0]?.message ?? "Datos inválidos." };
    const { id, titulo, atajo, cuerpo, activo } = p.data;
    const { error } = id
      ? await g.supabase.from("soporte_respuesta_rapida").update({ titulo, atajo, cuerpo, activo }).eq("id", id)
      : await g.supabase.from("soporte_respuesta_rapida").insert({ titulo, atajo, cuerpo, activo, orden: 100 });
    if (error) return { ok: false, error: traducirError(error.message) };
    revalidatePath("/admin/soporte");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error inesperado." };
  }
}

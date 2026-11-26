"use server";

import { resolverContexto } from "@/lib/auth/resolver-contexto";
import { exigirOperativo } from "@/lib/suscripcion/estado-operativo";
import { createClient } from "@/lib/supabase/server";
import { crearPreferenciaDePago } from "@/lib/pagos/cobro";
import { revalidatePath } from "next/cache";

type Resultado<T = undefined> =
  | ({ ok: true } & (T extends undefined ? object : { data: T }))
  | { ok: false; error: string };

const MENSAJES_ERROR: Record<string, string> = {
  SUSCRIPCION_RESTRINGIDA: "Tu suscripci?n no permite esta acci?n en este momento.",
  NO_AUTORIZADO: "No tienes permiso sobre este negocio.",
  ADDON_MI_MARCA_REQUERIDO: "Tu negocio aún no tiene activo el add-on Mi Marca.",
  ADDON_SIN_PRECIO: "Mi Marca todavía no tiene precio publicado en tu país.",
  ASUNTO_REQUERIDO: "Falta el asunto de la solicitud.",
  MENSAJE_REQUERIDO: "Falta el mensaje de la solicitud.",
};

function traducirError(mensaje: string) {
  const clave = Object.keys(MENSAJES_ERROR).find((k) => mensaje.includes(k));
  return clave ? MENSAJES_ERROR[clave] : mensaje;
}

/** negocio_id SIEMPRE derivado del contexto del usuario en servidor; solo rol Barbería. */
async function contextoBarberia() {
  const contexto = await resolverContexto();
  if (!contexto.userId || contexto.rol !== "BARBERIA" || !contexto.negocioId) throw new Error("NO_AUTORIZADO");
  const supabase = await createClient();
  return { supabase, negocioId: contexto.negocioId };
}

const HEX = /^#[0-9A-Fa-f]{6}$/;

export interface FormularioMarca {
  nombre: string;
  slogan: string;
  logoUrl: string | null;
  colorPrimario: string;
  colorSecundario: string;
  publicar: boolean;
}

export async function guardarMarca(f: FormularioMarca): Promise<Resultado> {
  try {
    const { supabase, negocioId } = await contextoBarberia();
    const op = await exigirOperativo(negocioId);
    if (!op.ok) return { ok: false, error: MENSAJES_ERROR.SUSCRIPCION_RESTRINGIDA };
    const nombre = f.nombre.trim();
    const slogan = f.slogan.trim();
    if (nombre.length < 1 || nombre.length > 60) return { ok: false, error: "El nombre de marca debe tener entre 1 y 60 caracteres." };
    if (slogan.length > 120) return { ok: false, error: "El slogan no puede superar 120 caracteres." };
    if (!HEX.test(f.colorPrimario) || !HEX.test(f.colorSecundario)) return { ok: false, error: "Los colores deben tener formato #RRGGBB." };
    if (f.logoUrl !== null && !/^https:\/\//.test(f.logoUrl)) return { ok: false, error: "El logo no es válido." };

    const { error } = await supabase.rpc("guardar_marca_negocio", {
      p_negocio_id: negocioId,
      p_nombre: nombre,
      p_slogan: slogan as string,
      p_logo_url: f.logoUrl as string,
      p_color_primario: f.colorPrimario.toUpperCase(),
      p_color_secundario: f.colorSecundario.toUpperCase(),
      p_publicar: f.publicar,
    });
    if (error) return { ok: false, error: traducirError(error.message) };
    revalidatePath("/panel/marca");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: traducirError(e instanceof Error ? e.message : "Error inesperado.") };
  }
}

/** Sube el logo de marca a Storage (mismo bucket que el logo del negocio). No toca negocio.logo_url. */
export async function subirLogoMarca(dataUrl: string): Promise<Resultado<{ url: string }>> {
  try {
    const { supabase, negocioId } = await contextoBarberia();

    const match = /^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl);
    if (!match) return { ok: false, error: "Usa una imagen PNG, JPG o WebP." };
    const [, mime, base64] = match;
    const bytes = Buffer.from(base64, "base64");
    if (bytes.byteLength > 5 * 1024 * 1024) return { ok: false, error: "La imagen no puede superar 5 MB." };

    const firmaOk =
      (mime === "image/png" && bytes.subarray(0, 4).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47]))) ||
      (mime === "image/jpeg" && bytes.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]))) ||
      (mime === "image/webp" && bytes.subarray(0, 4).toString("ascii") === "RIFF" && bytes.subarray(8, 12).toString("ascii") === "WEBP");
    if (!firmaOk) return { ok: false, error: "El archivo no es una imagen válida." };

    const ext = mime === "image/jpeg" ? "jpg" : mime.split("/")[1];
    const ruta = `${negocioId}/marca-logo.${ext}`;
    const { error: eUpload } = await supabase.storage.from("negocio-media").upload(ruta, bytes, { contentType: mime, upsert: true });
    if (eUpload) return { ok: false, error: eUpload.message };

    const { data: pub } = supabase.storage.from("negocio-media").getPublicUrl(ruta);
    return { ok: true, data: { url: `${pub.publicUrl}?v=${Date.now()}` } };
  } catch (e) {
    return { ok: false, error: traducirError(e instanceof Error ? e.message : "Error inesperado.") };
  }
}

/**
 * Cobro mensual de Mi Marca por Mercado Pago (cuenta de StylerNow, sin split). La base fija el precio vigente del país y crea
 * (o reutiliza) el cobro pendiente (migración 199); al aprobarse activa o extiende un mes. Nada de esto lo decide el navegador.
 */
export async function iniciarPagoMiMarca(): Promise<Resultado<{ url: string; preferenciaId: string; pagoId: string }>> {
  try {
    const { supabase, negocioId } = await contextoBarberia();
    const operativo = await exigirOperativo(negocioId);
    if (!operativo.ok) return { ok: false, error: traducirError("SUSCRIPCION_RESTRINGIDA") };
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const { data, error } = await (supabase as unknown as {
      rpc: (n: string, a: object) => Promise<{ data: { id: string } | null; error: { message: string } | null }>;
    }).rpc("mi_marca_iniciar_pago", { p_negocio_id: negocioId });
    if (error && /could not find the function/i.test(error.message)) {
      return { ok: false, error: "El pago en línea de Mi Marca se está activando. Intenta de nuevo en unos minutos." };
    }
    if (error || !data) return { ok: false, error: traducirError(error?.message ?? "No se pudo iniciar el pago.") };
    const sitio = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");
    const preferencia = await crearPreferenciaDePago({
      pagoId: data.id,
      titulo: "Add-on Mi Marca (1 mes) · StylerNow",
      emailPagador: user?.email,
      urlRetorno: `${sitio}/panel/marca?desde=pago`,
    });
    return { ok: true, data: { url: preferencia.url, preferenciaId: preferencia.id, pagoId: data.id } };
  } catch (e) {
    return { ok: false, error: traducirError(e instanceof Error ? e.message : "Error inesperado.") };
  }
}

const ASUNTO_ACTIVACION = "Activar Mi Marca";

/** Crea un ticket de soporte "Activar Mi Marca" (evita duplicar si ya hay uno sin resolver). */
export async function solicitarActivacionMarca(): Promise<Resultado<{ yaExistia: boolean }>> {
  try {
    const { supabase, negocioId } = await contextoBarberia();

    const { data: previos } = await supabase
      .from("ticket_soporte")
      .select("id")
      .eq("negocio_id", negocioId)
      .eq("asunto", ASUNTO_ACTIVACION)
      .neq("estado", "RESUELTO")
      .limit(1);
    if (previos && previos.length > 0) return { ok: true, data: { yaExistia: true } };

    const { error } = await supabase.rpc("crear_ticket_soporte", {
      p_asunto: ASUNTO_ACTIVACION,
      p_mensaje: "Quiero activar el add-on Mi Marca para mi negocio. Por favor contáctenme para coordinar la activación y el cobro.",
      p_negocio_id: negocioId,
    });
    if (error) return { ok: false, error: traducirError(error.message) };
    revalidatePath("/panel/soporte");
    return { ok: true, data: { yaExistia: false } };
  } catch (e) {
    return { ok: false, error: traducirError(e instanceof Error ? e.message : "Error inesperado.") };
  }
}

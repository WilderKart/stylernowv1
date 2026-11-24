"use server";

import { borrarImagenCloudinary, configCloudinary, subirImagenCloudinary } from "@/lib/almacenamiento/cloudinary";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

/**
 * Galería del negocio (migración 185): hasta 5 fotos, la fachada es la principal por defecto.
 * Cero confianza: la sesión sale del servidor; las reglas (propietario, máximo 5, siempre una visible, carpeta propia en
 * Cloudinary) las vuelve a exigir la base de datos. Aquí solo se sube/borra el archivo y se traducen errores.
 */

type Resultado<T = undefined> = ({ ok: true } & (T extends undefined ? object : { data: T })) | { ok: false; error: string };
type Rpc = { rpc: (n: string, a: object) => Promise<{ data: unknown; error: { message: string } | null }> };

const MENSAJES: Record<string, string> = {
  GALERIA_LLENA: "Ya tienes 5 fotos. Elimina o reemplaza una para agregar otra.",
  GALERIA_NO_PUEDE_QUEDAR_VACIA: "Debe quedar al menos una foto visible. Sube otra antes de eliminar esta.",
  NO_AUTORIZADO: "No tienes permiso sobre este negocio.",
  FOTO_NO_ENCONTRADA: "No encontramos esa foto.",
  ARCHIVO_INVALIDO: "No pudimos guardar la foto. Intenta de nuevo.",
};
const traducir = (m: string) => MENSAJES[Object.keys(MENSAJES).find((k) => m.includes(k)) ?? ""] ?? "No pudimos completar la acción. Intenta de nuevo.";

export interface FotoGaleria {
  id: string;
  url: string;
  orden: number;
  esPrincipal: boolean;
}

async function sesion() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("NO_AUTENTICADO");
  return supabase;
}

async function subir(negocioId: string, dataUrl: string) {
  if (!configCloudinary()) throw new Error("SIN_ALMACENAMIENTO");
  const m = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl);
  if (!m) throw new Error("TIPO_NO_PERMITIDO");
  const bytes = Buffer.from(m[2], "base64");
  if (bytes.byteLength > 8 * 1024 * 1024) throw new Error("ARCHIVO_DEMASIADO_GRANDE");
  return subirImagenCloudinary({
    bytes,
    mime: m[1],
    carpeta: `negocios/${negocioId}`,
    publicId: `galeria-${crypto.randomUUID().slice(0, 12)}`,
    maxBytes: 8 * 1024 * 1024,
  });
}

function errorDeSubida(e: unknown): string {
  const m = e instanceof Error ? e.message : "";
  if (m === "SIN_ALMACENAMIENTO") return "El almacenamiento de imágenes no está disponible por ahora.";
  if (m === "ARCHIVO_DEMASIADO_GRANDE") return "La imagen no puede superar 8 MB.";
  if (m === "TIPO_NO_PERMITIDO") return "Sube una imagen JPG, PNG o WebP.";
  if (m === "NO_AUTENTICADO") return "Inicia sesión de nuevo.";
  return "No pudimos subir la fotografía. Intenta de nuevo.";
}

export async function listarGaleria(negocioId: string): Promise<Resultado<FotoGaleria[]>> {
  try {
    const supabase = await sesion();
    const { data, error } = await (supabase as unknown as {
      from: (t: string) => { select: (c: string) => { eq: (k: string, v: string) => { order: (c: string) => Promise<{ data: { id: string; url: string; orden: number; es_principal: boolean }[] | null; error: unknown }> } } };
    }).from("negocio_foto").select("id, url, orden, es_principal").eq("negocio_id", negocioId).order("orden");
    if (error) return { ok: false, error: "No pudimos cargar la galería." };
    return { ok: true, data: (data ?? []).map((f) => ({ id: f.id, url: f.url, orden: f.orden, esPrincipal: f.es_principal })) };
  } catch {
    return { ok: false, error: "No pudimos cargar la galería." };
  }
}

export async function agregarFotoGaleria(negocioId: string, dataUrl: string): Promise<Resultado> {
  try {
    const supabase = await sesion();
    const sub = await subir(negocioId, dataUrl);
    const { error } = await (supabase as unknown as Rpc).rpc("galeria_agregar", { p_negocio_id: negocioId, p_url: sub.url, p_public_id: sub.publicId });
    if (error) {
      await borrarImagenCloudinary(sub.publicId); // no dejar archivos huérfanos si la base rechazó la foto
      return { ok: false, error: traducir(error.message) };
    }
    revalidatePath("/panel/perfil-publico");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: errorDeSubida(e) };
  }
}

export async function reemplazarFotoGaleria(negocioId: string, fotoId: string, dataUrl: string): Promise<Resultado> {
  try {
    const supabase = await sesion();
    const sub = await subir(negocioId, dataUrl);
    const { data, error } = await (supabase as unknown as Rpc).rpc("galeria_reemplazar", { p_foto_id: fotoId, p_url: sub.url, p_public_id: sub.publicId });
    if (error) {
      await borrarImagenCloudinary(sub.publicId);
      return { ok: false, error: traducir(error.message) };
    }
    if (typeof data === "string" && data) await borrarImagenCloudinary(data);
    revalidatePath("/panel/perfil-publico");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: errorDeSubida(e) };
  }
}

export async function eliminarFotoGaleria(fotoId: string): Promise<Resultado> {
  try {
    const supabase = await sesion();
    const { data, error } = await (supabase as unknown as Rpc).rpc("galeria_eliminar", { p_foto_id: fotoId });
    if (error) return { ok: false, error: traducir(error.message) };
    if (typeof data === "string" && data) await borrarImagenCloudinary(data);
    revalidatePath("/panel/perfil-publico");
    return { ok: true };
  } catch {
    return { ok: false, error: "Inicia sesión de nuevo." };
  }
}

export async function marcarFotoPrincipal(fotoId: string): Promise<Resultado> {
  try {
    const supabase = await sesion();
    const { error } = await (supabase as unknown as Rpc).rpc("galeria_marcar_principal", { p_foto_id: fotoId });
    if (error) return { ok: false, error: traducir(error.message) };
    revalidatePath("/panel/perfil-publico");
    return { ok: true };
  } catch {
    return { ok: false, error: "Inicia sesión de nuevo." };
  }
}

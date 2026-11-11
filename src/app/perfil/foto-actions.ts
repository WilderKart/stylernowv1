"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

type Resultado<T = undefined> =
  | ({ ok: true } & (T extends undefined ? object : { data: T }))
  | { ok: false; error: string };

/**
 * Foto de perfil del cliente (opcional). La persona puede elegir una foto de hasta 10 MB; el navegador la reduce
 * antes de enviarla (las acciones de servidor no admiten cuerpos grandes), y aquí el servidor vuelve a validar TODO:
 * sesión, tamaño final y tipo real por los primeros bytes del archivo (nunca se confía en el `type` que declara el
 * navegador). La ruta siempre es `<id del usuario>/…`: el cliente no decide dónde se guarda.
 */
const MAX_BYTES_ENVIADOS = 2 * 1024 * 1024;

function tipoReal(b: Uint8Array): { mime: string; ext: string } | null {
  if (b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return { mime: "image/jpeg", ext: "jpg" };
  if (b.length > 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return { mime: "image/png", ext: "png" };
  if (
    b.length > 12 &&
    String.fromCharCode(b[0], b[1], b[2], b[3]) === "RIFF" &&
    String.fromCharCode(b[8], b[9], b[10], b[11]) === "WEBP"
  ) {
    return { mime: "image/webp", ext: "webp" };
  }
  return null;
}

export async function subirFotoPerfil(formData: FormData): Promise<Resultado<{ url: string }>> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { ok: false, error: "Inicia sesión para continuar." };

    const archivo = formData.get("foto");
    if (!(archivo instanceof File)) return { ok: false, error: "Elige una imagen." };
    if (archivo.size === 0) return { ok: false, error: "La imagen está vacía." };
    if (archivo.size > MAX_BYTES_ENVIADOS) return { ok: false, error: "La imagen es demasiado grande. Prueba con otra." };

    const bytes = new Uint8Array(await archivo.arrayBuffer());
    const tipo = tipoReal(bytes);
    if (!tipo) return { ok: false, error: "Formato no admitido. Usa JPG, PNG o WebP." };

    // Una foto vigente por persona: se reemplaza y se limpian las de otros formatos.
    const ruta = `${user.id}/foto.${tipo.ext}`;
    const { error: eSubida } = await supabase.storage.from("avatars").upload(ruta, bytes, { contentType: tipo.mime, upsert: true });
    if (eSubida) return { ok: false, error: "No pudimos subir la foto. Inténtalo de nuevo." };
    const otras = ["jpg", "png", "webp"].filter((e) => e !== tipo.ext).map((e) => `${user.id}/foto.${e}`);
    await supabase.storage.from("avatars").remove(otras);

    const { data: pub } = supabase.storage.from("avatars").getPublicUrl(ruta);
    const url = `${pub.publicUrl}?v=${Date.now()}`;
    const { error: ePerfil } = await supabase.from("perfil").update({ avatar_url: url }).eq("id", user.id);
    if (ePerfil) return { ok: false, error: "La foto se subió pero no pudimos guardarla en tu perfil." };

    revalidatePath("/perfil");
    return { ok: true, data: { url } };
  } catch {
    return { ok: false, error: "No pudimos procesar la foto." };
  }
}

export async function quitarFotoPerfil(): Promise<Resultado> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { ok: false, error: "Inicia sesión para continuar." };
    await supabase.storage.from("avatars").remove(["jpg", "png", "webp"].map((e) => `${user.id}/foto.${e}`));
    const { error } = await supabase.from("perfil").update({ avatar_url: null }).eq("id", user.id);
    if (error) return { ok: false, error: "No pudimos quitar la foto." };
    revalidatePath("/perfil");
    return { ok: true };
  } catch {
    return { ok: false, error: "No pudimos quitar la foto." };
  }
}

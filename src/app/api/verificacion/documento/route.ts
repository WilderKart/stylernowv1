import { configCloudinary, subirDocumentoPrivado, tipoRealDeArchivo } from "@/lib/almacenamiento/cloudinary";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { TAMANO_MAXIMO_DOCUMENTO, TIPOS_DOCUMENTO } from "@/lib/verificacion/tipos";
import sharp from "sharp";
import type { NextRequest } from "next/server";

type RpcSinTipos = { rpc: (n: string, a?: object) => Promise<{ data: unknown; error: { message: string } | null }> };

const json = (cuerpo: object, status: number) =>
  Response.json(cuerpo, { status, headers: { "Cache-Control": "no-store" } });

/**
 * POST /api/verificacion/documento  (multipart: negocioId, tipo, archivo)
 *
 * Cero confianza: la identidad sale de la sesión; la propiedad del negocio y el estado de la verificación los
 * comprueba la base de datos; el tipo se decide por los bytes del archivo, no por lo que declare el navegador;
 * el archivo va a Cloudinary como PRIVADO (sin URL pública) y bajo la carpeta del propio negocio.
 */
export async function POST(request: NextRequest) {
  // Defensa CSRF: un formulario de otro sitio no puede subir a nombre del usuario.
  const origen = request.headers.get("origin");
  if (origen && origen !== request.nextUrl.origin) return json({ error: "Origen no permitido." }, 403);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return json({ error: "Inicia sesión de nuevo." }, 401);
  if (!configCloudinary()) return json({ error: "El almacenamiento de documentos no está disponible por ahora." }, 503);

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return json({ error: "Solicitud inválida." }, 400);
  }
  const negocioId = String(form.get("negocioId") ?? "");
  const tipo = String(form.get("tipo") ?? "");
  const archivo = form.get("archivo");
  if (!/^[0-9a-f-]{36}$/.test(negocioId) || !TIPOS_DOCUMENTO.some((t) => t.valor === tipo) || !(archivo instanceof File)) {
    return json({ error: "Faltan datos del documento." }, 400);
  }
  if (archivo.size === 0 || archivo.size > TAMANO_MAXIMO_DOCUMENTO) {
    return json({ error: "El archivo debe pesar entre 1 byte y 8 MB." }, 400);
  }

  // ¿Es el propietario y la verificación admite documentos? (la base lo decide; también se exige al registrar).
  const { data: estado, error: eEstado } = await (supabase as unknown as RpcSinTipos).rpc("mi_verificacion_negocio", {
    p_negocio_id: negocioId,
  });
  if (eEstado || !estado) return json({ error: "No tienes permiso sobre este negocio." }, 403);
  const est = (estado as { estado: string }).estado;
  if (est !== "PENDIENTE_DOCUMENTACION" && est !== "REQUIERE_CORRECCION") {
    return json({ error: "La verificación no admite documentos en este momento." }, 409);
  }

  const original = Buffer.from(await archivo.arrayBuffer());
  let mime = tipoRealDeArchivo(original);
  if (!mime) return json({ error: "Sube un PDF, JPG, PNG o WebP." }, 400);

  // Las fotos se comprimen (lado mayor 2000 px, WebP calidad 80, orientación corregida y sin metadatos como el GPS):
  // siguen siendo legibles para revisar el documento y ocupan una fracción. El PDF se guarda tal cual.
  let bytes = original;
  if (mime !== "application/pdf") {
    try {
      const comprimida = await sharp(original, { limitInputPixels: 80_000_000 })
        .rotate()
        .resize({ width: 2000, height: 2000, fit: "inside", withoutEnlargement: true })
        .webp({ quality: 80 })
        .toBuffer();
      if (comprimida.byteLength < original.byteLength) {
        bytes = comprimida;
        mime = "image/webp";
      }
    } catch {
      return json({ error: "No pudimos leer la imagen. Prueba con otra foto o súbela en PDF." }, 400);
    }
  }

  let subido;
  try {
    subido = await subirDocumentoPrivado({
      bytes,
      mime,
      carpeta: `verificacion/${negocioId}`,
      publicId: crypto.randomUUID(),
      maxBytes: TAMANO_MAXIMO_DOCUMENTO,
    });
  } catch {
    return json({ error: "No pudimos guardar el documento. Intenta de nuevo." }, 502);
  }

  const { data: id, error } = await (createAdminClient() as unknown as RpcSinTipos).rpc("registrar_documento_verificacion_srv", {
    p_actor: user.id,
    p_negocio_id: negocioId,
    p_tipo: tipo,
    p_public_id: subido.publicId,
    p_version: subido.version,
    p_formato: subido.formato,
    p_bytes: subido.bytes,
  });
  if (error) {
    const m = error.message;
    const texto = m.includes("DEMASIADOS_DOCUMENTOS")
      ? "Alcanzaste el máximo de 20 documentos."
      : m.includes("VERIFICACION_NO_EDITABLE")
        ? "La verificación no admite documentos en este momento."
        : "No pudimos registrar el documento.";
    return json({ error: texto }, 409);
  }
  return json({ ok: true, id }, 201);
}

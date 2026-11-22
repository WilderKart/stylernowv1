"use server";

import { iniciarPrueba, type DatosPrueba } from "@/app/panel/suscripcion/prueba";
import { configCloudinary, subirImagenCloudinary } from "@/lib/almacenamiento/cloudinary";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

type Resultado<T = undefined> =
  | ({ ok: true } & (T extends undefined ? object : { data: T }))
  | { ok: false; error: string };

function slugify(nombre: string) {
  return (
    nombre
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "negocio"
  );
}

async function usuarioActual() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("NO_AUTENTICADO");
  return { supabase, userId: user.id };
}

// ── Paso 1 — Datos del negocio ─────────────────────────────────────────────

export async function crearOActualizarNegocio(datos: {
  negocioId: string | null;
  nombre: string;
  categoria: string[];
  ciudad: string;
  descripcion: string;
  telefonoContacto: string;
  emailContacto: string;
}): Promise<Resultado<{ id: string }>> {
  try {
    const { supabase, userId } = await usuarioActual();

    if (datos.categoria.length === 0) {
      return { ok: false, error: "Elige al menos una categoría." };
    }

    if (datos.negocioId) {
      const { data: filas, error } = await supabase
        .from("negocio")
        .update({
          nombre: datos.nombre,
          categoria: datos.categoria,
          ciudad: datos.ciudad,
          descripcion: datos.descripcion || null,
          telefono_contacto: datos.telefonoContacto || null,
          email_contacto: datos.emailContacto || null,
        })
        .eq("id", datos.negocioId)
        .eq("owner_user_id", userId)
        .select("id");
      if (error) return { ok: false, error: error.message };
      // Sin filas actualizadas = el negocio no es de esta persona (o no existe): no se informa éxito.
      if (!filas || filas.length === 0) return { ok: false, error: "No tienes permiso sobre este negocio." };
      revalidatePath("/panel/onboarding");
      return { ok: true, data: { id: datos.negocioId } };
    }

    // Un dueño = un negocio en el alta. Si un reintento del paso 1 llega sin negocioId (un error posterior al
    // INSERT, doble envío…), se actualiza el negocio que ya tiene en vez de crear otro: en producción quedaron
    // 3 negocios del mismo dueño y el panel lo devolvía al inicio del asistente (auditoría 2026-11-14).
    const { data: existentes } = await supabase
      .from("negocio")
      .select("id")
      .eq("owner_user_id", userId)
      .order("onboarding_completo", { ascending: false })
      .order("created_at", { ascending: true })
      .limit(1);
    if (existentes && existentes.length > 0) {
      return crearOActualizarNegocio({ ...datos, negocioId: existentes[0].id });
    }

    // Slug único: nombre + sufijo corto del owner, con reintento simple si
    // por casualidad ya existe (negocio.slug es unique).
    //
    // El `id` se genera aquí, no se deja al DEFAULT de la columna: pedirle a
    // Postgres el registro recién insertado (.select()) exige que la política
    // de SELECT lo autorice, y esa política depende de is_barberia_de(), que
    // vuelve a consultar la MISMA fila que se está insertando — en el mismo
    // comando INSERT ... RETURNING eso falla con "new row violates row-level
    // security policy" incluso con una política trivial `true` (verificado
    // directo contra Postgres). Generando el id aquí evitamos pedir RETURNING.
    const base = slugify(datos.nombre);
    let slug = base;
    for (let intento = 0; intento < 5; intento++) {
      const id = crypto.randomUUID();
      const { error } = await supabase.from("negocio").insert({
        id,
        owner_user_id: userId,
        nombre: datos.nombre,
        slug,
        categoria: datos.categoria,
        ciudad: datos.ciudad,
        descripcion: datos.descripcion || null,
        telefono_contacto: datos.telefonoContacto || null,
        email_contacto: datos.emailContacto || null,
      });

      if (!error) {
        revalidatePath("/panel/onboarding");
        return { ok: true, data: { id } };
      }
      if (error.code === "23505") {
        slug = `${base}-${Math.random().toString(36).slice(2, 6)}`;
        continue;
      }
      return { ok: false, error: error.message };
    }
    return { ok: false, error: "No se pudo generar un identificador único, reintenta." };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error inesperado." };
  }
}

export async function subirLogo(negocioId: string, dataUrl: string): Promise<Resultado<{ url: string }>> {
  try {
    const { supabase, userId } = await usuarioActual();

    const { data: negocio } = await supabase
      .from("negocio")
      .select("id")
      .eq("id", negocioId)
      .eq("owner_user_id", userId)
      .maybeSingle();
    if (!negocio) return { ok: false, error: "No autorizado." };

    const match = /^data:(image\/\w+);base64,(.+)$/.exec(dataUrl);
    if (!match) return { ok: false, error: "Imagen inválida." };
    const [, mime, base64] = match;
    const ext = mime.split("/")[1] === "jpeg" ? "jpg" : mime.split("/")[1];
    const bytes = Buffer.from(base64, "base64");
    if (bytes.byteLength > 5 * 1024 * 1024) {
      return { ok: false, error: "La imagen no puede superar 5 MB." };
    }

    let url: string;
    if (configCloudinary()) {
      // Decisión B: archivos nuevos a Cloudinary. El logo es público (se muestra en el perfil del negocio).
      const sub = await subirImagenCloudinary({ bytes, mime, carpeta: `negocios/${negocioId}`, publicId: "logo" });
      url = sub.url;
    } else {
      // Cloudinary aún no está configurado en este entorno: se conserva el camino anterior para no bloquear el alta.
      const ruta = `${negocioId}/logo.${ext}`;
      const { error: eUpload } = await supabase.storage
        .from("negocio-media")
        .upload(ruta, bytes, { contentType: mime, upsert: true });
      if (eUpload) return { ok: false, error: eUpload.message };
      const { data: pub } = supabase.storage.from("negocio-media").getPublicUrl(ruta);
      url = `${pub.publicUrl}?v=${Date.now()}`;
    }

    await supabase.from("negocio").update({ logo_url: url }).eq("id", negocioId);
    revalidatePath("/panel/onboarding");
    return { ok: true, data: { url } };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error inesperado." };
  }
}

export async function elegirPlan(
  negocioId: string,
  planCodigo: "ESSENTIAL" | "STUDIO" | "PRESTIGE"
): Promise<Resultado> {
  try {
    const { supabase } = await usuarioActual();
    const { error } = await supabase.rpc("crear_suscripcion_inicial", {
      p_negocio_id: negocioId,
      p_plan_codigo: planCodigo,
    });
    if (error) return { ok: false, error: error.message };
    revalidatePath("/panel/onboarding");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error inesperado." };
  }
}

// ── Paso 1 — Fotografía principal (fachada) ────────────────────────────────

/** ¿Hay almacenamiento de imágenes de Cloudinary en este entorno? (la fachada no usa Supabase Storage nunca). */
export async function almacenamientoDeImagenesDisponible(): Promise<boolean> {
  return configCloudinary() !== null;
}

export async function subirFotoPrincipal(negocioId: string, dataUrl: string): Promise<Resultado<{ url: string }>> {
  try {
    const { supabase, userId } = await usuarioActual();
    const { data: negocio } = await supabase
      .from("negocio")
      .select("id")
      .eq("id", negocioId)
      .eq("owner_user_id", userId)
      .maybeSingle();
    if (!negocio) return { ok: false, error: "No autorizado." };
    if (!configCloudinary()) {
      return { ok: false, error: "El almacenamiento de imágenes no está disponible por ahora. Podrás subir la fotografía desde tu panel." };
    }

    const match = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl);
    if (!match) return { ok: false, error: "Sube una imagen JPG, PNG o WebP." };
    const bytes = Buffer.from(match[2], "base64");
    if (bytes.byteLength > 8 * 1024 * 1024) return { ok: false, error: "La imagen no puede superar 8 MB." };

    const sub = await subirImagenCloudinary({
      bytes,
      mime: match[1],
      carpeta: `negocios/${negocioId}`,
      publicId: "fachada",
      maxBytes: 8 * 1024 * 1024,
    });
    // RPC de la migración 157: valida dueño, host de Cloudinary y la carpeta del propio negocio.
    const { error } = await (supabase as unknown as {
      rpc: (n: string, a: object) => Promise<{ error: { message: string } | null }>;
    }).rpc("fijar_foto_principal_negocio", {
      p_negocio_id: negocioId,
      p_url: sub.url,
      p_public_id: sub.publicId,
    });
    if (error) return { ok: false, error: "No pudimos guardar la fotografía. Intenta de nuevo." };
    revalidatePath("/panel/onboarding");
    return { ok: true, data: { url: sub.url } };
  } catch (e) {
    const m = e instanceof Error ? e.message : "";
    if (m === "ARCHIVO_DEMASIADO_GRANDE") return { ok: false, error: "La imagen no puede superar 8 MB." };
    if (m === "TIPO_NO_PERMITIDO") return { ok: false, error: "Sube una imagen JPG, PNG o WebP." };
    return { ok: false, error: "No pudimos subir la fotografía. Intenta de nuevo." };
  }
}

// ── Paso 4 — Activar la prueba y cerrar el alta ─────────────────────────────

export interface ResumenAlta {
  nombre: string;
  fotoUrl: string | null;
  planCodigo: string;
  pruebaInicio: string;
  pruebaFin: string;
  conMetodoPago: boolean;
}

/**
 * Activa la prueba (sin tarjeta; el servidor fija fechas y reglas antiabuso) y cierra el onboarding. Idempotente:
 * si la prueba ya está activa por un reintento o una doble pulsación, no crea otra; solo confirma el cierre.
 */
export async function activarPruebaYCompletar(entrada: DatosPrueba): Promise<Resultado<ResumenAlta>> {
  try {
    const { supabase, userId } = await usuarioActual();
    const { data: previa } = await supabase
      .from("suscripcion")
      .select("estado")
      .eq("negocio_id", entrada.negocioId)
      .maybeSingle();

    if (previa?.estado !== "TRIAL") {
      const r = await iniciarPrueba(entrada);
      if (!r.ok) return r;
    }

    const { error } = await (supabase as unknown as {
      rpc: (n: string, a: object) => Promise<{ error: { message: string } | null }>;
    }).rpc("completar_onboarding_negocio", { p_negocio_id: entrada.negocioId });
    if (error) {
      const mensajes: Record<string, string> = {
        FALTA_SEDE: "Falta la ubicación de tu negocio. Vuelve al paso 2.",
        FALTA_PRUEBA_ACTIVA: "No pudimos activar tu prueba. Intenta de nuevo.",
        NO_AUTORIZADO: "No tienes permiso sobre este negocio.",
      };
      const clave = Object.keys(mensajes).find((k) => error.message.includes(k));
      return { ok: false, error: clave ? mensajes[clave] : "No pudimos completar el registro. Intenta de nuevo." };
    }

    const [{ data: negocio }, { data: susc }] = await Promise.all([
      supabase.from("negocio").select("nombre, foto_principal_url").eq("id", entrada.negocioId).eq("owner_user_id", userId).single(),
      supabase.from("suscripcion").select("plan_codigo, prueba_inicio, prueba_fin, metodo_pago_ref").eq("negocio_id", entrada.negocioId).single(),
    ]);
    revalidatePath("/panel");
    revalidatePath("/panel/onboarding");
    return {
      ok: true,
      data: {
        nombre: negocio?.nombre ?? "",
        fotoUrl: negocio?.foto_principal_url ?? null,
        planCodigo: susc?.plan_codigo ?? entrada.plan,
        pruebaInicio: susc?.prueba_inicio ?? new Date().toISOString(),
        pruebaFin: susc?.prueba_fin ?? new Date().toISOString(),
        conMetodoPago: Boolean(susc?.metodo_pago_ref),
      },
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error inesperado." };
  }
}

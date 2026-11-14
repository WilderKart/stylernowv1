"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

type Resultado<T = undefined> =
  | ({ ok: true } & (T extends undefined ? object : { data: T }))
  | { ok: false; error: string };

async function usuarioActual() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("NO_AUTENTICADO");
  return { supabase, userId: user.id };
}

const MENSAJES_ERROR: Record<string, string> = {
  "servicio_duracion_rango": "La duración debe estar entre 5 y 480 minutos.",
  "servicio_precio_base_check": "El precio no puede ser negativo.",
  "Solo la Barbería puede cambiar el precio": "Solo la Barbería puede cambiar el precio de un servicio.",
};

function traducirError(mensaje: string) {
  const clave = Object.keys(MENSAJES_ERROR).find((k) => mensaje.includes(k));
  return clave ? MENSAJES_ERROR[clave] : mensaje;
}

type CategoriaPuntaje = "ESTANDAR" | "PREMIUM" | "COMPLEMENTARIO";

// ── Servicios ────────────────────────────────────────────────────────────

export interface DatosServicio {
  negocioId: string;
  nombre: string;
  descripcion?: string;
  duracionMinutos: number;
  precioBase: number;
  categoriaPuntaje?: CategoriaPuntaje;
  bufferPrevioMinutos?: number;
  bufferPosteriorMinutos?: number;
}

async function existeNombreDuplicado(
  supabase: Awaited<ReturnType<typeof createClient>>,
  negocioId: string,
  nombre: string,
  excluirId?: string
) {
  let q = supabase
    .from("servicio")
    .select("id")
    .eq("negocio_id", negocioId)
    .eq("estado", "ACTIVO")
    .ilike("nombre", nombre.trim());
  if (excluirId) q = q.neq("id", excluirId);
  const { data } = await q;
  return (data?.length ?? 0) > 0;
}

export async function crearServicio(datos: DatosServicio): Promise<Resultado<{ id: string }>> {
  try {
    const { supabase } = await usuarioActual();

    if (datos.duracionMinutos < 5 || datos.duracionMinutos > 480) {
      return { ok: false, error: "La duración debe estar entre 5 y 480 minutos." };
    }
    if (datos.precioBase < 0) return { ok: false, error: "El precio no puede ser negativo." };
    if (await existeNombreDuplicado(supabase, datos.negocioId, datos.nombre)) {
      return { ok: false, error: "Ya existe un servicio activo con ese nombre." };
    }

    const { data, error } = await supabase
      .from("servicio")
      .insert({
        negocio_id: datos.negocioId,
        nombre: datos.nombre.trim(),
        descripcion: datos.descripcion?.trim() || null,
        duracion_minutos: datos.duracionMinutos,
        precio_base: datos.precioBase,
        categoria_puntaje: datos.categoriaPuntaje ?? "ESTANDAR",
        buffer_previo_minutos: datos.bufferPrevioMinutos ?? 0,
        buffer_posterior_minutos: datos.bufferPosteriorMinutos ?? 0,
      })
      .select("id")
      .single();
    if (error) return { ok: false, error: traducirError(error.message) };

    revalidatePath("/panel/servicios");
    revalidatePath("/panel/onboarding");
    return { ok: true, data: { id: data.id } };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error inesperado." };
  }
}

export async function actualizarServicio(
  servicioId: string,
  datos: Omit<DatosServicio, "negocioId">
): Promise<Resultado> {
  try {
    const { supabase } = await usuarioActual();

    if (datos.duracionMinutos < 5 || datos.duracionMinutos > 480) {
      return { ok: false, error: "La duración debe estar entre 5 y 480 minutos." };
    }
    if (datos.precioBase < 0) return { ok: false, error: "El precio no puede ser negativo." };

    const { data: actual } = await supabase.from("servicio").select("negocio_id").eq("id", servicioId).single();
    if (actual && (await existeNombreDuplicado(supabase, actual.negocio_id, datos.nombre, servicioId))) {
      return { ok: false, error: "Ya existe otro servicio activo con ese nombre." };
    }

    const { error } = await supabase
      .from("servicio")
      .update({
        nombre: datos.nombre.trim(),
        descripcion: datos.descripcion?.trim() || null,
        duracion_minutos: datos.duracionMinutos,
        precio_base: datos.precioBase,
        categoria_puntaje: datos.categoriaPuntaje ?? "ESTANDAR",
        buffer_previo_minutos: datos.bufferPrevioMinutos ?? 0,
        buffer_posterior_minutos: datos.bufferPosteriorMinutos ?? 0,
      })
      .eq("id", servicioId);
    if (error) return { ok: false, error: traducirError(error.message) };

    revalidatePath("/panel/servicios");
    revalidatePath(`/panel/servicios/${servicioId}`);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error inesperado." };
  }
}

export async function cambiarEstadoServicio(servicioId: string, activar: boolean): Promise<Resultado> {
  try {
    const { supabase } = await usuarioActual();
    // Soft delete (03-Business-Rules/02_Booking_Rules.md): nunca borrado
    // físico — Reservas futuras/pasadas conservan la referencia íntegra.
    const { error } = await supabase
      .from("servicio")
      .update({ estado: activar ? "ACTIVO" : "INACTIVO" })
      .eq("id", servicioId);
    if (error) return { ok: false, error: traducirError(error.message) };
    revalidatePath("/panel/servicios");
    revalidatePath(`/panel/servicios/${servicioId}`);
    revalidatePath("/panel/onboarding");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error inesperado." };
  }
}

// ── Imagen guía del servicio (migración 134) ─────────────────────────────

const MIME_IMAGEN: Record<string, string> = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" };

/**
 * Sube (o reemplaza) la imagen de un servicio. Solo el dueño del negocio: se verifica aquí contra la base
 * (servicio → negocio → owner) y otra vez en Storage (política negocio_media_*_barberia sobre la carpeta).
 * Nunca se confía en un negocioId del navegador: sale del servicio.
 */
export async function subirImagenServicio(servicioId: string, dataUrl: string): Promise<Resultado<{ url: string }>> {
  try {
    const { supabase, userId } = await usuarioActual();
    if (!/^[0-9a-f-]{36}$/i.test(servicioId)) return { ok: false, error: "Servicio inválido." };

    const { data: servicio } = await supabase.from("servicio").select("id, negocio_id").eq("id", servicioId).maybeSingle();
    if (!servicio) return { ok: false, error: "No encontramos ese servicio." };
    const { data: negocio } = await supabase
      .from("negocio")
      .select("id")
      .eq("id", servicio.negocio_id)
      .eq("owner_user_id", userId)
      .maybeSingle();
    if (!negocio) return { ok: false, error: "Solo el dueño del negocio puede cambiar la imagen." };

    const m = /^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl);
    if (!m) return { ok: false, error: "Usa una imagen PNG, JPG o WebP." };
    const bytes = Buffer.from(m[2], "base64");
    if (bytes.byteLength > 5 * 1024 * 1024) return { ok: false, error: "La imagen no puede superar 5 MB." };

    const ruta = `${servicio.negocio_id}/servicios/${servicio.id}.${MIME_IMAGEN[m[1]]}`;
    const { error: eUp } = await supabase.storage.from("negocio-media").upload(ruta, bytes, { contentType: m[1], upsert: true });
    if (eUp) return { ok: false, error: "No pudimos subir la imagen. Intenta de nuevo." };
    const { data: pub } = supabase.storage.from("negocio-media").getPublicUrl(ruta);
    const url = `${pub.publicUrl}?v=${Date.now()}`;

    const { error } = await (supabase as unknown as {
      from: (t: string) => { update: (v: object) => { eq: (c: string, v: string) => Promise<{ error: { message: string } | null }> } };
    })
      .from("servicio")
      .update({ imagen_url: url })
      .eq("id", servicio.id);
    if (error) return { ok: false, error: "No pudimos guardar la imagen del servicio." };

    revalidatePath("/panel/servicios");
    revalidatePath(`/panel/servicios/${servicio.id}`);
    revalidatePath("/panel/onboarding");
    return { ok: true, data: { url } };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error inesperado." };
  }
}

// Alias retrocompatible del wizard de onboarding (2.1) — "eliminar" ahí
// siempre significó desactivar, nunca borrado físico.
export async function eliminarServicio(servicioId: string): Promise<Resultado> {
  return cambiarEstadoServicio(servicioId, false);
}

// ── Staff asignado a un Servicio (staff_servicio) ───────────────────────

export interface StaffAsignable {
  staffId: string;
  nombre: string;
  fotoUrl: string | null;
  asignado: boolean;
}

export async function listarStaffAsignable(negocioId: string, servicioId: string): Promise<Resultado<StaffAsignable[]>> {
  try {
    const { supabase } = await usuarioActual();
    const [{ data: vinculos }, { data: asignados }] = await Promise.all([
      supabase
        .from("vinculo_staff_negocio")
        .select("staff_id, staff:staff_id (nombre, foto_url)")
        .eq("negocio_id", negocioId)
        .eq("estado", "ACTIVO"),
      supabase.from("staff_servicio").select("staff_id").eq("servicio_id", servicioId),
    ]);
    const asignadosSet = new Set((asignados ?? []).map((a) => a.staff_id));
    const items: StaffAsignable[] = (vinculos ?? []).map((v) => ({
      staffId: v.staff_id,
      nombre: (v.staff as unknown as { nombre: string } | null)?.nombre ?? "Staff",
      fotoUrl: (v.staff as unknown as { foto_url: string | null } | null)?.foto_url ?? null,
      asignado: asignadosSet.has(v.staff_id),
    }));
    return { ok: true, data: items };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error inesperado." };
  }
}

export async function alternarStaffServicio(
  servicioId: string,
  staffId: string,
  asignar: boolean
): Promise<Resultado> {
  try {
    const { supabase } = await usuarioActual();
    const { error } = asignar
      ? await supabase.from("staff_servicio").insert({ servicio_id: servicioId, staff_id: staffId })
      : await supabase.from("staff_servicio").delete().eq("servicio_id", servicioId).eq("staff_id", staffId);
    if (error) return { ok: false, error: error.message };
    revalidatePath(`/panel/servicios/${servicioId}`);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error inesperado." };
  }
}

// ── Combos ───────────────────────────────────────────────────────────────

export interface DatosCombo {
  negocioId: string;
  nombre: string;
  descripcion?: string;
  servicioIds: string[];
  precioTotalOverride?: number;
  duracionMinutosOverride?: number;
}

export async function crearCombo(datos: DatosCombo): Promise<Resultado<{ id: string }>> {
  try {
    const { supabase } = await usuarioActual();

    if (datos.servicioIds.length < 2) {
      return { ok: false, error: "Un combo necesita al menos 2 servicios." };
    }
    if (datos.precioTotalOverride != null && datos.precioTotalOverride < 0) {
      return { ok: false, error: "El precio no puede ser negativo." };
    }
    if (
      datos.duracionMinutosOverride != null &&
      (datos.duracionMinutosOverride < 5 || datos.duracionMinutosOverride > 480)
    ) {
      return { ok: false, error: "La duración debe estar entre 5 y 480 minutos." };
    }

    const { data: combo, error } = await supabase
      .from("servicio_combo")
      .insert({
        negocio_id: datos.negocioId,
        nombre: datos.nombre.trim(),
        descripcion: datos.descripcion?.trim() || null,
        precio_total_override: datos.precioTotalOverride ?? null,
        duracion_minutos_override: datos.duracionMinutosOverride ?? null,
      })
      .select("id")
      .single();
    if (error) return { ok: false, error: traducirError(error.message) };

    const { error: eItems } = await supabase
      .from("servicio_combo_item")
      .insert(datos.servicioIds.map((servicioId) => ({ combo_id: combo.id, servicio_id: servicioId })));
    if (eItems) {
      await supabase.from("servicio_combo").delete().eq("id", combo.id);
      return { ok: false, error: eItems.message };
    }

    revalidatePath("/panel/servicios");
    return { ok: true, data: { id: combo.id } };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error inesperado." };
  }
}

export async function actualizarCombo(comboId: string, datos: Omit<DatosCombo, "negocioId">): Promise<Resultado> {
  try {
    const { supabase } = await usuarioActual();

    if (datos.servicioIds.length < 2) {
      return { ok: false, error: "Un combo necesita al menos 2 servicios." };
    }
    if (datos.precioTotalOverride != null && datos.precioTotalOverride < 0) {
      return { ok: false, error: "El precio no puede ser negativo." };
    }
    if (
      datos.duracionMinutosOverride != null &&
      (datos.duracionMinutosOverride < 5 || datos.duracionMinutosOverride > 480)
    ) {
      return { ok: false, error: "La duración debe estar entre 5 y 480 minutos." };
    }

    const { error } = await supabase
      .from("servicio_combo")
      .update({
        nombre: datos.nombre.trim(),
        descripcion: datos.descripcion?.trim() || null,
        precio_total_override: datos.precioTotalOverride ?? null,
        duracion_minutos_override: datos.duracionMinutosOverride ?? null,
      })
      .eq("id", comboId);
    if (error) return { ok: false, error: traducirError(error.message) };

    await supabase.from("servicio_combo_item").delete().eq("combo_id", comboId);
    const { error: eItems } = await supabase
      .from("servicio_combo_item")
      .insert(datos.servicioIds.map((servicioId) => ({ combo_id: comboId, servicio_id: servicioId })));
    if (eItems) return { ok: false, error: eItems.message };

    revalidatePath("/panel/servicios");
    revalidatePath(`/panel/servicios/combos/${comboId}`);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error inesperado." };
  }
}

export async function cambiarEstadoCombo(comboId: string, activar: boolean): Promise<Resultado> {
  try {
    const { supabase } = await usuarioActual();
    const { error } = await supabase
      .from("servicio_combo")
      .update({ estado: activar ? "ACTIVO" : "INACTIVO" })
      .eq("id", comboId);
    if (error) return { ok: false, error: traducirError(error.message) };
    revalidatePath("/panel/servicios");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error inesperado." };
  }
}

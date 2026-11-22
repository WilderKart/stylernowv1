"use server";

import { configCloudinary, subirImagenCloudinary } from "@/lib/almacenamiento/cloudinary";
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

// ── Perfil ────────────────────────────────────────────────────────────────

export interface MiPerfilStaff {
  nombre: string;
  fotoUrl: string | null;
  especialidad: string | null;
  bio: string | null;
}

export async function obtenerMiPerfilStaff(): Promise<Resultado<MiPerfilStaff>> {
  try {
    const { supabase, userId } = await usuarioActual();
    const { data, error } = await supabase.from("staff").select("nombre, foto_url, especialidad, bio").eq("usuario_id", userId).single();
    if (error) return { ok: false, error: error.message };
    return { ok: true, data: { nombre: data.nombre, fotoUrl: data.foto_url, especialidad: data.especialidad, bio: data.bio } };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error inesperado." };
  }
}

export async function actualizarMiPerfilStaff(datos: { nombre: string; especialidad: string; bio: string }): Promise<Resultado> {
  try {
    const { supabase, userId } = await usuarioActual();
    if (!datos.nombre.trim()) return { ok: false, error: "El nombre no puede estar vacío." };
    const { error } = await supabase
      .from("staff")
      .update({ nombre: datos.nombre.trim(), especialidad: datos.especialidad.trim() || null, bio: datos.bio.trim() || null })
      .eq("usuario_id", userId);
    if (error) return { ok: false, error: error.message };
    revalidatePath("/staff/perfil");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error inesperado." };
  }
}

export async function subirFotoPerfilStaff(dataUrl: string): Promise<Resultado<{ url: string }>> {
  try {
    const { supabase, userId } = await usuarioActual();

    const match = /^data:(image\/\w+);base64,(.+)$/.exec(dataUrl);
    if (!match) return { ok: false, error: "Imagen inválida." };
    const [, mime, base64] = match;
    const ext = mime.split("/")[1] === "jpeg" ? "jpg" : mime.split("/")[1];
    const bytes = Buffer.from(base64, "base64");
    if (bytes.byteLength > 5 * 1024 * 1024) return { ok: false, error: "La imagen no puede superar 5 MB." };

    // Cloudinary (decisión B) solo si está configurado; si no, Supabase Storage como hasta hoy.
    // La foto es de entrega pública (es la que se publica con autorización); la visibilidad la
    // decide `staff_es_publicable`, no la URL. No se migran ni borran fotos anteriores.
    if (configCloudinary()) {
      try {
        const subida = await subirImagenCloudinary({ bytes, mime, carpeta: `stylernow/staff/${userId}`, publicId: "foto" });
        await supabase.from("staff").update({ foto_url: subida.url }).eq("usuario_id", userId);
        revalidatePath("/staff/perfil");
        return { ok: true, data: { url: subida.url } };
      } catch (e) {
        const codigo = e instanceof Error ? e.message : "";
        if (codigo === "TIPO_NO_PERMITIDO") return { ok: false, error: "Usa una imagen JPG, PNG o WebP." };
        return { ok: false, error: "No pudimos subir la foto. Intenta de nuevo." };
      }
    }

    const ruta = `${userId}/foto.${ext}`;
    const { error: eUpload } = await supabase.storage.from("avatars").upload(ruta, bytes, { contentType: mime, upsert: true });
    if (eUpload) return { ok: false, error: eUpload.message };

    const { data: pub } = supabase.storage.from("avatars").getPublicUrl(ruta);
    const url = `${pub.publicUrl}?v=${Date.now()}`;
    await supabase.from("staff").update({ foto_url: url }).eq("usuario_id", userId);

    revalidatePath("/staff/perfil");
    return { ok: true, data: { url } };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error inesperado." };
  }
}

// ── Ganancias ─────────────────────────────────────────────────────────────

export interface MisGanancias {
  comisionGenerada: number;
  reservasCompletadas: number;
  propinas: number;
}

export async function obtenerMisGanancias(negocioId: string, vinculoId: string, desdeISO: string, hastaISO: string): Promise<Resultado<MisGanancias>> {
  try {
    const supabase = (await usuarioActual()).supabase;
    const [{ data: ranking, error: eRanking }, { data: propinas, error: ePropinas }] = await Promise.all([
      supabase.rpc("reportes_ranking_staff", { p_negocio_id: negocioId, p_vinculo_id: vinculoId, p_desde: desdeISO, p_hasta: hastaISO }),
      supabase.rpc("staff_mis_propinas", { p_desde: desdeISO, p_hasta: hastaISO }),
    ]);
    if (eRanking) return { ok: false, error: eRanking.message };
    if (ePropinas) return { ok: false, error: ePropinas.message };
    const fila = (ranking ?? [])[0];
    return {
      ok: true,
      data: {
        comisionGenerada: Number(fila?.comision_generada ?? 0),
        reservasCompletadas: fila?.reservas_completadas ?? 0,
        propinas: Number(propinas ?? 0),
      },
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error inesperado." };
  }
}

// ── Disponibilidad ───────────────────────────────────────────────────────

export interface DiaDisponibilidad {
  diaSemana: number;
  horaInicio: string | null;
  horaFin: string | null;
}

export async function listarMiDisponibilidad(vinculoId: string): Promise<Resultado<DiaDisponibilidad[]>> {
  try {
    const supabase = (await usuarioActual()).supabase;
    const { data, error } = await supabase.from("disponibilidad").select("dia_semana, hora_inicio, hora_fin").eq("vinculo_id", vinculoId);
    if (error) return { ok: false, error: error.message };
    const porDia = new Map(data?.map((d) => [d.dia_semana, d]));
    return {
      ok: true,
      data: Array.from({ length: 7 }, (_, dia) => ({
        diaSemana: dia,
        horaInicio: porDia.get(dia)?.hora_inicio ?? null,
        horaFin: porDia.get(dia)?.hora_fin ?? null,
      })),
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error inesperado." };
  }
}

// V1: una sola franja horaria por día (simplificación consistente con el
// resto del proyecto — la tabla soporta múltiples franjas, pero no había
// ningún caso de uso concreto de turnos partidos para Staff todavía).
export async function guardarDiaDisponibilidad(
  vinculoId: string,
  sedeId: string,
  diaSemana: number,
  horaInicio: string | null,
  horaFin: string | null
): Promise<Resultado> {
  try {
    const supabase = (await usuarioActual()).supabase;
    await supabase.from("disponibilidad").delete().eq("vinculo_id", vinculoId).eq("dia_semana", diaSemana);
    if (horaInicio && horaFin) {
      const { error } = await supabase
        .from("disponibilidad")
        .insert({ vinculo_id: vinculoId, sede_id: sedeId, dia_semana: diaSemana, hora_inicio: horaInicio, hora_fin: horaFin });
      if (error) return { ok: false, error: error.message };
    }
    revalidatePath("/staff/perfil");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error inesperado." };
  }
}

// ── Bloqueos de ausencia ──────────────────────────────────────────────────

export interface BloqueoStaff {
  id: string;
  fechaInicio: string;
  fechaFin: string;
  motivo: string | null;
}

export async function listarMisBloqueos(vinculoId: string): Promise<Resultado<BloqueoStaff[]>> {
  try {
    const supabase = (await usuarioActual()).supabase;
    const { data, error } = await supabase
      .from("bloqueo_ausencia")
      .select("id, fecha_inicio, fecha_fin, motivo")
      .eq("vinculo_id", vinculoId)
      .gte("fecha_fin", new Date().toISOString())
      .order("fecha_inicio");
    if (error) return { ok: false, error: error.message };
    return { ok: true, data: (data ?? []).map((b) => ({ id: b.id, fechaInicio: b.fecha_inicio, fechaFin: b.fecha_fin, motivo: b.motivo })) };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error inesperado." };
  }
}

export async function crearMiBloqueo(vinculoId: string, fechaInicio: string, fechaFin: string, motivo: string): Promise<Resultado> {
  try {
    const supabase = (await usuarioActual()).supabase;
    if (new Date(fechaFin) <= new Date(fechaInicio)) return { ok: false, error: "La fecha de fin debe ser posterior al inicio." };
    const { error } = await supabase
      .from("bloqueo_ausencia")
      .insert({ vinculo_id: vinculoId, fecha_inicio: fechaInicio, fecha_fin: fechaFin, motivo: motivo || null });
    if (error) return { ok: false, error: error.message };
    revalidatePath("/staff/perfil");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error inesperado." };
  }
}

export async function eliminarMiBloqueo(id: string): Promise<Resultado> {
  try {
    const supabase = (await usuarioActual()).supabase;
    const { error } = await supabase.from("bloqueo_ausencia").delete().eq("id", id);
    if (error) return { ok: false, error: error.message };
    revalidatePath("/staff/perfil");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error inesperado." };
  }
}

// ── Autorizaciones del profesional (tratamiento y publicación) ────────────────
// Toda la regla vive en la base (`autorizar_staff`, `revocar_publicacion_staff`,
// `estado_autorizaciones_staff`, migración 147): el negocio sale del vínculo propio y la
// evidencia queda en el repositorio legal; aquí solo se traducen errores.

export interface MisAutorizaciones {
  tieneFoto: boolean;
  tratamiento: string | null;
  tratamientoAt: string | null;
  publicacion: string | null;
  publicacionAt: string | null;
  publicable: boolean;
  enTransicion: boolean;
  transicionFin: string | null;
}

const ERRORES_AUTORIZACION: Record<string, string> = {
  REQUIERE_TRATAMIENTO: "Primero autoriza el tratamiento de tus datos para tu vínculo profesional.",
  SIN_VINCULO: "No encontramos tu vínculo activo con un negocio.",
  TEXTO_NO_DISPONIBLE: "El texto de esta autorización no está disponible. Intenta más tarde.",
  NO_AUTENTICADO: "Tu sesión venció. Vuelve a ingresar.",
};

function errorAutorizacion(mensaje: string) {
  const clave = Object.keys(ERRORES_AUTORIZACION).find((k) => mensaje.includes(k));
  return clave ? ERRORES_AUTORIZACION[clave] : "No pudimos guardar tu decisión. Intenta de nuevo.";
}

type Rpc = { rpc: (n: string, a?: object) => Promise<{ data: unknown; error: { message: string } | null }> };

export async function obtenerMisAutorizaciones(negocioId: string): Promise<Resultado<MisAutorizaciones>> {
  try {
    const { supabase, userId } = await usuarioActual();
    const { data, error } = await (supabase as unknown as Rpc).rpc("estado_autorizaciones_staff", { p_negocio: negocioId });
    if (error) return { ok: false, error: errorAutorizacion(error.message) };
    const fila = ((data ?? []) as Array<Record<string, unknown>>).find((f) => f.staff_id === userId);
    if (!fila) return { ok: false, error: ERRORES_AUTORIZACION.SIN_VINCULO };
    return {
      ok: true,
      data: {
        tieneFoto: Boolean(fila.tiene_foto),
        tratamiento: (fila.tratamiento as string | null) ?? null,
        tratamientoAt: (fila.tratamiento_at as string | null) ?? null,
        publicacion: (fila.publicacion as string | null) ?? null,
        publicacionAt: (fila.publicacion_at as string | null) ?? null,
        publicable: Boolean(fila.publicable),
        enTransicion: Boolean(fila.en_transicion),
        transicionFin: (fila.transicion_fin as string | null) ?? null,
      },
    };
  } catch {
    return { ok: false, error: "No pudimos cargar tus autorizaciones." };
  }
}

/** Otorga una autorización desde el perfil. Nunca se marca sola: requiere esta acción explícita. */
export async function autorizarDesdePerfil(documento: "tratamiento" | "publicacion"): Promise<Resultado> {
  try {
    const { supabase } = await usuarioActual();
    const { error } = await (supabase as unknown as Rpc).rpc("autorizar_staff", {
      p_documento: documento === "tratamiento" ? "AUTORIZACION_STAFF_TRATAMIENTO" : "AUTORIZACION_STAFF_PUBLICACION",
      p_canal: "perfil",
    });
    if (error) return { ok: false, error: errorAutorizacion(error.message) };
    revalidatePath("/staff/perfil");
    return { ok: true };
  } catch {
    return { ok: false, error: "No pudimos guardar tu decisión. Intenta de nuevo." };
  }
}

/** Revoca la publicación del perfil (nuevo evento REVOCA; la aceptación previa se conserva como evidencia). */
export async function revocarPublicacion(): Promise<Resultado> {
  try {
    const { supabase } = await usuarioActual();
    const { error } = await (supabase as unknown as Rpc).rpc("revocar_publicacion_staff");
    if (error) return { ok: false, error: errorAutorizacion(error.message) };
    revalidatePath("/staff/perfil");
    return { ok: true };
  } catch {
    return { ok: false, error: "No pudimos guardar tu decisión. Intenta de nuevo." };
  }
}

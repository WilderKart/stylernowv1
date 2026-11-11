import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { llamarRpc, type Resultado } from "./base";

/** C05 Perfil del profesional y C06 Filtros del marketplace. Lecturas públicas (también para anónimos). */
export interface PerfilProfesional {
  staff_id: string;
  nombre: string;
  foto_url: string | null;
  especialidad: string | null;
  bio: string | null;
  nivel: string | null;
  negocio: { negocio_id: string; nombre: string; slug: string; ciudad: string | null };
  cortes: number;
  anios: number;
  /** Promedio 1–5 (2 decimales) o null sin reseñas. */
  nota: number | null;
  total_resenas: number;
  /** { "1": n, …, "5": n } */
  distribucion: Record<"1" | "2" | "3" | "4" | "5", number>;
  precio_desde: number | null;
  /** Solo fotos que el cliente decidió compartir en My Look. `url` ya viene firmada (1 h). */
  portafolio: { foto_id: string; url: string; momento: "ANTES" | "DESPUES" | null }[];
}

/** null si el profesional no existe / no está activo en ese negocio. */
export async function obtenerPerfilProfesional(negocioId: string, staffId: string): Promise<Resultado<PerfilProfesional | null>> {
  const r = await llamarRpc<PerfilProfesional | null>("staff_perfil_publico", { p_negocio_id: negocioId, p_staff_id: staffId });
  if (!r.ok || !r.data) return r;
  const admin = createAdminClient();
  const portafolio = await Promise.all(
    (r.data.portafolio ?? []).map(async (f) => {
      if (/^https?:\/\//.test(f.url)) return f;
      const { data } = await admin.storage.from("crm-fotos").createSignedUrl(f.url, 3600);
      return data?.signedUrl ? { ...f, url: data.signedUrl } : null;
    })
  );
  return { ok: true, data: { ...r.data, portafolio: portafolio.filter((x): x is NonNullable<typeof x> => x !== null) } };
}

export interface ResenaProfesional {
  id: string;
  calificacion: number;
  comentario: string | null;
  respuesta_negocio: string | null;
  created_at: string;
  /** «Camilo P.» / «Cliente anónimo». */
  cliente_nombre: string;
  /** «Corte + Barba». */
  servicios: string | null;
}

export function listarResenasProfesional(negocioId: string, staffId: string, opts: { limite?: number; offset?: number } = {}): Promise<Resultado<ResenaProfesional[]>> {
  return llamarRpc<ResenaProfesional[]>("staff_resenas_publicas", {
    p_negocio_id: negocioId,
    p_staff_id: staffId,
    p_limite: opts.limite ?? 10,
    p_offset: opts.offset ?? 0,
  });
}

export interface FiltrosMarketplace {
  texto?: string;
  ciudad?: string;
  /** Slug de categoría (p. ej. «BARBERIA»). */
  categoria?: string;
  orden?: "RELEVANCIA" | "CALIFICACION" | "PRECIO" | "RECIENTE";
  lat?: number;
  lng?: number;
  /** Distancia máxima en km (requiere lat/lng). null/undefined = sin límite. */
  radioKm?: number;
  /** Calificación mínima (3, 4, 4.5…). */
  califMin?: number;
  /** «Abierto ahora»: tiene disponibilidad real hoy. */
  abiertoHoy?: boolean;
  limite?: number;
  offset?: number;
}

export interface NegocioMarketplace {
  id: string;
  nombre: string;
  slug: string;
  ciudad: string | null;
  categoria: string[];
  descripcion: string | null;
  logo_url: string | null;
  calificacion: number;
  total_resenas: number;
  precio_desde: number | null;
  sede_id: string | null;
  proxima_disponibilidad: string | null;
  patrocinado: boolean;
  campana_id: string | null;
  sede_latitud: number | null;
  sede_longitud: number | null;
  distancia_km: number | null;
  /** Total que cumple los filtros (para «APLICAR · N»). */
  total_count: number;
}

/** Envoltorio de marketplace_buscar con filtros de distancia, calificación mínima y abierto hoy. */
export function buscarNegociosFiltrado(f: FiltrosMarketplace = {}): Promise<Resultado<NegocioMarketplace[]>> {
  return llamarRpc<NegocioMarketplace[]>("marketplace_buscar_filtrado", {
    ...(f.texto ? { p_texto: f.texto } : {}),
    ...(f.ciudad ? { p_ciudad: f.ciudad } : {}),
    ...(f.categoria ? { p_categoria: f.categoria } : {}),
    p_orden: f.orden ?? "RELEVANCIA",
    p_limite: f.limite ?? 20,
    p_offset: f.offset ?? 0,
    ...(f.lat != null && f.lng != null ? { p_lat: f.lat, p_lng: f.lng } : {}),
    ...(f.radioKm != null ? { p_radio_km: f.radioKm } : {}),
    ...(f.califMin != null ? { p_calif_min: f.califMin } : {}),
    p_abierto_hoy: f.abiertoHoy ?? false,
  });
}

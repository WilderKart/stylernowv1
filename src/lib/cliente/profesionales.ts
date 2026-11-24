import { patronSinTildes } from "@/lib/busqueda/sin-tildes";
﻿import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { unstable_cache } from "next/cache";
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
  /** Solo fotos que el cliente decidió compartir en My Look. `url` puede ser pública o firmada. */
  portafolio: { foto_id: string; url: string; momento: "ANTES" | "DESPUES" | null }[];
}

const PORTAFOLIO_MAX_ITEMS = 24;
const PORTAFOLIO_SIGNED_TTL_S = 3600;
const PORTAFOLIO_CACHE_S = 3000;

type PortafolioItem = PerfilProfesional["portafolio"][number];

async function resolverPortafolio(items: PortafolioItem[]): Promise<PortafolioItem[]> {
  const limitados = items.slice(0, PORTAFOLIO_MAX_ITEMS);
  const directos: PortafolioItem[] = [];
  const pendientes: { ruta: string; item: PortafolioItem }[] = [];

  for (const item of limitados) {
    if (/^https?:\/\//.test(item.url)) directos.push(item);
    else pendientes.push({ ruta: item.url, item });
  }
  if (pendientes.length === 0) return directos;

  const bucket = createAdminClient().storage.from("crm-fotos");
  const { data: firmadas, error } = await bucket.createSignedUrls(
    pendientes.map((p) => p.ruta),
    PORTAFOLIO_SIGNED_TTL_S
  );

  const resueltos = [...directos];
  if (!error && firmadas && firmadas.length === pendientes.length) {
    for (let i = 0; i < pendientes.length; i++) {
      const signed = firmadas[i];
      const original = pendientes[i].item;
      if (signed?.signedUrl) {
        resueltos.push({ ...original, url: signed.signedUrl });
      } else {
        const { data: pub } = bucket.getPublicUrl(pendientes[i].ruta);
        if (pub?.publicUrl) resueltos.push({ ...original, url: pub.publicUrl });
      }
    }
    return resueltos;
  }

  for (const p of pendientes) {
    const { data: pub } = bucket.getPublicUrl(p.ruta);
    if (pub?.publicUrl) resueltos.push({ ...p.item, url: pub.publicUrl });
  }
  return resueltos;
}

const obtenerPerfilProfesionalCached = unstable_cache(
  async (negocioId: string, staffId: string): Promise<Resultado<PerfilProfesional | null>> => {
    const r = await llamarRpc<PerfilProfesional | null>("staff_perfil_publico", { p_negocio_id: negocioId, p_staff_id: staffId });
    if (!r.ok || !r.data) return r;
    const portafolio = await resolverPortafolio(r.data.portafolio ?? []);
    return { ok: true, data: { ...r.data, portafolio } };
  },
  ["perfil-profesional-publico"],
  { revalidate: PORTAFOLIO_CACHE_S, tags: ["perfil-profesional-publico"] }
);

/** null si el profesional no existe / no está activo en ese negocio. */
export async function obtenerPerfilProfesional(negocioId: string, staffId: string): Promise<Resultado<PerfilProfesional | null>> {
  return obtenerPerfilProfesionalCached(negocioId, staffId);
}

export interface ResenaProfesional {
  id: string;
  calificacion: number;
  comentario: string | null;
  respuesta_negocio: string | null;
  created_at: string;
  /** “Camilo P.” / “Cliente anónimo”. */
  cliente_nombre: string;
  /** “Corte + Barba”. */
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
  /** Slug de categoría (p. ej. “BARBERIA”). */
  categoria?: string;
  orden?: "RELEVANCIA" | "CALIFICACION" | "PRECIO" | "RECIENTE";
  lat?: number;
  lng?: number;
  /** Distancia máxima en km (requiere lat/lng). null/undefined = sin límite. */
  radioKm?: number;
  /** Calificación mínima (3, 4, 4.5…). */
  califMin?: number;
  /** “Abierto ahora”: tiene disponibilidad real hoy. */
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
  /** Total que cumple los filtros (para “APLICAR · N”). */
  total_count: number;
}

/** Envoltorio de marketplace_buscar con filtros de distancia, calificación mínima y abierto hoy. */
const buscarNegociosFiltradoCached = unstable_cache(
  async (f: FiltrosMarketplace): Promise<Resultado<NegocioMarketplace[]>> =>
    llamarRpc<NegocioMarketplace[]>("marketplace_buscar_filtrado", {
      ...(f.texto && patronSinTildes(f.texto) ? { p_texto: patronSinTildes(f.texto) } : {}),
      ...(f.ciudad ? { p_ciudad: f.ciudad } : {}),
      ...(f.categoria ? { p_categoria: f.categoria } : {}),
      p_orden: f.orden ?? "RELEVANCIA",
      p_limite: f.limite ?? 20,
      p_offset: f.offset ?? 0,
      ...(f.lat != null && f.lng != null ? { p_lat: f.lat, p_lng: f.lng } : {}),
      ...(f.radioKm != null ? { p_radio_km: f.radioKm } : {}),
      ...(f.califMin != null ? { p_calif_min: f.califMin } : {}),
      p_abierto_hoy: f.abiertoHoy ?? false,
    }),
  ["marketplace-buscar-filtrado"],
  { revalidate: 60, tags: ["marketplace-buscar"] }
);

export function buscarNegociosFiltrado(f: FiltrosMarketplace = {}): Promise<Resultado<NegocioMarketplace[]>> {
  // Cache solo para lecturas públicas anónimas/repetibles sin filtros personalizados de usuario.
  return buscarNegociosFiltradoCached({
    ...f,
    limite: Math.min(Math.max(f.limite ?? 20, 1), 100),
    offset: Math.max(f.offset ?? 0, 0),
  });
}

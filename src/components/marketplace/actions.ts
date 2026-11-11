"use server";

import { buscarNegociosFiltrado } from "@/lib/cliente/profesionales";

const CATEGORIAS = /^[a-z_]{2,30}$/;

/** Cuántos negocios cumplen los filtros de la hoja («APLICAR · N»). Valida todo en servidor. */
export async function contarResultadosAction(f: {
  categoria?: string;
  lat?: number;
  lng?: number;
  radioKm?: number;
  califMin?: number;
  abiertoHoy?: boolean;
}): Promise<number | null> {
  const num = (v: unknown, min: number, max: number) =>
    typeof v === "number" && Number.isFinite(v) && v >= min && v <= max ? v : undefined;
  const lat = num(f.lat, -90, 90);
  const lng = num(f.lng, -180, 180);
  const conCoords = lat !== undefined && lng !== undefined;
  const r = await buscarNegociosFiltrado({
    categoria: f.categoria && CATEGORIAS.test(f.categoria) ? f.categoria : undefined,
    orden: "RELEVANCIA",
    lat: conCoords ? lat : undefined,
    lng: conCoords ? lng : undefined,
    radioKm: conCoords ? num(f.radioKm, 0.1, 100) : undefined,
    califMin: num(f.califMin, 0, 5),
    abiertoHoy: f.abiertoHoy === true,
    limite: 1,
  });
  if (!r.ok) return null;
  return r.data[0]?.total_count ?? 0;
}

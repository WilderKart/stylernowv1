"use server";

import { createClient } from "@/lib/supabase/server";

/**
 * Geocodificación inversa (coordenadas → dirección y ciudad) para "Usar mi ubicación" del formulario de sede.
 * Usa Nominatim de OpenStreetMap (gratis; política: User-Agent identificable y uso moderado: una consulta por
 * clic). Se hace en el servidor para no abrir el CSP del navegador y para no exponerlo como proxy anónimo:
 * exige sesión. Solo se envían las coordenadas, nunca datos del usuario.
 */
export type DireccionSugerida = { ok: true; direccion: string; ciudad: string } | { ok: false; error: string };

export async function direccionDesdeCoordenadas(lat: number, lng: number): Promise<DireccionSugerida> {
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
    return { ok: false, error: "Coordenadas inválidas." };
  }
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Inicia sesión de nuevo." };

  const url = new URL("https://nominatim.openstreetmap.org/reverse");
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("lat", lat.toFixed(6));
  url.searchParams.set("lon", lng.toFixed(6));
  url.searchParams.set("zoom", "18");
  url.searchParams.set("addressdetails", "1");
  url.searchParams.set("accept-language", "es");

  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "StylerNow/1.0 (https://app.stylernow.com)" },
      signal: AbortSignal.timeout(6000),
      cache: "no-store",
    });
    if (!res.ok) return { ok: false, error: "No pudimos obtener la dirección. Escríbela a mano." };
    const r = (await res.json()) as { address?: Record<string, string> };
    const a = r.address ?? {};
    const via = a.road ?? a.pedestrian ?? a.residential ?? "";
    const numero = a.house_number ? ` # ${a.house_number}` : "";
    const barrio = a.neighbourhood ?? a.suburb ?? "";
    const direccion = [via + numero, barrio].filter(Boolean).join(", ").slice(0, 200);
    const ciudad = (a.city ?? a.town ?? a.village ?? a.municipality ?? a.county ?? "").slice(0, 100);
    if (!direccion && !ciudad) return { ok: false, error: "No encontramos una dirección para esa ubicación. Escríbela a mano." };
    return { ok: true, direccion, ciudad };
  } catch {
    return { ok: false, error: "No pudimos obtener la dirección. Escríbela a mano." };
  }
}

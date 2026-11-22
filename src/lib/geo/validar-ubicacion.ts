"use server";

import { direccionDesdeCoordenadas } from "@/lib/geo/direccion-desde-coordenadas";
import { ciudadesCoinciden, dentroDelPais } from "@/lib/geo/coherencia";
import { createClient } from "@/lib/supabase/server";

export type ResultadoUbicacion =
  | { ok: true; coherente: true; ciudadDetectada: string | null }
  /** El punto está en el país pero la ciudad detectada no coincide con la declarada: el usuario debe confirmar o mover el marcador. */
  | { ok: true; coherente: false; ciudadDetectada: string }
  | { ok: false; error: string };

/**
 * Valida en el servidor que unas coordenadas sean coherentes con el negocio (país y ciudad declarados).
 * Cero confianza: el país sale de la base de datos para el negocio del usuario, no del navegador.
 */
export async function validarUbicacion(datos: {
  negocioId: string;
  ciudad: string;
  lat: number;
  lng: number;
}): Promise<ResultadoUbicacion> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Inicia sesión de nuevo." };

  const { data: negocio } = await supabase
    .from("negocio")
    .select("pais_codigo")
    .eq("id", datos.negocioId)
    .eq("owner_user_id", user.id)
    .maybeSingle();
  if (!negocio) return { ok: false, error: "No tienes permiso sobre este negocio." };

  if (!dentroDelPais(negocio.pais_codigo, datos.lat, datos.lng)) {
    return { ok: false, error: "Ese punto no está en el país de tu negocio. Muévelo hasta tu establecimiento." };
  }

  const r = await direccionDesdeCoordenadas(datos.lat, datos.lng);
  // Si el servicio de mapas no responde, no se bloquea a nadie: el punto ya pasó la validación de país.
  if (!r.ok || !r.ciudad) return { ok: true, coherente: true, ciudadDetectada: null };
  if (ciudadesCoinciden(datos.ciudad, r.ciudad)) return { ok: true, coherente: true, ciudadDetectada: r.ciudad };
  return { ok: true, coherente: false, ciudadDetectada: r.ciudad };
}

export type ResultadoBusqueda = { ok: true; lat: number; lng: number } | { ok: false; error: string };

/**
 * Dirección escrita → punto en el mapa (Nominatim). Restringida al país del negocio y a la sesión del dueño,
 * para no servir de proxy anónimo. Solo se envía el texto de la dirección, nunca datos personales.
 */
export async function ubicarDireccion(datos: { negocioId: string; direccion: string; ciudad: string }): Promise<ResultadoBusqueda> {
  const texto = `${datos.direccion} ${datos.ciudad}`.trim().slice(0, 200);
  if (texto.length < 6) return { ok: false, error: "Escribe la dirección y la ciudad para ubicarla." };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Inicia sesión de nuevo." };
  const { data: negocio } = await supabase
    .from("negocio")
    .select("pais_codigo")
    .eq("id", datos.negocioId)
    .eq("owner_user_id", user.id)
    .maybeSingle();
  if (!negocio) return { ok: false, error: "No tienes permiso sobre este negocio." };

  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("q", texto);
  url.searchParams.set("countrycodes", negocio.pais_codigo.toLowerCase());
  url.searchParams.set("limit", "1");
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "StylerNow/1.0 (https://app.stylernow.com)" },
      signal: AbortSignal.timeout(6000),
      cache: "no-store",
    });
    if (!res.ok) return { ok: false, error: "No pudimos ubicar esa dirección. Coloca el marcador a mano." };
    const r = (await res.json()) as { lat?: string; lon?: string }[];
    const lat = Number(r[0]?.lat);
    const lng = Number(r[0]?.lon);
    if (!r[0] || !Number.isFinite(lat) || !Number.isFinite(lng) || !dentroDelPais(negocio.pais_codigo, lat, lng)) {
      return { ok: false, error: "No encontramos esa dirección. Coloca el marcador a mano en el mapa." };
    }
    return { ok: true, lat, lng };
  } catch {
    return { ok: false, error: "No pudimos ubicar esa dirección. Coloca el marcador a mano." };
  }
}

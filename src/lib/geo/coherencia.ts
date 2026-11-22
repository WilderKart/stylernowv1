/**
 * Coherencia de una ubicación declarada (sin red, testeable): el punto debe caer dentro del país del negocio y,
 * cuando la geocodificación inversa devuelve una ciudad, esa ciudad debe corresponder a la declarada.
 * No reemplaza la verificación documental del negocio: solo evita coordenadas absurdas (océano, otro país, ceros).
 */

/** Cajas aproximadas por país (lat mín, lat máx, lng mín, lng máx). Solo los países activos de StylerNow. */
const CAJAS: Record<string, readonly [number, number, number, number]> = {
  CO: [-4.3, 13.5, -79.1, -66.8],
  MX: [14.4, 32.8, -118.5, -86.5],
  US: [18.8, 71.5, -179.3, -66.9],
  ES: [27.5, 43.9, -18.3, 4.4],
};

export function dentroDelPais(pais: string, lat: number, lng: number): boolean {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return false;
  if (lat === 0 && lng === 0) return false; // "isla nula": valor por defecto, nunca un negocio real
  const caja = CAJAS[pais.toUpperCase()];
  if (!caja) return true; // país sin caja definida: solo rango global
  return lat >= caja[0] && lat <= caja[1] && lng >= caja[2] && lng <= caja[3];
}

function normalizar(t: string): string {
  return t
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** «Cali» ~ «Santiago de Cali»; «Bogotá» ~ «Bogotá, D.C.». Contención en cualquiera de los dos sentidos. */
export function ciudadesCoinciden(declarada: string, detectada: string): boolean {
  const a = normalizar(declarada);
  const b = normalizar(detectada);
  if (!a || !b) return false;
  return a === b || a.includes(b) || b.includes(a);
}

/**
 * Festivos oficiales de Colombia, calculados por regla (no una lista fija): sirven para cualquier año.
 *
 * - Fijos: 1 ene, 1 may, 20 jul, 7 ago, 8 dic, 25 dic.
 * - Ley Emiliani (Ley 51 de 1983): se trasladan al lunes siguiente (si ya es lunes, se quedan) → 6 ene, 19 mar, 29 jun, 15 ago, 12 oct,
 *   1 nov, 11 nov.
 * - Semana Santa (jueves y viernes santos, fijos respecto a la Pascua) y tres que dependen de la Pascua y se trasladan al lunes:
 *   Ascensión (Pascua + 43 días = lunes), Corpus Christi (+ 64) y Sagrado Corazón (+ 71).
 *
 * Todo se calcula con fechas "YYYY-MM-DD" en UTC puro: nunca pasa por la zona horaria del equipo, así el día no se corre.
 */

const pad = (n: number) => String(n).padStart(2, "0");
const iso = (a: number, m: number, d: number) => `${a}-${pad(m)}-${pad(d)}`;

function sumar(fecha: string, dias: number) {
  const [a, m, d] = fecha.split("-").map(Number);
  const base = new Date(Date.UTC(a, m - 1, d));
  base.setUTCDate(base.getUTCDate() + dias);
  return base.toISOString().slice(0, 10);
}

/** Domingo de Pascua (algoritmo de Meeus/Jones/Butcher, calendario gregoriano). */
export function domingoDePascua(anio: number): string {
  const a = anio % 19;
  const b = Math.floor(anio / 100);
  const c = anio % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mes = Math.floor((h + l - 7 * m + 114) / 31);
  const dia = ((h + l - 7 * m + 114) % 31) + 1;
  return iso(anio, mes, dia);
}

/** Traslado al lunes siguiente (si ya es lunes, no se mueve). */
function aLunes(fecha: string) {
  const [a, m, d] = fecha.split("-").map(Number);
  const dow = new Date(Date.UTC(a, m - 1, d)).getUTCDay(); // 0 = domingo
  return sumar(fecha, (8 - dow) % 7);
}

const porAnio = new Map<number, Map<string, string>>();

/** Mapa fecha → nombre del festivo, para un año. */
export function festivosColombia(anio: number): Map<string, string> {
  const guardado = porAnio.get(anio);
  if (guardado) return guardado;
  const f = new Map<string, string>();
  const fijo = (m: number, d: number, nombre: string) => f.set(iso(anio, m, d), nombre);
  const emiliani = (m: number, d: number, nombre: string) => f.set(aLunes(iso(anio, m, d)), nombre);

  fijo(1, 1, "Año Nuevo");
  fijo(5, 1, "Día del Trabajo");
  fijo(7, 20, "Día de la Independencia");
  fijo(8, 7, "Batalla de Boyacá");
  fijo(12, 8, "Inmaculada Concepción");
  fijo(12, 25, "Navidad");

  emiliani(1, 6, "Día de los Reyes Magos");
  emiliani(3, 19, "Día de San José");
  emiliani(6, 29, "San Pedro y San Pablo");
  emiliani(8, 15, "Asunción de la Virgen");
  emiliani(10, 12, "Día de la Raza");
  emiliani(11, 1, "Todos los Santos");
  emiliani(11, 11, "Independencia de Cartagena");

  const pascua = domingoDePascua(anio);
  f.set(sumar(pascua, -3), "Jueves Santo");
  f.set(sumar(pascua, -2), "Viernes Santo");
  f.set(sumar(pascua, 43), "Ascensión del Señor");
  f.set(sumar(pascua, 64), "Corpus Christi");
  f.set(sumar(pascua, 71), "Sagrado Corazón de Jesús");

  porAnio.set(anio, f);
  return f;
}

/** Nombre del festivo nacional de esa fecha ("YYYY-MM-DD") o null si no es festivo. */
export function festivoDe(fecha: string): string | null {
  return festivosColombia(Number(fecha.slice(0, 4))).get(fecha) ?? null;
}

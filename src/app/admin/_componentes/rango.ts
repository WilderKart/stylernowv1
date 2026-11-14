/** Rango de fechas del Super Admin, siempre en hora de Colombia (UTC−5, sin horario de verano). */

export type Rango = { desde: Date; hasta: Date; clave: string; etiqueta: string; desdeTexto: string; hastaTexto: string };

export const PRESETS = [
  { clave: "7d", etiqueta: "7 días" },
  { clave: "14d", etiqueta: "14 días" },
  { clave: "30d", etiqueta: "30 días" },
  { clave: "90d", etiqueta: "90 días" },
  { clave: "mes", etiqueta: "Este mes" },
  { clave: "mes-anterior", etiqueta: "Mes anterior" },
] as const;

const diaBogota = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Bogota" }).format(d); // AAAA-MM-DD
const inicioDia = (yyyyMmDd: string) => new Date(`${yyyyMmDd}T00:00:00-05:00`);
const sumarDias = (yyyyMmDd: string, n: number) => diaBogota(new Date(inicioDia(yyyyMmDd).getTime() + n * 86_400_000 + 12 * 3_600_000));
const valida = (s: unknown): s is string => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(inicioDia(s).getTime());
const corto = (yyyyMmDd: string) =>
  new Intl.DateTimeFormat("es-CO", { day: "2-digit", month: "short", year: "numeric", timeZone: "America/Bogota" }).format(
    new Date(`${yyyyMmDd}T12:00:00-05:00`),
  );

export function leerRango(sp: Record<string, string | string[] | undefined>, porDefecto = "14d"): Rango {
  const hoy = diaBogota(new Date());
  const clave = typeof sp.rango === "string" ? sp.rango : porDefecto;

  let d: string;
  let h: string; // día final inclusive
  if (clave === "personalizado" && valida(sp.desde) && valida(sp.hasta) && sp.desde <= sp.hasta) {
    d = sp.desde;
    h = sp.hasta > hoy ? hoy : sp.hasta;
    if (inicioDia(h).getTime() - inicioDia(d).getTime() > 400 * 86_400_000) d = sumarDias(h, -400);
  } else if (clave === "mes") {
    d = `${hoy.slice(0, 8)}01`;
    h = hoy;
  } else if (clave === "mes-anterior") {
    const primeroEste = `${hoy.slice(0, 8)}01`;
    h = sumarDias(primeroEste, -1);
    d = `${h.slice(0, 8)}01`;
  } else {
    const n = { "7d": 7, "14d": 14, "30d": 30, "90d": 90 }[clave] ?? 14;
    d = sumarDias(hoy, -(n - 1));
    h = hoy;
  }
  const claveFinal = clave === "personalizado" && valida(sp.desde) ? "personalizado" : (PRESETS.find((p) => p.clave === clave)?.clave ?? porDefecto);
  return {
    desde: inicioDia(d),
    hasta: inicioDia(sumarDias(h, 1)),
    clave: claveFinal,
    etiqueta: `${corto(d)} – ${corto(h)}`,
    desdeTexto: d,
    hastaTexto: h,
  };
}

/**
 * Horario de HOY de una Sede a partir de `sede.horario_base` (jsonb) y su zona horaria.
 * Formato real: { lun: [["09:00","20:00"]], mar: [...] } con claves dom/lun/mar/mie/jue/vie/sab.
 * `{}` = sin restricción cargada (no se muestra nada); clave ausente con horario cargado = cerrada ese día.
 */
const CLAVES = ["dom", "lun", "mar", "mie", "jue", "vie", "sab"];
const DIA_EN: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

export interface HorarioHoy {
  /** "Hoy 9–20 h" o "Cerrado hoy". */
  etiqueta: string;
  /** true/false si el horario permite saberlo; siempre definido cuando hay datos. */
  abiertoAhora: boolean;
}

function aMinutos(texto: unknown): number | null {
  if (typeof texto !== "string") return null;
  const m = /^(\d{1,2}):(\d{2})/.exec(texto);
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}

function formatoHora(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m === 0 ? String(h) : `${h}:${String(m).padStart(2, "0")}`;
}

export function horarioDeHoy(horarioBase: unknown, tz: string, ahora: Date = new Date()): HorarioHoy | null {
  if (!horarioBase || typeof horarioBase !== "object" || Array.isArray(horarioBase)) return null;
  const mapa = horarioBase as Record<string, unknown>;
  if (Object.keys(mapa).length === 0) return null;

  let diaIdx: number;
  let minutosAhora: number;
  try {
    const partes = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      weekday: "short",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).formatToParts(ahora);
    const get = (t: string) => partes.find((p) => p.type === t)?.value ?? "";
    diaIdx = DIA_EN[get("weekday")] ?? -1;
    minutosAhora = (Number(get("hour")) % 24) * 60 + Number(get("minute"));
  } catch {
    return null;
  }
  if (diaIdx < 0) return null;

  const rangosRaw = mapa[CLAVES[diaIdx]];
  const rangos: [number, number][] = [];
  if (Array.isArray(rangosRaw)) {
    for (const r of rangosRaw) {
      if (!Array.isArray(r)) continue;
      const ini = aMinutos(r[0]);
      const fin = aMinutos(r[1]);
      if (ini !== null && fin !== null && fin > ini) rangos.push([ini, fin]);
    }
  }
  if (rangos.length === 0) return { etiqueta: "Cerrado hoy", abiertoAhora: false };

  const etiqueta = `Hoy ${rangos.map(([i, f]) => `${formatoHora(i)}–${formatoHora(f)}`).join(" · ")} h`;
  const abiertoAhora = rangos.some(([i, f]) => minutosAhora >= i && minutosAhora < f);
  return { etiqueta, abiertoAhora };
}

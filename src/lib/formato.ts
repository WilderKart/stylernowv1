/** Formateo de fechas y horas en la zona horaria de la Sede, no la del navegador. */

export const TZ_POR_DEFECTO = "America/Bogota";

/** "YYYY-MM-DD" de un instante, leído en la zona de la Sede. */
export function fechaISO(instante: Date | string, tz = TZ_POR_DEFECTO) {
  const d = typeof instante === "string" ? new Date(instante) : instante;
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

/** Hoy en la zona de la Sede, como "YYYY-MM-DD". */
export function hoyISO(tz = TZ_POR_DEFECTO) {
  return fechaISO(new Date(), tz);
}

/** Suma días a una fecha "YYYY-MM-DD" sin pasar por Date local (evita saltos de DST). */
export function sumarDias(fechaIso: string, dias: number) {
  const [a, m, d] = fechaIso.split("-").map(Number);
  const base = new Date(Date.UTC(a, m - 1, d));
  base.setUTCDate(base.getUTCDate() + dias);
  return base.toISOString().slice(0, 10);
}

/** "15:30" */
export function hora(instante: string, tz = TZ_POR_DEFECTO) {
  return new Intl.DateTimeFormat("es-CO", {
    timeZone: tz,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(instante));
}

/** "vie 12 sep" */
export function fechaCorta(fechaIso: string, tz = TZ_POR_DEFECTO) {
  const [a, m, d] = fechaIso.split("-").map(Number);
  return new Intl.DateTimeFormat("es-CO", {
    timeZone: tz,
    weekday: "short",
    day: "numeric",
    month: "short",
  }).format(new Date(Date.UTC(a, m - 1, d, 12)));
}

/** "viernes 12 de septiembre, 15:30" */
export function fechaHoraLarga(instante: string, tz = TZ_POR_DEFECTO) {
  const d = new Date(instante);
  const fecha = new Intl.DateTimeFormat("es-CO", {
    timeZone: tz,
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(d);
  return `${fecha}, ${hora(instante, tz)}`;
}

/** "1 h 20 min" */
export function duracion(minutos: number) {
  const h = Math.floor(minutos / 60);
  const m = minutos % 60;
  if (h === 0) return `${m} min`;
  if (m === 0) return `${h} h`;
  return `${h} h ${m} min`;
}

/**
 * "Disponible en 20 min" / "Próximo turno 3:30 PM" (02-UX/04_Marketplace.md).
 * Devuelve null si no hay disponibilidad hoy, para que la tarjeta no muestre nada.
 */
export function proximaDisponibilidad(instante: string | null, tz = TZ_POR_DEFECTO) {
  if (!instante) return null;
  const minutos = Math.round((new Date(instante).getTime() - Date.now()) / 60000);
  if (minutos <= 0) return "Disponible ahora";
  if (minutos < 60) return `Disponible en ${minutos} min`;
  return `Próximo turno ${hora(instante, tz)}`;
}

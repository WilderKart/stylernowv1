/**
 * Terminología por tipo de negocio. El diseño de StylerNow es el mismo para todos; lo único que cambia según el
 * negocio es cómo se llama a quien presta el servicio (barbero, masajista, manicurista…). Solo afecta a textos
 * visibles: nunca decide permisos ni acceso a datos.
 *
 * Un negocio puede tener varias categorías: manda la PRIMERA (la que eligió como principal al registrarse).
 */
export interface Terminologia {
  /** «barbero», «masajista»… en minúscula, para frases. */
  profesional: string;
  /** «barberos», «masajistas»… */
  profesionales: string;
  /** «Barbero», «Masajista»… para títulos y etiquetas. */
  Profesional: string;
  /** «Barberos», «Masajistas»… */
  Profesionales: string;
}

function crear(singular: string, plural: string): Terminologia {
  const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
  return { profesional: singular, profesionales: plural, Profesional: cap(singular), Profesionales: cap(plural) };
}

const POR_CATEGORIA: Record<string, Terminologia> = {
  barberia: crear("barbero", "barberos"),
  tatuajes: crear("tatuador", "tatuadores"),
  spa: crear("masajista", "masajistas"),
  masajes: crear("masajista", "masajistas"),
  salon: crear("estilista", "estilistas"),
  estilismo: crear("estilista", "estilistas"),
  manicura: crear("manicurista", "manicuristas"),
  lashista: crear("lashista", "lashistas"),
};

export const TERMINOLOGIA_GENERICA: Terminologia = crear("profesional", "profesionales");

export function terminologiaDe(categorias: readonly string[] | null | undefined): Terminologia {
  const principal = categorias?.[0]?.trim().toLowerCase();
  return (principal && POR_CATEGORIA[principal]) || TERMINOLOGIA_GENERICA;
}

/** Cambia «barbero(s)» por el término del negocio en un texto fijo, respetando mayúsculas iniciales. */
export function aplicarTerminologia(texto: string, tm: Terminologia): string {
  return texto
    .replace(/barberos/g, tm.profesionales)
    .replace(/Barberos/g, tm.Profesionales)
    .replace(/BARBEROS/g, tm.Profesionales.toUpperCase())
    .replace(/barbero/g, tm.profesional)
    .replace(/Barbero/g, tm.Profesional)
    .replace(/BARBERO/g, tm.Profesional.toUpperCase());
}

/** Aplica la terminología a todos los textos de un objeto de etiquetas (también a las funciones que devuelven texto). */
export function traducirTextos<T>(valor: T, tm: Terminologia): T {
  if (typeof valor === "string") return aplicarTerminologia(valor, tm) as T;
  if (typeof valor === "function") {
    const f = valor as unknown as (...a: unknown[]) => unknown;
    return ((...a: unknown[]) => {
      const r = f(...a);
      return typeof r === "string" ? aplicarTerminologia(r, tm) : r;
    }) as unknown as T;
  }
  if (valor && typeof valor === "object" && !Array.isArray(valor)) {
    return Object.fromEntries(Object.entries(valor as Record<string, unknown>).map(([k, v]) => [k, traducirTextos(v, tm)])) as T;
  }
  return valor;
}

/** En pantallas donde «profesional» siempre significa quien presta el servicio (reserva), usa el término del negocio. */
export function sustituirProfesional(texto: string, tm: Terminologia): string {
  if (tm.profesional === "profesional") return texto;
  return texto
    .replace(/profesionales/g, tm.profesionales)
    .replace(/Profesionales/g, tm.Profesionales)
    .replace(/profesional/g, tm.profesional)
    .replace(/Profesional/g, tm.Profesional);
}

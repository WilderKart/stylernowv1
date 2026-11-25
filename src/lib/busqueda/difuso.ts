/**
 * Búsqueda tolerante: sin tildes ni mayúsculas, por prefijo y con errores de tecleo (distancia de edición).
 * Pura y sin dependencias: se usa en el buscador del panel, que filtra siempre sobre datos ya autorizados del negocio.
 */

export function normalizar(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s@.+]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Distancia de Levenshtein con tope: devuelve tope+1 en cuanto se sabe que lo supera. */
export function distancia(a: string, b: string, tope = 2): number {
  if (Math.abs(a.length - b.length) > tope) return tope + 1;
  let previa = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const actual = [i];
    let minimo = i;
    for (let j = 1; j <= b.length; j++) {
      const costo = a[i - 1] === b[j - 1] ? 0 : 1;
      const v = Math.min(previa[j] + 1, actual[j - 1] + 1, previa[j - 1] + costo);
      actual.push(v);
      if (v < minimo) minimo = v;
    }
    if (minimo > tope) return tope + 1;
    previa = actual;
  }
  return previa[b.length];
}

const tolerancia = (largo: number) => (largo <= 3 ? 0 : largo <= 6 ? 1 : 2);

export interface Coincidencia {
  puntaje: number;
  /** true si alguna palabra solo coincidió por parecido (error de tecleo), no por contener el texto. */
  aproximada: boolean;
}

/**
 * Puntúa un candidato contra la consulta. Todas las palabras de la consulta deben encontrarse (AND).
 * Devuelve null si no coincide. Mayor puntaje = mejor.
 */
export function puntuar(consulta: string, textos: readonly (string | null | undefined)[]): Coincidencia | null {
  const tokens = normalizar(consulta).split(" ").filter(Boolean);
  if (tokens.length === 0) return null;
  const palabras = normalizar(textos.filter(Boolean).join(" ")).split(" ").filter(Boolean);
  if (palabras.length === 0) return null;
  const completo = palabras.join(" ");

  let puntaje = 0;
  let aproximada = false;
  for (const t of tokens) {
    let mejor = 0;
    let exacto = false;
    for (const p of palabras) {
      if (p === t) {
        mejor = Math.max(mejor, 4);
        exacto = true;
      } else if (p.startsWith(t)) mejor = Math.max(mejor, 3);
      else if (t.length >= 3 && p.includes(t)) mejor = Math.max(mejor, 2);
      else if (t.length >= 3) {
        const tol = tolerancia(t.length);
        if (tol > 0 && (distancia(t, p, tol) <= tol || distancia(t, p.slice(0, t.length), tol) <= tol)) mejor = Math.max(mejor, 1);
      }
    }
    if (mejor === 0 && /^[0-9+]+$/.test(t) && completo.replace(/\s/g, "").includes(t)) mejor = 2;
    if (mejor === 0) return null;
    if (mejor === 1 && !exacto) aproximada = true;
    puntaje += mejor;
  }
  return { puntaje: puntaje / tokens.length, aproximada };
}

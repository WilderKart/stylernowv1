/**
 * Patrón de búsqueda que no distingue tildes (ni mayúsculas, porque se usa con ILIKE).
 *
 * Cada vocal (con o sin tilde) y la ñ se vuelven el comodín de un carácter de ILIKE (`_`), así «barberia» encuentra
 * «Barbería» y «barbería» encuentra «Barberia». Se quitan los caracteres que tienen significado especial en ILIKE
 * y en los filtros `.or()` de PostgREST. Vale para el texto que escribe una persona en cualquier barra de búsqueda.
 */
export function patronSinTildes(texto: string): string {
  return texto
    .trim()
    .replace(/[%_\,()*]/g, " ")
    .replace(/[aeiouáéíóúüñ]/gi, "_")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Tema visual por categoría de negocio. Barbería y tattoo (y cualquier categoría sin tema propio) conservan el diseño
 * original: devuelven null. Solo spa, salón de belleza y estudio de uñas tienen un tema suave.
 *
 * Un negocio puede tener varias categorías (p. ej. «barbería, manicura»). Manda la PRIMERA: es la que el propietario
 * eligió como principal al registrarse.
 */
export type Vertical = "spa" | "salon" | "unas";

const POR_CATEGORIA: Record<string, Vertical> = {
  spa: "spa",
  masajes: "spa",
  salon: "salon",
  estilismo: "salon",
  manicura: "unas",
  lashista: "unas",
};

export function verticalDeCategorias(categorias: readonly string[] | null | undefined): Vertical | null {
  const principal = categorias?.[0]?.trim().toLowerCase();
  return (principal && POR_CATEGORIA[principal]) || null;
}

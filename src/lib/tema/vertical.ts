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

/**
 * Qué se le pregunta al crear la cuenta: el tipo de negocio (si es un negocio) o el servicio que busca (si es cliente).
 * Los valores coinciden con las categorías de negocio del sistema (src/lib/categorias-negocio.ts).
 */
export const OPCIONES_SERVICIO_REGISTRO = [
  { valor: "barberia", clave: "home.cat_barberia" },
  { valor: "tatuajes", clave: "home.cat_tattoo" },
  { valor: "salon", clave: "home.cat_salon" },
  { valor: "spa", clave: "home.cat_spa" },
  { valor: "manicura", clave: "home.cat_unas" },
] as const;

export type CategoriaRegistro = (typeof OPCIONES_SERVICIO_REGISTRO)[number]["valor"];

export const esCategoriaRegistro = (v: unknown): v is CategoriaRegistro => OPCIONES_SERVICIO_REGISTRO.some((o) => o.valor === v);

/** Lleva cualquier categoría de negocio a una de las cinco opciones de aspecto (p. ej. estilismo → salon). */
export function categoriaDeAspecto(cat: string | null | undefined): CategoriaRegistro | null {
  const v = verticalDeCategorias(cat ? [cat] : null);
  if (v === "spa") return "spa";
  if (v === "salon") return "salon";
  if (v === "unas") return "manicura";
  const limpia = cat?.trim().toLowerCase();
  return esCategoriaRegistro(limpia) ? limpia : null;
}

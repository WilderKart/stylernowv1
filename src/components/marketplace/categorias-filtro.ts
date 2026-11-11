import { CATEGORIAS_NEGOCIO } from "@/lib/categorias-negocio";

/** Categorías visibles en los filtros (valores del registro único). */
const VISIBLES: Record<string, string> = {
  barberia: "Barbería",
  salon: "Salón",
  manicura: "Uñas",
  lashista: "Pestañas",
  tatuajes: "Tatuajes",
  spa: "Spa",
  masajes: "Masajes",
};
export const CATEGORIAS_FILTRO = CATEGORIAS_NEGOCIO.filter((c) => c.valor in VISIBLES).map((c) => ({
  valor: c.valor,
  etiqueta: VISIBLES[c.valor],
}));

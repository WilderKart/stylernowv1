import { CATEGORIAS_NEGOCIO } from "@/lib/categorias-negocio";
import type { Clave } from "@/lib/i18n/diccionario";

/** Categorías visibles en los filtros (valores del registro único). */
const VISIBLES: Record<string, Clave> = {
  barberia: "cat.barberia",
  salon: "cat.salon",
  manicura: "cat.manicura",
  lashista: "cat.lashista",
  tatuajes: "cat.tatuajes",
  spa: "cat.spa",
  masajes: "cat.masajes",
};
export const CATEGORIAS_FILTRO = CATEGORIAS_NEGOCIO.filter((c) => c.valor in VISIBLES).map((c) => ({
  valor: c.valor,
  etiqueta: VISIBLES[c.valor],
}));

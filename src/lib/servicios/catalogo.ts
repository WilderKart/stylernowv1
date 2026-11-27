import { CATALOGO_SERVICIOS, type ServicioCatalogo } from "./catalogo.generado";

export type { ServicioCatalogo };

export interface CategoriaCatalogo {
  id: string;
  etiqueta: string;
  /** Duración sugerida en minutos (el negocio la ajusta al agregarlo). */
  duracionSugerida: number;
  categoriaPuntaje: "ESTANDAR" | "PREMIUM" | "COMPLEMENTARIO";
}

/** Metadatos por carpeta de `public/servicios`. Una carpeta nueva sin entrada aquí igual aparece, con valores genéricos. */
const CONOCIDAS: Record<string, Omit<CategoriaCatalogo, "id">> = {
  cortes: { etiqueta: "Cortes", duracionSugerida: 30, categoriaPuntaje: "ESTANDAR" },
  barba: { etiqueta: "Barba", duracionSugerida: 20, categoriaPuntaje: "ESTANDAR" },
  facial: { etiqueta: "Cuidado facial", duracionSugerida: 40, categoriaPuntaje: "PREMIUM" },
  mascarilla: { etiqueta: "Mascarillas", duracionSugerida: 30, categoriaPuntaje: "COMPLEMENTARIO" },
  depilacion: { etiqueta: "Depilación", duracionSugerida: 20, categoriaPuntaje: "COMPLEMENTARIO" },
  manicure: { etiqueta: "Uñas", duracionSugerida: 45, categoriaPuntaje: "ESTANDAR" },
};

export const CATEGORIAS_CATALOGO: CategoriaCatalogo[] = [...new Set(CATALOGO_SERVICIOS.map((s) => s.categoria))].map((id) => ({
  id,
  ...(CONOCIDAS[id] ?? { etiqueta: id.charAt(0).toUpperCase() + id.slice(1), duracionSugerida: 30, categoriaPuntaje: "ESTANDAR" as const }),
}));

export function categoriaDe(id: string): CategoriaCatalogo {
  return CATEGORIAS_CATALOGO.find((c) => c.id === id) ?? { id, etiqueta: id, duracionSugerida: 30, categoriaPuntaje: "ESTANDAR" };
}

export { CATALOGO_SERVICIOS };

/** Sin tildes ni mayúsculas, para buscar «tazon» y encontrar «tazón». */
export function normalizar(t: string): string {
  return t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}

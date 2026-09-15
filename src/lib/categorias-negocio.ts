/**
 * Verticales soportadas desde el día uno (01-PRD/01_Product_Vision.md). Único
 * lugar donde vive esta lista — la usan el wizard de registro de Negocio
 * (categoría que ofrece) y el Perfil de Cliente (intereses, para sugerencias
 * de Marketplace y marketing segmentado), para no duplicarla entre los dos.
 */
export const CATEGORIAS_NEGOCIO = [
  { valor: "barberia", etiqueta: "Barbería" },
  { valor: "salon", etiqueta: "Salón de belleza" },
  { valor: "estilismo", etiqueta: "Estilismo" },
  { valor: "manicura", etiqueta: "Manicura/Pedicura" },
  { valor: "lashista", etiqueta: "Extensiones de pestañas" },
  { valor: "tatuajes", etiqueta: "Tatuajes" },
  { valor: "spa", etiqueta: "Spa" },
  { valor: "masajes", etiqueta: "Masajes" },
  { valor: "grooming", etiqueta: "Grooming masculino" },
] as const;

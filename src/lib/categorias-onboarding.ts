/**
 * Categorías que se ofrecen al registrar un negocio nuevo (diseño de onboarding, 2026-11-17).
 * Son un SUBCONJUNTO de `CATEGORIAS_NEGOCIO` (mismos valores): los negocios ya registrados con otras categorías
 * (estilismo, manicura, lashista, masajes) siguen siendo válidos y el marketplace los sigue filtrando.
 * Un negocio puede marcar varias.
 */
export const CATEGORIAS_ONBOARDING = [
  { valor: "barberia", etiqueta: "Barbería", icono: "Scissors" },
  { valor: "salon", etiqueta: "Salón de belleza", icono: "Sparkles" },
  { valor: "spa", etiqueta: "Spa", icono: "Flower2" },
  { valor: "tatuajes", etiqueta: "Tatuajes", icono: "PenTool" },
  { valor: "manicura", etiqueta: "Estudio de uñas", icono: "Hand" },
  { valor: "grooming", etiqueta: "Grooming Man", icono: "UserRound" },
] as const;

export type IconoCategoria = (typeof CATEGORIAS_ONBOARDING)[number]["icono"];

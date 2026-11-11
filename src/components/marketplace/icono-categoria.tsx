import { Eye, Flower2, Hand, HandHeart, PenTool, Scissors, Sparkles, Store } from "lucide-react";

/**
 * Icono y nombre del tipo de negocio, para que se reconozca de un vistazo en el mapa y en las tarjetas.
 * Las claves son las del registro único (src/lib/categorias-negocio.ts).
 */
const CATEGORIAS = {
  barberia: { Icono: Scissors, etiqueta: "Barbería" },
  grooming: { Icono: Scissors, etiqueta: "Grooming" },
  salon: { Icono: Sparkles, etiqueta: "Salón" },
  estilismo: { Icono: Sparkles, etiqueta: "Estilismo" },
  manicura: { Icono: Hand, etiqueta: "Uñas" },
  lashista: { Icono: Eye, etiqueta: "Pestañas" },
  tatuajes: { Icono: PenTool, etiqueta: "Tatuajes" },
  spa: { Icono: Flower2, etiqueta: "Spa" },
  masajes: { Icono: HandHeart, etiqueta: "Masajes" },
} as const;

type Clave = keyof typeof CATEGORIAS;

function datos(categoria: string[] | null | undefined) {
  const clave = (categoria ?? []).find((c): c is Clave => c in CATEGORIAS);
  return clave ? CATEGORIAS[clave] : { Icono: Store, etiqueta: "Negocio" };
}

export function etiquetaCategoria(categoria: string[] | null | undefined) {
  return datos(categoria).etiqueta;
}

export function IconoCategoria({ categoria, className }: { categoria: string[] | null | undefined; className?: string }) {
  const { Icono } = datos(categoria);
  return <Icono aria-hidden className={className ?? "size-4"} strokeWidth={2} />;
}

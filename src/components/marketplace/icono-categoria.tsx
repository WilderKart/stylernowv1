import type { Clave as ClaveTexto } from "@/lib/i18n/diccionario";
import { Eye, Flower2, Hand, HandHeart, PenTool, Scissors, Sparkles, Store } from "lucide-react";

/**
 * Icono y nombre del tipo de negocio, para que se reconozca de un vistazo en el mapa y en las tarjetas.
 * Las claves son las del registro único (src/lib/categorias-negocio.ts).
 */
const CATEGORIAS: Record<string, { Icono: typeof Store; etiqueta: ClaveTexto }> = {
  barberia: { Icono: Scissors, etiqueta: "cat.barberia" },
  grooming: { Icono: Scissors, etiqueta: "cat.grooming" },
  salon: { Icono: Sparkles, etiqueta: "cat.salon" },
  estilismo: { Icono: Sparkles, etiqueta: "cat.estilismo" },
  manicura: { Icono: Hand, etiqueta: "cat.manicura" },
  lashista: { Icono: Eye, etiqueta: "cat.lashista" },
  tatuajes: { Icono: PenTool, etiqueta: "cat.tatuajes" },
  spa: { Icono: Flower2, etiqueta: "cat.spa" },
  masajes: { Icono: HandHeart, etiqueta: "cat.masajes" },
};

type Clave = string;

function datos(categoria: string[] | null | undefined) {
  const clave = (categoria ?? []).find((c): c is Clave => c in CATEGORIAS);
  return clave ? CATEGORIAS[clave] : { Icono: Store, etiqueta: "cat.negocio" as ClaveTexto };
}

export function etiquetaCategoria(categoria: string[] | null | undefined) {
  return datos(categoria).etiqueta;
}

export function IconoCategoria({ categoria, className }: { categoria: string[] | null | undefined; className?: string }) {
  const { Icono } = datos(categoria);
  return <Icono aria-hidden className={className ?? "size-4"} strokeWidth={2} />;
}

import { cn } from "@/lib/utils";
import { Scissors } from "lucide-react";

/** Imagen de un servicio; si no tiene, un recuadro neutro de la marca (nunca una imagen rota ni un hueco). */
export function ImagenServicio({ url, nombre, className }: { url: string | null | undefined; nombre: string; className?: string }) {
  if (url) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={url} alt={nombre} loading="lazy" decoding="async" className={cn("shrink-0 border-2 border-border object-cover", className)} />;
  }
  return (
    <span aria-hidden className={cn("flex shrink-0 items-center justify-center border-2 border-border bg-surface-2 text-text-faint", className)}>
      <Scissors className="size-1/3" />
    </span>
  );
}

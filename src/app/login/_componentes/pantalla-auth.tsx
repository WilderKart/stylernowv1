import { Num, Poster } from "@/components/brutal";
import { cn } from "@/lib/utils";
import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import * as React from "react";

/**
 * Armazón de las pantallas de acceso (G05–G08 del prototipo): barra superior con
 * volver + índice editorial, título de póster con acento "hot", párrafo y contenido.
 * Fluido al 100% (centrado y acotado solo en pantallas anchas).
 */
export function PantallaAuth({
  indice,
  volver,
  onVolver,
  titulo,
  intro,
  tamano = 2,
  ancho = "max-w-lg",
  children,
}: {
  indice: string;
  volver?: string;
  onVolver?: () => void;
  titulo: React.ReactNode;
  intro?: React.ReactNode;
  tamano?: 1 | 2 | 3 | 4;
  ancho?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-dvh flex-col bg-bg">
      <main className={cn("mx-auto flex w-full flex-1 flex-col", ancho)}>
        <div className="sticky top-0 z-[3] flex min-h-[52px] items-center justify-between gap-2 border-b border-[var(--grid)] bg-bg py-1 pr-2 pl-1">
          {onVolver ? (
            <button type="button" onClick={onVolver} className="sn-iconbtn" aria-label="Volver">
              <ChevronLeft />
            </button>
          ) : (
            <Link href={volver ?? "/"} className="sn-iconbtn" aria-label="Volver">
              <ChevronLeft />
            </Link>
          )}
          <Num className="flex-1">{indice}</Num>
        </div>
        <Poster as="h1" size={tamano} className="px-4 pt-3 pb-4 break-words">
          {titulo}
        </Poster>
        {intro ? <p className="body mx-4 mb-4 text-text-muted break-words">{intro}</p> : null}
        <div className="flex flex-col px-4 pb-8">{children}</div>
      </main>
    </div>
  );
}

/** Texto acentuado del título (.sn-hot). */
export function Hot({ children }: { children: React.ReactNode }) {
  return <span className="sn-hot">{children}</span>;
}

/** Separador "o con tu email". */
export function Separador({ children }: { children: React.ReactNode }) {
  return (
    <div className="my-2 flex items-center gap-3">
      <span className="h-px flex-1 bg-[var(--grid)]" />
      <span className="sn-meta">{children}</span>
      <span className="h-px flex-1 bg-[var(--grid)]" />
    </div>
  );
}

/** Mensaje de error de formulario (bloque sólido, mismo patrón que sn-help--error). */
export function ErrorForm({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <p role="alert" className={cn("self-start bg-danger px-1.5 py-0.5 font-mono text-[11px] leading-[14px] tracking-[0.66px] text-ink uppercase", className)}>
      {children}
    </p>
  );
}

/** Enlace/acción de texto en mayúsculas mono (.sn-label ↗). */
export const claseEnlace = "sn-label inline-flex min-h-12 items-center text-left text-text underline-offset-4 hover:underline";

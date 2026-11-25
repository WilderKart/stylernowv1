"use client";

// Usa useT() (hook de cliente). Sin esta directiva, las páginas de servidor que lo importan
// (/legal/[slug], /legal/aceptar, /login/recuperar) fallaban en producción con
// "Attempted to call useT() from the server" (auditoría 2026-11-14, logs de Vercel).
import { AuthDividido } from "@/components/auth/auth-dividido";
import { Poster } from "@/components/brutal";
import { useT } from "@/lib/i18n/proveedor";
import { cn } from "@/lib/utils";
import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import * as React from "react";

/** Enlace «‹ Volver» azul de la parte superior de las pantallas de acceso (referencia de diseño). */
export function BarraVolverAuth({ href = "/", onVolver, texto }: { href?: string; onVolver?: () => void; texto?: string }) {
  const t = useT();
  const etiqueta = texto ?? (href === "/" ? t("err.volver_inicio") : t("comun.volver"));
  const clase = "inline-flex min-h-11 items-center gap-1 text-[15px] font-semibold text-accent-text no-underline hover:underline";
  return (
    <div className="flex items-center px-5 pt-4 pb-1 sm:px-8 lg:px-12 lg:pt-8">
      {onVolver ? (
        <button type="button" onClick={onVolver} className={clase}>
          <ChevronLeft className="size-5" aria-hidden />
          {etiqueta}
        </button>
      ) : (
        <Link href={href} className={clase}>
          <ChevronLeft className="size-5" aria-hidden />
          {etiqueta}
        </Link>
      )}
    </div>
  );
}

/**
 * Armazón de las pantallas de acceso: pantalla partida (panel de marca con espacio para imagen + formulario),
 * «‹ Volver», etiqueta del paso, título grande con acento azul, párrafo y contenido centrado verticalmente en pantallas anchas.
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
    <AuthDividido>
      <div className="flex min-h-dvh flex-col">
        <BarraVolverAuth href={volver} onVolver={onVolver} />
        <main className={cn("mx-auto flex w-full flex-1 flex-col justify-center px-5 pt-4 pb-12 sm:px-8", ancho === "max-w-lg" ? "lg:max-w-md" : ancho)}>
          <span className="mb-2 text-[12px] font-semibold tracking-[0.08em] text-text-muted uppercase">{indice}</span>
          <Poster as="h1" size={tamano} className="pb-3 break-words lg:text-[44px]">
            {titulo}
          </Poster>
          {intro ? <p className="body mb-5 text-text-muted break-words">{intro}</p> : null}
          <div className="flex flex-col">{children}</div>
        </main>
      </div>
    </AuthDividido>
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
      <span className="text-[13px] text-text-muted">{children}</span>
      <span className="h-px flex-1 bg-[var(--grid)]" />
    </div>
  );
}

/** Mensaje de error de formulario (bloque sólido, mismo patrón que sn-help--error). */
export function ErrorForm({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <p role="alert" className={cn("self-start rounded-2xl bg-danger/10 px-3 py-2 text-[13px] leading-[18px] font-medium text-danger", className)}>
      {children}
    </p>
  );
}

/** Enlace/acción de texto azul. */
export const claseEnlace = "inline-flex min-h-11 items-center text-left text-[14px] font-semibold text-accent-text underline-offset-4 hover:underline";

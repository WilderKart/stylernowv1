"use client";

import { Meta, Num, Poster } from "@/components/brutal";
import { Button } from "@/components/ui/button";
import { ArrowUpRight } from "lucide-react";
import Link from "next/link";
import { useEffect } from "react";

/**
 * Error Boundary de segmento (captura cualquier error no controlado dentro de
 * un layout/página del árbol de rutas). No reemplaza el manejo explícito de
 * errores de negocio (SLOT_NO_DISPONIBLE, PAGO_YA_PROCESADO, etc. — esos ya se
 * atrapan en cada action y se muestran como mensaje, nunca llegan hasta acá):
 * esto es la red de contención para lo verdaderamente inesperado.
 */
export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[error-boundary]", error);
  }, [error]);

  return (
    <div className="flex min-h-dvh flex-col bg-bg">
      <main className="mx-auto flex w-full max-w-lg flex-1 flex-col justify-center gap-3 p-4">
        <Num>00 / Error</Num>
        <Poster as="h1" size={2} className="break-words">
          Algo
          <br />
          <span className="sn-hot">falló.</span>
        </Poster>
        <p className="body text-text-muted">
          No pudimos cargar esta pantalla. Podés reintentar — si sigue pasando, contanos qué estabas haciendo.
        </p>
        {error.digest ? <Meta>Código: {error.digest}</Meta> : null}
        <Button size="lg" onClick={reset} className="w-full justify-between">
          <span>Reintentar</span>
          <ArrowUpRight className="size-[18px]" aria-hidden />
        </Button>
        <Button asChild variant="secondary" size="lg" className="w-full justify-between">
          <Link href="/">
            <span>Volver al inicio</span>
            <ArrowUpRight className="size-[18px]" aria-hidden />
          </Link>
        </Button>
      </main>
    </div>
  );
}

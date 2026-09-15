"use client";

import { Button } from "@/components/ui/button";
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
    <div className="flex min-h-dvh flex-col items-center justify-center bg-bg px-6 text-center">
      <div className="mb-5 flex size-14 items-center justify-center rounded-full bg-danger-soft">
        <svg
          viewBox="0 0 24 24"
          width="26"
          height="26"
          fill="none"
          stroke="#e5584d"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M12 9v4M12 17h.01" />
          <path d="M10.3 3.9 2.7 17.3A1.8 1.8 0 0 0 4.3 20h15.4a1.8 1.8 0 0 0 1.6-2.7L13.7 3.9a1.8 1.8 0 0 0-3.4 0z" />
        </svg>
      </div>
      <h1 className="font-display mb-2 text-[20px] font-bold uppercase text-text">
        Algo salió mal
      </h1>
      <p className="mb-6 max-w-xs text-[13.5px] leading-relaxed text-text-muted">
        No pudimos cargar esta pantalla. Podés reintentar — si sigue pasando,
        contanos qué estabas haciendo.
      </p>
      {error.digest ? (
        <p className="mb-6 font-mono text-[11px] text-text-faint">Ref: {error.digest}</p>
      ) : null}
      <div className="flex w-full max-w-xs flex-col gap-2.5">
        <Button size="lg" onClick={reset} className="w-full">
          REINTENTAR
        </Button>
        <Button asChild variant="secondary" size="lg" className="w-full">
          <Link href="/">VOLVER AL INICIO</Link>
        </Button>
      </div>
    </div>
  );
}

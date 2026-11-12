"use client";

import { Meta, Num, Poster } from "@/components/brutal";
import { Button } from "@/components/ui/button";
import { ArrowUpRight } from "lucide-react";
import Link from "next/link";
import { useEffect } from "react";
import { useT } from "@/lib/i18n/proveedor";

/**
 * Error Boundary de segmento (captura cualquier error no controlado dentro de
 * un layout/página del árbol de rutas). No reemplaza el manejo explícito de
 * errores de negocio (SLOT_NO_DISPONIBLE, PAGO_YA_PROCESADO, etc. — esos ya se
 * atrapan en cada action y se muestran como mensaje, nunca llegan hasta aquí):
 * esto es la red de contención para lo verdaderamente inesperado.
 */
export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useT();
  useEffect(() => {
    console.error("[error-boundary]", error);
  }, [error]);

  return (
    <div className="flex min-h-dvh flex-col bg-bg">
      <main className="mx-auto flex w-full max-w-lg flex-1 flex-col justify-center gap-3 p-4">
        <Num>{t("err.codigo")}</Num>
        <Poster as="h1" size={2} className="break-words">
          {t("err.algo")}
          <br />
          <span className="sn-hot">{t("err.fallo")}</span>
        </Poster>
        <p className="body text-text-muted">
          {t("err.no_pudimos")}
        </p>
        {error.digest ? <Meta>{t("err.codigo_n", { codigo: error.digest })}</Meta> : null}
        <Button size="lg" onClick={reset} className="w-full justify-between">
          <span>{t("comun.reintentar")}</span>
          <ArrowUpRight className="size-[18px]" aria-hidden />
        </Button>
        <Button asChild variant="secondary" size="lg" className="w-full justify-between">
          <Link href="/">
            <span>{t("err.volver_inicio")}</span>
            <ArrowUpRight className="size-[18px]" aria-hidden />
          </Link>
        </Button>
      </main>
    </div>
  );
}

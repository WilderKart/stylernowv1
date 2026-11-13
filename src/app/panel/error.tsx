"use client";

import { Meta, Num, Poster } from "@/components/brutal";
import { Button } from "@/components/ui/button";
import { ArrowUpRight } from "lucide-react";
import { useEffect } from "react";
import { useT } from "@/lib/i18n/proveedor";

/**
 * Error Boundary del panel del negocio. Sin él, un error no controlado en cualquier
 * pantalla del panel subía hasta `app/error.tsx` y reemplazaba también el layout (se
 * perdía la navegación). Aquí el layout del panel se conserva y solo cae el contenido.
 */
export default function ErrorPanel({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const t = useT();
  useEffect(() => {
    console.error("[panel/error-boundary]", error);
  }, [error]);

  return (
    <main className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-3 px-5 py-10" role="alert">
      <Num>{t("err.codigo")}</Num>
      <Poster as="h1" size={3} className="break-words">
        {t("err.algo")} <span className="sn-hot">{t("err.fallo")}</span>
      </Poster>
      <p className="body text-text-muted">{t("err.no_pudimos")}</p>
      {error.digest ? <Meta>{t("err.codigo_n", { codigo: error.digest })}</Meta> : null}
      <Button onClick={reset} className="self-start">
        <span>{t("comun.reintentar")}</span>
        <ArrowUpRight className="size-[18px]" aria-hidden />
      </Button>
    </main>
  );
}

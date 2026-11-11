"use client";

import { Button } from "@/components/ui/button";
import { consultarEstadoSistemaAction } from "@/components/sistema/actions";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

export function BotonReintentar() {
  const router = useRouter();
  const [pendiente, iniciar] = useTransition();
  const [sigue, setSigue] = useState(false);

  function reintentar() {
    setSigue(false);
    iniciar(async () => {
      try {
        const e = await consultarEstadoSistemaAction();
        if (!e.mantenimiento) {
          router.replace("/");
          return;
        }
        setSigue(true);
        router.refresh();
      } catch {
        setSigue(true);
      }
    });
  }

  return (
    <div className="flex flex-col gap-3">
      {sigue ? (
        <p role="status" className="sn-meta">
          Seguimos en mantenimiento. Inténtalo en unos minutos.
        </p>
      ) : null}
      <Button size="lg" className="w-full justify-between" loading={pendiente} onClick={reintentar}>
        <span>Reintentar</span> <span aria-hidden>↗</span>
      </Button>
    </div>
  );
}

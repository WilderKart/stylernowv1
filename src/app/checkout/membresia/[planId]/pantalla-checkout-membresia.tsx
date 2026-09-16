"use client";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { formatCOP } from "@/lib/utils";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { consultarEstadoCompraMembresia, iniciarCompraMembresia } from "./actions";

const INTERVALO_POLLING_MS = 4_000;

export interface ResumenCompraMembresia {
  planId: string;
  negocio: string;
  nombrePlan: string;
  precio: number;
  duracionMeses: number;
}

export function PantallaCheckoutMembresia({ resumen }: { resumen: ResumenCompraMembresia }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [iniciando, setIniciando] = useState(false);
  const [pagoId, setPagoId] = useState<string | null>(searchParams.get("pagoId"));
  const [esperando, setEsperando] = useState(!!searchParams.get("pagoId"));
  const [error, setError] = useState<string | null>(null);
  const yaRedirigido = useRef(false);

  useEffect(() => {
    if (!pagoId) return;
    const intervalo = setInterval(async () => {
      const estado = await consultarEstadoCompraMembresia(pagoId);
      if (estado.pago === "APROBADO" && estado.membresiaId && !yaRedirigido.current) {
        yaRedirigido.current = true;
        router.replace(`/membresias/${estado.membresiaId}`);
      } else if (estado.pago === "RECHAZADO") {
        setEsperando(false);
        setError("El pago fue rechazado. Podés intentar de nuevo con otro medio.");
      }
    }, INTERVALO_POLLING_MS);
    return () => clearInterval(intervalo);
  }, [pagoId, router]);

  async function comprar() {
    setIniciando(true);
    setError(null);
    const r = await iniciarCompraMembresia(resumen.planId);
    setIniciando(false);
    if (!r.ok) return setError(r.mensaje);
    setPagoId(r.pagoId);
    setEsperando(true);
    window.location.href = r.url;
  }

  return (
    <main className="mx-auto w-full max-w-md flex-1 px-5 py-6 pb-32 sm:px-0">
      <Card>
        <p className="text-[11.5px] font-bold uppercase tracking-wide text-text-muted">{resumen.negocio}</p>
        <p className="mt-1 text-[15px] font-bold text-text">{resumen.nombrePlan}</p>
        <p className="mt-0.5 text-[12.5px] text-text-muted">Se renueva cada {resumen.duracionMeses} mes{resumen.duracionMeses > 1 ? "es" : ""}</p>
        <div className="mt-4 flex items-baseline justify-between border-t border-border-subtle pt-3">
          <span className="text-[13.5px] font-bold text-text">Total a pagar</span>
          <span className="font-display text-[26px] font-bold leading-none text-accent">{formatCOP(resumen.precio)}</span>
        </div>
      </Card>

      <section className="mt-5 rounded-2xl border border-border bg-surface-2 p-4">
        <p className="flex items-center gap-1.5 text-[12px] font-semibold text-success">Pago seguro procesado por Mercado Pago</p>
        <p className="mt-2 text-[11.5px] text-text-faint">StylerNow no almacena los datos de tu tarjeta en ningún momento.</p>
      </section>

      {esperando ? (
        <div className="mt-5 rounded-2xl border border-border bg-surface p-4 text-center">
          <span className="mx-auto mb-3 block size-6 animate-spin rounded-full border-2 border-accent border-t-transparent" />
          <p className="text-[13px] font-semibold text-text">Esperando la confirmación…</p>
        </div>
      ) : null}

      {error ? (
        <p role="alert" className="mt-4 text-center text-[12.5px] font-semibold text-danger">{error}</p>
      ) : null}

      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-border-subtle bg-bg/95 px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur">
        <div className="mx-auto w-full max-w-md">
          <Button size="lg" className="w-full" loading={iniciando || esperando} disabled={iniciando || esperando} onClick={comprar}>
            PAGAR {formatCOP(resumen.precio)}
          </Button>
        </div>
      </div>
    </main>
  );
}

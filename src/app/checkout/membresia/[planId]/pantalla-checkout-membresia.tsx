"use client";

import { Barra, Bloque, ErrorAviso, Fila, Filas, Pie, Sec, TicketCita } from "@/app/lealtad/ui-cliente";
import { Status } from "@/components/brutal";
import { Button } from "@/components/ui/button";
import { Check, Clock, ShieldCheck } from "lucide-react";
import { formatCOP } from "@/lib/utils";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { consultarEstadoCompraMembresia, iniciarCompraMembresia } from "./actions";
import { useT } from "@/lib/i18n/proveedor";

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
  const t = useT();
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
        setError(t("pago.rechazado"));
      }
    }, INTERVALO_POLLING_MS);
    return () => clearInterval(intervalo);
  }, [pagoId, router, t]);

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

  if (esperando) {
    return (
      <main className="sn-block-ink !bg-ink !text-paper flex flex-1 flex-col justify-center gap-6 px-4 py-6" role="status" aria-live="polite">
        <span className="sn-num !text-signal">{t("pago.pagando")}</span>
        <p className="poster-1 break-words !text-paper">
          {t("pago.un_1")}
          <br />
          <span className="sn-hot">{t("pago.un_2")}</span>
        </p>
        <Barra pct={68} etiqueta={t("pago.confirmando_aria")} className="!h-5 !border-paper" />
        <p className="body m-0 text-[#D4D4D4]">{t("pago.confirmando_mp")}</p>
        <span className="sn-meta !text-[#A3A3A3]">{t("pago.seguro")}</span>
      </main>
    );
  }

  return (
    <main className="flex flex-1 flex-col">
      <div className="p-4">
        <TicketCita
          dia={String(resumen.duracionMeses)}
          mes={resumen.duracionMeses > 1 ? t("co.meses") : t("co.mes")}
          estado={
            <Status tone="warn" icon={<Clock aria-hidden className="size-3.5" />}>
              {t("estado.pendiente_pago")}
            </Status>
          }
          titulo={resumen.nombrePlan}
          lineas={[resumen.negocio, resumen.duracionMeses > 1 ? t("co.renueva_n", { n: resumen.duracionMeses }) : t("co.renueva", { n: resumen.duracionMeses })]}
          pie={
            <>
              <span className="sn-label">{t("co.total")}</span>
              <span className="sn-fig text-[22px]">{formatCOP(resumen.precio)}</span>
            </>
          }
        />
      </div>

      <Sec>{t("pago.sec_metodo")}</Sec>
      <Filas>
        <Fila
          icono={<ShieldCheck aria-hidden className="size-5" />}
          titulo="Mercado Pago"
          meta={t("co.mp_meta")}
          derecha={
            <Status tone="ok" icon={<Check aria-hidden className="size-3.5" />}>
              {t("pago.elegido")}
            </Status>
          }
        />
      </Filas>
      <Bloque etiqueta={t("pago.sec_seguridad")}>
        {t("pago.seguridad_txt")}
      </Bloque>

      {error ? (
        <div className="px-4 pt-4">
          <ErrorAviso>{error}</ErrorAviso>
        </div>
      ) : null}

      <div className="flex-1" />
      <Pie>
        <Button size="lg" className="w-full" loading={iniciando} disabled={iniciando} onClick={comprar}>
          {t("co.pagar", { monto: formatCOP(resumen.precio) })}
        </Button>
      </Pie>
    </main>
  );
}

"use client";

import { ModalPagoMercadoPago, type CobroModal } from "@/components/pagos/modal-pago-mercadopago";
import { Button } from "@/components/ui/button";
import { formatCOP } from "@/lib/utils";
import Link from "next/link";
import { useRef, useState, useTransition } from "react";
import { iniciarPagoSedeExtra, type OfertaSedeExtra } from "./actions";

/**
 * Sedes adicionales (de pago mensual). Se ofrece al llegar al límite de sedes del plan y, si ya tiene extras, para renovarlas.
 * El pago se abre en el modal de Mercado Pago; la sede extra se activa cuando el pago se aprueba.
 */
export function OfertaSedeExtra({
  negocioId,
  oferta,
  planNombre,
  limite,
  modo,
}: {
  negocioId: string;
  oferta: OfertaSedeExtra;
  planNombre: string;
  limite: number | null;
  /** `limite` = llegó al límite (agregar una sede); `renovar` = mostrar la vigencia de las extras con su botón. */
  modo: "limite" | "renovar";
}) {
  const [cobro, setCobro] = useState<CobroModal | null>(null);
  const [pendiente, iniciar] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const ultimo = useRef<"AGREGAR" | "RENOVAR">("AGREGAR");

  function pagar(m: "AGREGAR" | "RENOVAR") {
    setError(null);
    ultimo.current = m;
    iniciar(async () => {
      const r = await iniciarPagoSedeExtra(negocioId, m);
      if (!r.ok) return setError(r.error);
      setCobro({ pagoId: r.pagoId, preferenciaId: r.preferenciaId, url: r.url, titulo: m === "AGREGAR" ? "Sede adicional · 1 mes" : "Renovación de sedes adicionales" });
    });
  }

  const modal = (
    <ModalPagoMercadoPago
      key={cobro?.pagoId ?? "sin-cobro"}
      cobro={cobro}
      onCerrar={() => setCobro(null)}
      onAprobado={() => window.location.assign("/panel/sedes/nueva")}
      onReintentar={() => {
        setCobro(null);
        pagar(ultimo.current);
      }}
    />
  );

  if (modo === "renovar") {
    if (oferta.extrasVigentes <= 0 || !oferta.vigenteHasta) return null;
    return (
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-surface p-4">
        {modal}
        <p className="text-[12.5px] text-text-muted">
          {oferta.extrasVigentes === 1 ? "1 sede adicional activa" : `${oferta.extrasVigentes} sedes adicionales activas`} hasta el{" "}
          {new Date(oferta.vigenteHasta).toLocaleDateString("es-CO", { day: "numeric", month: "long", year: "numeric" })}.
        </p>
        <Button size="sm" variant="secondary" loading={pendiente} onClick={() => pagar("RENOVAR")}>
          {oferta.precio ? `Renovar un mes · ${formatCOP(oferta.precio * oferta.extrasVigentes)}` : "Renovar un mes"}
        </Button>
        {error ? <p className="w-full text-[12.5px] font-semibold text-danger">{error}</p> : null}
      </div>
    );
  }

  const puedeAgregar = oferta.precio !== null && oferta.tope > 0 && oferta.extrasVigentes < oferta.tope;
  return (
    <div className="rounded-2xl border border-border bg-surface p-4">
      {modal}
      <p className="text-[13.5px] font-bold text-text">
        Tu plan {planNombre} incluye {limite ?? 1} sede{limite === 1 ? "" : "s"}
      </p>
      {puedeAgregar ? (
        <>
          <p className="mt-1 text-[12.5px] text-text-muted">
            Puedes agregar una sede adicional por {formatCOP(oferta.precio!)} al mes, o subir de plan para tener más sedes y más funciones.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <Button loading={pendiente} onClick={() => pagar("AGREGAR")}>
              Agregar sede · {formatCOP(oferta.precio!)}/mes
            </Button>
            <Link href="/panel/suscripcion" className="text-[12.5px] font-semibold underline">
              Ver planes
            </Link>
          </div>
        </>
      ) : (
        <>
          <p className="mt-1 text-[12.5px] text-text-muted">Llegaste al máximo de sedes de tu plan. Sube de plan para agregar otra sede.</p>
          <Link href="/panel/suscripcion" className="mt-3 inline-block text-[12.5px] font-semibold underline">
            Ver planes
          </Link>
        </>
      )}
      {error ? <p className="mt-2 text-[12.5px] font-semibold text-danger">{error}</p> : null}
    </div>
  );
}

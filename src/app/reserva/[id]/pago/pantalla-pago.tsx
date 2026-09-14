"use client";

import { Button } from "@/components/ui/button";
import { fechaHoraLarga } from "@/lib/formato";
import { formatCOP } from "@/lib/utils";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { consultarEstadoPago, iniciarPagoSena } from "./actions";

/** Tras este tiempo sin confirmación se avisa que puede cerrar la app (02-UX/06_Payments.md). */
const TIMEOUT_UX_MS = 30_000;
const INTERVALO_POLLING_MS = 4_000;

export interface ResumenPago {
  reservaId: string;
  negocio: string;
  servicios: string;
  profesional: string;
  horaInicio: string;
  zonaHoraria: string;
  montoTotal: number;
  montoSena: number;
  expiraAt: string | null;
}

function Cuenta({ expiraAt }: { expiraAt: string }) {
  const [restante, setRestante] = useState(() =>
    Math.max(0, new Date(expiraAt).getTime() - Date.now())
  );

  useEffect(() => {
    const t = setInterval(
      () => setRestante(Math.max(0, new Date(expiraAt).getTime() - Date.now())),
      1000
    );
    return () => clearInterval(t);
  }, [expiraAt]);

  const min = Math.floor(restante / 60000);
  const seg = Math.floor((restante % 60000) / 1000);

  if (restante <= 0) {
    return (
      <p className="text-[12.5px] font-semibold text-danger">
        La reserva del horario expiró. Volvé a elegir un turno.
      </p>
    );
  }

  return (
    <p className="text-[12.5px] text-text-muted">
      Te guardamos el horario por{" "}
      <span className="font-bold tabular-nums text-accent">
        {min}:{String(seg).padStart(2, "0")}
      </span>
    </p>
  );
}

export function PantallaPago({ resumen }: { resumen: ResumenPago }) {
  const router = useRouter();
  const [iniciando, setIniciando] = useState(false);
  const [esperando, setEsperando] = useState(false);
  const [demorado, setDemorado] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const yaRedirigido = useRef(false);

  // Polling del estado: la confirmación de la pasarela es asíncrona, así que la pantalla
  // nunca se queda congelada esperando una respuesta síncrona que no va a llegar.
  useEffect(() => {
    const intervalo = setInterval(async () => {
      const estado = await consultarEstadoPago(resumen.reservaId);

      if (estado.reserva === "CONFIRMADA" && !yaRedirigido.current) {
        yaRedirigido.current = true;
        router.replace(`/reserva/${resumen.reservaId}`);
        return;
      }
      if (estado.pago === "RECHAZADO") {
        setEsperando(false);
        setError("El pago fue rechazado. Podés intentar de nuevo con otro medio.");
      }
      if (estado.reserva === "CANCELADA" && !yaRedirigido.current) {
        yaRedirigido.current = true;
        router.replace(`/reserva/${resumen.reservaId}`);
      }
    }, INTERVALO_POLLING_MS);

    return () => clearInterval(intervalo);
  }, [resumen.reservaId, router]);

  useEffect(() => {
    if (!esperando) return;
    const t = setTimeout(() => setDemorado(true), TIMEOUT_UX_MS);
    return () => clearTimeout(t);
  }, [esperando]);

  async function pagar() {
    setIniciando(true);
    setError(null);

    const r = await iniciarPagoSena(resumen.reservaId);

    if (!r.ok) {
      setIniciando(false);
      if (r.yaPagada) {
        router.replace(`/reserva/${resumen.reservaId}`);
        return;
      }
      setError(r.mensaje);
      return;
    }

    setEsperando(true);
    window.location.href = r.url;
  }

  return (
    <div className="flex min-h-dvh flex-col pb-32">
      <main className="mx-auto w-full max-w-md flex-1 px-5 py-6 sm:px-0">
        {/* Resumen fijo arriba: qué se está pagando, siempre a la vista. */}
        <section className="rounded-2xl border border-border-subtle bg-surface p-4">
          <p className="text-[11.5px] font-bold uppercase tracking-wide text-text-muted">
            {resumen.negocio}
          </p>
          <p className="mt-1 text-[15px] font-bold text-text">{resumen.servicios}</p>
          <p className="mt-0.5 text-[12.5px] text-text-muted">
            {resumen.profesional} · <span className="capitalize">{fechaHoraLarga(resumen.horaInicio, resumen.zonaHoraria)}</span>
          </p>

          <div className="mt-4 border-t border-border-subtle pt-3">
            <div className="flex items-center justify-between">
              <span className="text-[12.5px] text-text-muted">Total del servicio</span>
              <span className="text-[13px] font-semibold text-text">
                {formatCOP(resumen.montoTotal)}
              </span>
            </div>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="text-[13.5px] font-bold text-text">Seña a pagar</span>
              <span className="font-display text-[26px] font-bold leading-none text-accent">
                {formatCOP(resumen.montoSena)}
              </span>
            </div>
            {resumen.montoSena < resumen.montoTotal ? (
              <p className="mt-1.5 text-[11.5px] text-text-faint">
                El saldo de {formatCOP(resumen.montoTotal - resumen.montoSena)} lo pagás en el
                local.
              </p>
            ) : null}
          </div>
        </section>

        {resumen.expiraAt ? (
          <div className="mt-3 text-center">
            <Cuenta expiraAt={resumen.expiraAt} />
          </div>
        ) : null}

        <section className="mt-5 rounded-2xl border border-border bg-surface-2 p-4">
          <p className="mb-2 text-[11.5px] font-bold uppercase tracking-wide text-text-muted">
            Medios de pago
          </p>
          <p className="text-[12.5px] leading-relaxed text-text-muted">
            Elegís el medio en el siguiente paso: tarjeta de crédito o débito, PSE, y
            billeteras habilitadas por la pasarela.
          </p>
          <p className="mt-3 flex items-center gap-1.5 text-[12px] font-semibold text-success">
            <svg
              viewBox="0 0 24 24"
              width="14"
              height="14"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M12 3l7.5 3v5.5c0 4.6-3.2 8.3-7.5 9.5-4.3-1.2-7.5-4.9-7.5-9.5V6z" />
              <path d="M9 12l2 2 4-4" />
            </svg>
            Pago seguro procesado por Mercado Pago
          </p>
          <p className="mt-2 text-[11.5px] text-text-faint">
            StylerNow no almacena los datos de tu tarjeta en ningún momento.
          </p>
        </section>

        {esperando ? (
          <div className="mt-5 rounded-2xl border border-border bg-surface p-4 text-center">
            <span className="mx-auto mb-3 block size-6 animate-spin rounded-full border-2 border-accent border-t-transparent" />
            <p className="text-[13px] font-semibold text-text">Esperando la confirmación…</p>
            {demorado ? (
              <p className="mx-auto mt-1.5 max-w-[280px] text-[12px] leading-relaxed text-text-muted">
                Está tardando más de lo normal. Podés cerrar la app con tranquilidad: te
                avisamos apenas se confirme el pago.
              </p>
            ) : null}
          </div>
        ) : null}

        {error ? (
          <p role="alert" className="mt-4 text-center text-[12.5px] font-semibold text-danger">
            {error}
          </p>
        ) : null}
      </main>

      {/* Un solo botón de pago, deshabilitado tras el primer tap (05-API/01_Standards.md). */}
      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-border-subtle bg-bg/95 px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur">
        <div className="mx-auto w-full max-w-md">
          <Button
            size="lg"
            className="w-full"
            loading={iniciando || esperando}
            disabled={iniciando || esperando}
            onClick={pagar}
          >
            PAGAR {formatCOP(resumen.montoSena)} Y CONFIRMAR
          </Button>
        </div>
      </div>
    </div>
  );
}

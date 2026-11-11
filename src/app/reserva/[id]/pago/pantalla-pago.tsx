"use client";

import {
  Barra,
  Bloque,
  diaYMes,
  ErrorAviso,
  Fila,
  Filas,
  horaCorta,
  Pantalla,
  Pie,
  Sec,
  TicketCita,
  Top,
} from "@/app/lealtad/ui-cliente";
import { Status } from "@/components/brutal";
import { Button } from "@/components/ui/button";
import { Check, Clock, ShieldCheck, Ticket, Wallet } from "lucide-react";
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
    return <ErrorAviso>La reserva del horario expiró. Vuelve a elegir un turno.</ErrorAviso>;
  }

  return (
    <p className="sn-meta">
      Te guardamos el horario por{" "}
      <span className="font-bold tabular-nums text-text">
        {min}:{String(seg).padStart(2, "0")}
      </span>
    </p>
  );
}

export function PantallaPago({ resumen, volverA }: { resumen: ResumenPago; volverA: string }) {
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
        setError("El pago fue rechazado. Puedes intentar de nuevo con otro medio.");
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

  const dm = diaYMes(resumen.horaInicio, resumen.zonaHoraria);
  const hora = horaCorta(resumen.horaInicio, resumen.zonaHoraria);
  const saldoLocal = resumen.montoTotal - resumen.montoSena;

  // Esperando la confirmación de la pasarela (C10): bloque tinta a pantalla completa.
  if (esperando) {
    return (
      <Pantalla className="sn-block-ink !bg-ink !text-paper justify-center gap-6 px-4 py-6" role="status" aria-live="polite">
        <span className="sn-num !text-signal">00 / Pagando</span>
        <p className="poster-1 break-words !text-paper">
          Un
          <br />
          <span className="sn-hot">momento.</span>
        </p>
        <Barra pct={68} etiqueta="Confirmando el pago" className="!h-5 !border-paper" />
        <p className="body m-0 text-[#D4D4D4]">Confirmando tu pago con Mercado Pago. No cierres la app.</p>
        {demorado ? (
          <p className="body-sm m-0 text-[#D4D4D4]">
            Está tardando más de lo normal. Puedes cerrar la app con tranquilidad: te avisamos apenas se confirme el pago.
          </p>
        ) : null}
        <span className="sn-meta !text-[#A3A3A3]">Pago seguro · StylerNow no guarda los datos de tu tarjeta</span>
        {error ? <ErrorAviso>{error}</ErrorAviso> : null}
      </Pantalla>
    );
  }

  return (
    <Pantalla>
      <Top titulo="Reserva · Resumen" volverA={volverA} />
      <div className="p-steps" aria-label="Pasos de la reserva">
        <span className="is-done">01 Servicio</span>
        <span className="is-done">02 Profesional</span>
        <span className="is-done">03 Hora</span>
        <span className="is-on" aria-current="step">
          04 Pago
        </span>
      </div>

      <div className="p-4">
        <TicketCita
          dia={dm.dia}
          mes={dm.mes}
          estado={
            <Status tone="warn" icon={<Clock aria-hidden className="size-3.5" />}>
              Pendiente de pago
            </Status>
          }
          titulo={resumen.servicios}
          lineas={[`${resumen.profesional} · ${hora} · ${resumen.negocio}`]}
          pie={
            <>
              <span className="sn-label">Total</span>
              <span className="sn-fig text-[22px]">{formatCOP(resumen.montoTotal)}</span>
            </>
          }
        />
        {resumen.expiraAt ? (
          <div className="mt-3">
            <Cuenta expiraAt={resumen.expiraAt} />
          </div>
        ) : null}
      </div>

      <Filas>
        <Fila
          icono={<Ticket aria-hidden className="size-5" />}
          titulo="Seña a pagar"
          meta="Se descuenta del total el día de la cita"
          derecha={<span className="sn-price">{formatCOP(resumen.montoSena)}</span>}
        />
        {saldoLocal > 0 ? (
          <Fila
            icono={<Wallet aria-hidden className="size-5" />}
            titulo="Pagas en el local"
            derecha={<span className="sn-price">{formatCOP(saldoLocal)}</span>}
          />
        ) : null}
      </Filas>

      <Sec>01 / Método de pago</Sec>
      <Filas>
        <Fila
          icono={<ShieldCheck aria-hidden className="size-5" />}
          titulo="Mercado Pago"
          meta="Tarjeta de crédito o débito, PSE y billeteras habilitadas. Eliges el medio en el siguiente paso."
          derecha={
            <Status tone="ok" icon={<Check aria-hidden className="size-3.5" />}>
              Elegido
            </Status>
          }
        />
      </Filas>
      <Bloque etiqueta="00 / Seguridad">
        Pago seguro procesado por Mercado Pago. StylerNow no almacena los datos de tu tarjeta en ningún momento.
      </Bloque>

      {error ? (
        <div className="px-4 pt-4">
          <ErrorAviso>{error}</ErrorAviso>
        </div>
      ) : null}

      <div className="flex-1" />
      {/* Un solo botón de pago, deshabilitado tras el primer tap (05-API/01_Standards.md). */}
      <Pie>
        <Button size="lg" className="w-full" loading={iniciando} disabled={iniciando} onClick={pagar}>
          Pagar seña {formatCOP(resumen.montoSena)}
        </Button>
      </Pie>
    </Pantalla>
  );
}

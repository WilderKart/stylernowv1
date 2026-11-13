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
import { confirmarSinAnticipo, consultarEstadoPago, iniciarPagoSena } from "./actions";
import { useT } from "@/lib/i18n/proveedor";

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
  politica: string[];
  anticipoOpcional?: boolean;
}

function Cuenta({ expiraAt }: { expiraAt: string }) {
  const t = useT();
  const [restante, setRestante] = useState(() =>
    Math.max(0, new Date(expiraAt).getTime() - Date.now())
  );

  useEffect(() => {
    const temporizador = setInterval(
      () => setRestante(Math.max(0, new Date(expiraAt).getTime() - Date.now())),
      1000
    );
    return () => clearInterval(temporizador);
  }, [expiraAt]);

  const min = Math.floor(restante / 60000);
  const seg = Math.floor((restante % 60000) / 1000);

  if (restante <= 0) {
    return <ErrorAviso>{t("pago.expiro")}</ErrorAviso>;
  }

  return (
    <p className="sn-meta">
      {t("pago.guardamos")}{" "}
      <span className="font-bold tabular-nums text-text">
        {min}:{String(seg).padStart(2, "0")}
      </span>
    </p>
  );
}

export function PantallaPago({ resumen, volverA }: { resumen: ResumenPago; volverA: string }) {
  const router = useRouter();
  const t = useT();
  const [iniciando, setIniciando] = useState(false);
  const [esperando, setEsperando] = useState(false);
  const [demorado, setDemorado] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [acepta, setAcepta] = useState(false);
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
        setError(t("pago.rechazado"));
      }
      if (estado.reserva === "CANCELADA" && !yaRedirigido.current) {
        yaRedirigido.current = true;
        router.replace(`/reserva/${resumen.reservaId}`);
      }
    }, INTERVALO_POLLING_MS);

    return () => clearInterval(intervalo);
  }, [resumen.reservaId, router, t]);

  useEffect(() => {
    if (!esperando) return;
    const temporizador = setTimeout(() => setDemorado(true), TIMEOUT_UX_MS);
    return () => clearTimeout(temporizador);
  }, [esperando]);

  async function reservarSinAnticipo() {
    setIniciando(true);
    setError(null);
    const r = await confirmarSinAnticipo(resumen.reservaId);
    setIniciando(false);
    if (!r.ok) return setError(r.mensaje);
    router.replace(`/reserva/${resumen.reservaId}`);
  }

  async function pagar() {
    setIniciando(true);
    setError(null);

    const r = await iniciarPagoSena(resumen.reservaId, acepta);

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
        <span className="sn-num !text-signal">{t("pago.pagando")}</span>
        <p className="poster-1 break-words !text-paper">
          {t("pago.un_1")}
          <br />
          <span className="sn-hot">{t("pago.un_2")}</span>
        </p>
        <Barra pct={68} etiqueta={t("pago.confirmando_aria")} className="!h-5 !border-paper" />
        <p className="body m-0 text-[#D4D4D4]">{t("pago.confirmando_mp")}</p>
        {demorado ? (
          <p className="body-sm m-0 text-[#D4D4D4]">
            {t("pago.tardando")}
          </p>
        ) : null}
        <span className="sn-meta !text-[#A3A3A3]">{t("pago.seguro")}</span>
        {error ? <ErrorAviso>{error}</ErrorAviso> : null}
      </Pantalla>
    );
  }

  return (
    <Pantalla>
      <Top titulo={t("pago.top")} volverA={volverA} />
      <div className="p-steps" aria-label={t("pago.pasos")}>
        <span className="is-done">{t("pago.p1")}</span>
        <span className="is-done">{t("pago.p2")}</span>
        <span className="is-done">{t("pago.p3")}</span>
        <span className="is-on" aria-current="step">
          {t("pago.p4")}
        </span>
      </div>

      <div className="p-4">
        <TicketCita
          dia={dm.dia}
          mes={dm.mes}
          estado={
            <Status tone="warn" icon={<Clock aria-hidden className="size-3.5" />}>
              {t("estado.pendiente_pago")}
            </Status>
          }
          titulo={resumen.servicios}
          lineas={[`${resumen.profesional} · ${hora} · ${resumen.negocio}`]}
          pie={
            <>
              <span className="sn-label">{t("res.total")}</span>
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
          titulo={t("pago.anticipo_pagar")}
          meta={t("pago.se_descuenta")}
          derecha={<span className="sn-price">{formatCOP(resumen.montoSena)}</span>}
        />
        {saldoLocal > 0 ? (
          <Fila
            icono={<Wallet aria-hidden className="size-5" />}
            titulo={t("pago.pagas_local")}
            derecha={<span className="sn-price">{formatCOP(saldoLocal)}</span>}
          />
        ) : null}
      </Filas>

      <Sec>{t("pago.sec_metodo")}</Sec>
      <Filas>
        <Fila
          icono={<ShieldCheck aria-hidden className="size-5" />}
          titulo="Mercado Pago"
          meta={t("pago.mp_meta")}
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

      <Bloque etiqueta={t("pago.sec_politica")}>
        <ul className="m-0 list-disc space-y-1 pl-5">
          {resumen.politica.map((linea) => (
            <li key={linea}>{linea}</li>
          ))}
        </ul>
        <label className="mt-3 flex cursor-pointer items-start gap-3">
          <input
            type="checkbox"
            className="mt-1 size-5 shrink-0 accent-current"
            checked={acepta}
            onChange={(e) => setAcepta(e.target.checked)}
          />
          <span>{t("pago.acepto_politica")}</span>
        </label>
      </Bloque>

      {error ? (
        <div className="px-4 pt-4">
          <ErrorAviso>{error}</ErrorAviso>
        </div>
      ) : null}

      <div className="flex-1" />
      {/* Un solo botón de pago, deshabilitado tras el primer tap (05-API/01_Standards.md). */}
      <Pie>
        <Button size="lg" className="w-full" loading={iniciando} disabled={iniciando || !acepta} onClick={pagar}>
          {t("pago.pagar_anticipo", { monto: formatCOP(resumen.montoSena) })}
        </Button>
        {resumen.anticipoOpcional ? (
          <Button variant="secondary" size="lg" className="mt-2 w-full" disabled={iniciando} onClick={reservarSinAnticipo}>
            {t("pago.sin_anticipo")}
          </Button>
        ) : null}
      </Pie>
    </Pantalla>
  );
}

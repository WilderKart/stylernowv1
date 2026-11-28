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
import { Check, ChevronDown, Clock, Info, ShieldCheck, Store, Wallet } from "lucide-react";
import { formatCOP } from "@/lib/utils";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { confirmarSinAnticipo, consultarEstadoPago, iniciarPagoSena } from "./actions";
import { useT } from "@/lib/i18n/proveedor";
import estilos from "./pago.module.css";
import { AVISO_PAGO_DIRECTO_SIN_REEMBOLSO } from "@/lib/pagos-directos/aviso";
import { PagoDirecto, SelectorModoPago, type MediosDirectosVista } from "./pago-directo";

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
  cobraEnLinea?: boolean;
  negocioId?: string;
  saldoPendiente?: number;
  directo?: MediosDirectosVista | null;
}

function Cuenta({ expiraAt }: { expiraAt: string }) {
  const t = useT();
  const router = useRouter();
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
    // El bloqueo terminó, pero el turno puede seguir libre: se ofrece revisarlo. NO se recarga sola la pantalla para no perder un comprobante
    // que el cliente esté subiendo; y si ya transfirió, puede enviarlo igual (el servidor lo conserva).
    return (
      <div role="status" className="flex flex-col gap-2 border-2 border-ink bg-surface p-3">
        <p className="m-0 text-[13px] font-bold">Tu tiempo de reserva terminó</p>
        <p className="m-0 text-[12.5px]">
          Si ya transferiste, sube tu comprobante igual: lo conservamos. Si aún no pagaste, revisa si tu horario sigue disponible.
        </p>
        <Button size="sm" variant="secondary" onClick={() => router.refresh()}>
          Revisar mi horario
        </Button>
      </div>
    );
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
  const [pagaTodoDirecto, setPagaTodoDirecto] = useState(false);
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
    if (!r.ok) {
      if (r.expirada) return router.refresh();   // el servidor vuelve a evaluar la disponibilidad real
      return setError(r.mensaje);
    }
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
      if (r.expirada) {
        router.refresh();
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
  // Si el cliente elige «Pagar todo» en el pago directo, el resumen refleja que no queda nada por pagar en el local.
  const aPagarAhora = pagaTodoDirecto ? resumen.montoTotal : resumen.montoSena;
  const saldoLocal = resumen.montoTotal - aPagarAhora;
  // Mercado Pago solo si el negocio lo tiene conectado; el pago directo es una alternativa (o la única opción).
  const mostrarMp = resumen.cobraEnLinea !== false;

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
      <div className={`p-steps ${estilos.pasos}`} aria-label={t("pago.pasos")}>
        <span className="is-done">{t("pago.p1")}</span>
        <span className="is-done">{t("pago.p2")}</span>
        <span className="is-done">{t("pago.p3")}</span>
        <span className="is-on" aria-current="step">
          {t("pago.p4")}
        </span>
      </div>

      <div className={`px-4 py-3 ${estilos.ticket}`}>
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
              <span className="sn-label">Total del servicio</span>
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

      {/* El método se elige primero; el resumen de abajo (anticipo / en el local) cambia según la elección. */}
      {resumen.directo && resumen.negocioId && resumen.montoTotal > resumen.montoSena ? (
        <SelectorModoPago
          modo={pagaTodoDirecto ? "TOTAL" : "ANTICIPO"}
          onChange={(m) => setPagaTodoDirecto(m === "TOTAL")}
          montoSena={resumen.montoSena}
          montoTotal={resumen.montoTotal}
        />
      ) : null}

      {/* Resumen compacto: lo que se paga ahora y lo que queda para el local, lado a lado. */}
      <div className="grid grid-cols-2 gap-2 px-4 pt-3 pb-3">
        <div className={`flex min-w-0 items-center gap-3 border-2 border-ink p-3 ${estilos.r16}`}>
          <Wallet aria-hidden className="size-7 flex-none sm:size-9" />
          <div className="min-w-0">
            <p className="m-0 text-[13px] font-bold">{pagaTodoDirecto ? "Pagas ahora" : "Anticipo"}</p>
            <p className="m-0 font-mono text-[18px] leading-tight font-bold tabular-nums text-signal">{formatCOP(aPagarAhora)}</p>
          </div>
        </div>
        <div className={`flex min-w-0 items-center gap-3 border-2 border-ink p-3 ${estilos.r16}`}>
          <Store aria-hidden className="size-7 flex-none sm:size-9" />
          <div className="min-w-0">
            <p className="m-0 text-[13px] font-bold">En el local</p>
            <p className="m-0 font-mono text-[18px] leading-tight font-bold tabular-nums">{formatCOP(saldoLocal)}</p>
          </div>
        </div>
      </div>
      <Filas>
        {(resumen.saldoPendiente ?? 0) > 0 ? (
          <Fila
            icono={<Wallet aria-hidden className="size-5" />}
            titulo="Saldo pendiente anterior"
            meta="De una cita anterior en este negocio. Se cobra en el local junto con tu servicio."
            derecha={<span className="sn-price">{formatCOP(resumen.saldoPendiente ?? 0)}</span>}
          />
        ) : null}
      </Filas>

      {mostrarMp ? <Sec>{t("pago.sec_metodo")}</Sec> : null}
      {mostrarMp ? (
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
      ) : null}
      {mostrarMp ? (
      <Bloque etiqueta={t("pago.sec_seguridad")}>
        {t("pago.seguridad_txt")}
      </Bloque>
      ) : null}

      {/* Política de cancelación: cerrada por defecto para reducir el scroll; se despliega con un toque. */}
      <details className={`group mx-4 mt-3 border-2 border-ink p-3 ${estilos.r16}`}>
        <summary className="flex cursor-pointer list-none items-center gap-2 text-[18px] leading-tight font-bold text-signal [&::-webkit-details-marker]:hidden">
          <ShieldCheck aria-hidden className="size-6 flex-none" />
          <span className="flex-1">{t("pago.sec_politica")}</span>
          <ChevronDown aria-hidden className="size-6 flex-none transition-transform group-open:rotate-180" />
        </summary>
        <ul className={`m-0 mt-2 flex list-none flex-col gap-1 border border-border bg-surface p-2.5 text-[13px] leading-snug ${estilos.r8}`}>
          {resumen.politica.map((linea) => (
            <li key={linea} className="flex items-start gap-2">
              <Check aria-hidden className="mt-0.5 size-4 flex-none text-signal" strokeWidth={3} />
              <span>{linea}</span>
            </li>
          ))}
        </ul>
      </details>

      {resumen.directo ? (
        <section className={`mx-4 mt-3 border-2 border-ink p-3 ${estilos.r16}`}>
          <div role="heading" aria-level={2} className="m-0 mb-1.5 flex items-center gap-2 text-[18px] leading-tight font-bold text-signal">
            <Info aria-hidden className="size-6 flex-none" />
            Información importante
          </div>
          <div className="flex flex-col gap-1.5 font-sans text-[12px] leading-snug normal-case">
            <p className="m-0">El pago se realiza directamente a la cuenta del comercio. StylerNow solo facilita la reserva y no custodia ni valida transferencias.</p>
            <p className="m-0">{AVISO_PAGO_DIRECTO_SIN_REEMBOLSO}</p>
          </div>
        </section>
      ) : null}

      <section className={`mx-4 mt-3 border-2 border-ink p-3 ${estilos.r16}`}>
        <label className="flex cursor-pointer items-start gap-3 text-[13px]">
          <input
            type="checkbox"
            className={`mt-0.5 size-5 shrink-0 accent-current ${estilos.r8}`}
            checked={acepta}
            onChange={(e) => setAcepta(e.target.checked)}
          />
          <span>
            {t("pago.acepto_politica")}
            {resumen.directo ? " También leí la información importante: el dinero va directo al negocio y cualquier devolución me la gestiona el negocio." : ""}
          </span>
        </label>
      </section>

      {resumen.directo && resumen.negocioId ? (
        <PagoDirecto reservaId={resumen.reservaId} negocioId={resumen.negocioId} montoSena={resumen.montoSena} montoTotal={resumen.montoTotal} medios={resumen.directo} acepta={acepta} pagaTodo={pagaTodoDirecto} />
      ) : null}

      {error ? (
        <div className="px-4 pt-4">
          <ErrorAviso>{error}</ErrorAviso>
        </div>
      ) : null}

      <div className="flex-1" />
      {/* Un solo botón de pago, deshabilitado tras el primer tap (05-API/01_Standards.md). */}
      <Pie>
        {mostrarMp ? (
        <Button size="lg" className="w-full" loading={iniciando} disabled={iniciando || !acepta} onClick={pagar}>
          {t("pago.pagar_anticipo", { monto: formatCOP(resumen.montoSena) })}
        </Button>
        ) : null}
        {resumen.anticipoOpcional ? (
          <Button variant="secondary" size="lg" className="mt-2 w-full" disabled={iniciando} onClick={reservarSinAnticipo}>
            {t("pago.sin_anticipo")}
          </Button>
        ) : null}
      </Pie>
    </Pantalla>
  );
}

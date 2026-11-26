"use client";

import { consultarEstadoPagoModal } from "@/app/pagos/modal-actions";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Clock, Loader2, TriangleAlert, X, XCircle } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Checkout Pro de Mercado Pago en MODAL dentro de StylerNow (cobro directo a la cuenta de la plataforma, sin split).
 *
 * Cómo funciona: el servidor crea la preferencia (lib/pagos/cobro.ts) y entrega su id. Aquí se carga el SDK oficial
 * (MercadoPago.js v2) con la clave PÚBLICA y se abre su modal sobre la pantalla actual; esta ventana de StylerNow
 * queda detrás mostrando el estado real del cobro. El estado NUNCA lo decide el navegador: se consulta al servidor,
 * que lo confirma contra la API de Mercado Pago (y el webhook firmado lo aplica de forma idempotente).
 */

const SDK_URL = "https://sdk.mercadopago.com/js/v2";
const SONDEO_MS = 4000;

interface MercadoPagoCheckout {
  open?: () => void;
  close?: () => void;
}
interface MercadoPagoSdk {
  checkout: (opciones: { preference: { id: string }; autoOpen?: boolean }) => MercadoPagoCheckout;
}
declare global {
  interface Window {
    MercadoPago?: new (clavePublica: string, opciones?: { locale?: string }) => MercadoPagoSdk;
  }
}

export interface CobroModal {
  pagoId: string;
  preferenciaId: string;
  /** Respaldo: checkout alojado por Mercado Pago, solo si el SDK no pudo cargarse. */
  url: string;
  titulo?: string;
}

type Fase = "cargando" | "esperando" | "enProceso" | "aprobado" | "rechazado" | "sinSdk";

function cargarSdk(): Promise<void> {
  if (typeof window === "undefined") return Promise.reject(new Error("SIN_VENTANA"));
  if (window.MercadoPago) return Promise.resolve();
  return new Promise((resolver, rechazar) => {
    const previo = document.querySelector<HTMLScriptElement>(`script[src="${SDK_URL}"]`);
    const alCargar = () => (window.MercadoPago ? resolver() : rechazar(new Error("SDK_SIN_OBJETO")));
    if (previo) {
      previo.addEventListener("load", alCargar, { once: true });
      previo.addEventListener("error", () => rechazar(new Error("SDK_NO_CARGO")), { once: true });
      return;
    }
    const s = document.createElement("script");
    s.src = SDK_URL;
    s.async = true;
    s.onload = alCargar;
    s.onerror = () => rechazar(new Error("SDK_NO_CARGO"));
    document.head.appendChild(s);
  });
}

export function ModalPagoMercadoPago({
  cobro,
  onCerrar,
  onAprobado,
  onReintentar,
}: {
  cobro: CobroModal | null;
  onCerrar: () => void;
  /** Se llama cuando la persona confirma el modal tras un pago aprobado: aquí la pantalla refresca su estado. */
  onAprobado: () => void;
  /** Se llama tras un pago rechazado: la pantalla crea un cobro nuevo (el rechazado no se reutiliza). */
  onReintentar: () => void;
}) {
  const [fase, setFase] = useState<Fase>("cargando");
  const [medio, setMedio] = useState<string | null>(null);
  const checkout = useRef<MercadoPagoCheckout | null>(null);

  const abrirMercadoPago = useCallback(async (c: CobroModal) => {
    const clave = process.env.NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY;
    if (!clave) return setFase("sinSdk");
    try {
      await cargarSdk();
      const MP = window.MercadoPago;
      if (!MP) throw new Error("SDK_SIN_OBJETO");
      const mp = new MP(clave, { locale: "es-CO" });
      checkout.current = mp.checkout({ preference: { id: c.preferenciaId }, autoOpen: true });
      setFase((f) => (f === "cargando" ? "esperando" : f));
    } catch {
      setFase("sinSdk");
    }
  }, []);

  // Al recibir un cobro nuevo se abre el checkout de Mercado Pago sobre esta pantalla.
  const pagoId = cobro?.pagoId ?? null;
  useEffect(() => {
    if (!cobro) return;
    let activo = true;
    void (async () => {
      if (!activo) return;
      await abrirMercadoPago(cobro);
    })();
    return () => {
      activo = false;
      checkout.current?.close?.();
      checkout.current = null;
    };
    // El efecto depende solo del id del cobro: reabrir por re-render duplicaría el modal.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pagoId, abrirMercadoPago]);

  // Estado real del cobro: se pregunta al servidor mientras el modal esté abierto y el cobro no sea definitivo.
  useEffect(() => {
    if (!pagoId || fase === "aprobado" || fase === "rechazado") return;
    let activo = true;
    const consultar = async () => {
      try {
        const r = await consultarEstadoPagoModal(pagoId);
        if (!activo) return;
        if (r.estado === "APROBADO") {
          setFase("aprobado");
          checkout.current?.close?.();
        } else if (r.estado === "RECHAZADO") {
          setFase("rechazado");
          checkout.current?.close?.();
        } else if (r.enProceso) {
          setMedio(r.medio);
          setFase("enProceso");
        }
      } catch {
        /* un fallo de red no cambia el estado: se vuelve a preguntar en el siguiente sondeo */
      }
    };
    const t = setInterval(consultar, SONDEO_MS);
    return () => {
      activo = false;
      clearInterval(t);
    };
  }, [pagoId, fase]);

  useEffect(() => {
    if (!cobro) return;
    const alTeclear = (e: KeyboardEvent) => e.key === "Escape" && onCerrar();
    document.addEventListener("keydown", alTeclear);
    return () => document.removeEventListener("keydown", alTeclear);
  }, [cobro, onCerrar]);

  if (!cobro) return null;

  const contenido: Record<Fase, { icono: React.ReactNode; titulo: string; texto: string }> = {
    cargando: {
      icono: <Loader2 className="size-9 animate-spin text-accent-text" aria-hidden />,
      titulo: "Preparando tu pago…",
      texto: "Estamos abriendo Mercado Pago de forma segura. No cierres esta ventana.",
    },
    esperando: {
      icono: <Loader2 className="size-9 animate-spin text-accent-text" aria-hidden />,
      titulo: "Completa el pago en Mercado Pago",
      texto: "Cuando termines, esta ventana se actualiza sola. Si cerraste la ventana de Mercado Pago, puedes abrirla de nuevo.",
    },
    enProceso: {
      icono: <Clock className="size-9 text-accent-text" aria-hidden />,
      titulo: "Tu pago está pendiente",
      texto:
        medio === "pse" || medio === "efecty" || medio === "baloto"
          ? "Mercado Pago está esperando la confirmación de tu pago. Puede tardar unos minutos (o un par de horas en efectivo). Tu plan se activa solo cuando se aprueba; puedes cerrar esta ventana."
          : "Mercado Pago está procesando tu pago. Tu plan se activa solo cuando se aprueba; puedes cerrar esta ventana.",
    },
    aprobado: {
      icono: <CheckCircle2 className="size-9 text-[var(--pn-green,#166b47)]" aria-hidden />,
      titulo: "¡Pago aprobado!",
      texto: "Recibimos tu pago. Estamos actualizando tu cuenta.",
    },
    rechazado: {
      icono: <XCircle className="size-9 text-danger" aria-hidden />,
      titulo: "El pago no se completó",
      texto: "Mercado Pago rechazó o canceló el pago. No se te cobró. Puedes intentarlo de nuevo con otro medio de pago.",
    },
    sinSdk: {
      icono: <TriangleAlert className="size-9 text-danger" aria-hidden />,
      titulo: "No pudimos abrir el pago aquí",
      texto: "Continúa el pago en Mercado Pago. Al terminar, vuelve a StylerNow y tu plan se actualizará.",
    },
  };
  const c = contenido[fase];

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-[var(--scrim)] p-4 sm:items-center" role="presentation">
      <div role="dialog" aria-modal="true" aria-labelledby="modal-pago-titulo" aria-describedby="modal-pago-texto" className="relative w-full max-w-md rounded-3xl border border-border bg-bg p-6 shadow-hard">
        <button type="button" onClick={onCerrar} aria-label="Cerrar" className="sn-iconbtn absolute top-3 right-3">
          <X aria-hidden />
        </button>
        <div className="flex flex-col items-center gap-3 pt-2 text-center">
          <div aria-live="polite">{c.icono}</div>
          <h2 id="modal-pago-titulo" className="m-0 text-[20px] font-extrabold">
            {c.titulo}
          </h2>
          <p id="modal-pago-texto" role="status" className="m-0 text-[14px] leading-snug text-text-muted">
            {c.texto}
          </p>
          {cobro.titulo ? <p className="m-0 text-[12px] text-text-faint">{cobro.titulo}</p> : null}
        </div>

        <div className="mt-5 flex flex-col gap-2">
          {fase === "esperando" ? (
            <Button type="button" variant="secondary" onClick={() => (checkout.current?.open ? checkout.current.open() : void abrirMercadoPago(cobro))}>
              Abrir Mercado Pago
            </Button>
          ) : null}
          {fase === "sinSdk" ? (
            <Button type="button" onClick={() => window.location.assign(cobro.url)}>
              Continuar en Mercado Pago
            </Button>
          ) : null}
          {fase === "aprobado" ? (
            <Button type="button" onClick={onAprobado}>
              Listo
            </Button>
          ) : null}
          {fase === "rechazado" ? (
            <Button type="button" onClick={onReintentar}>
              Intentar de nuevo
            </Button>
          ) : null}
          {fase !== "aprobado" ? (
            <Button type="button" variant="ghost" onClick={onCerrar}>
              {fase === "rechazado" ? "Cerrar" : "Cerrar y pagar después"}
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

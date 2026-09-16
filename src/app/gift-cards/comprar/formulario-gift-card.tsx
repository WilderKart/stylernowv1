"use client";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { formatCOP } from "@/lib/utils";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  buscarNegociosParaGiftCard,
  consultarEstadoCompraGiftCard,
  iniciarCompraGiftCard,
  type NegocioBusqueda,
} from "./actions";

const MONTOS_RAPIDOS = [30000, 50000, 100000, 150000];
const INTERVALO_POLLING_MS = 4_000;

export function FormularioGiftCard({
  negocioPreseleccionado,
  pagoIdRetorno,
}: {
  negocioPreseleccionado: NegocioBusqueda | null;
  pagoIdRetorno: string | null;
}) {
  const [negocio, setNegocio] = useState<NegocioBusqueda | null>(negocioPreseleccionado);
  const [busqueda, setBusqueda] = useState("");
  const [resultados, setResultados] = useState<NegocioBusqueda[]>([]);
  const [monto, setMonto] = useState<number | null>(50000);
  const [montoCustom, setMontoCustom] = useState("");
  const [paraOtro, setParaOtro] = useState(false);
  const [destinatarioNombre, setDestinatarioNombre] = useState("");
  const [destinatarioEmail, setDestinatarioEmail] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [pin, setPin] = useState("");
  const [iniciando, setIniciando] = useState(false);
  const [pagoId, setPagoId] = useState<string | null>(pagoIdRetorno);
  const [esperando, setEsperando] = useState(!!pagoIdRetorno);
  const [comprada, setComprada] = useState(false);
  const yaRedirigido = useRef(false);

  useEffect(() => {
    const t = setTimeout(() => buscarNegociosParaGiftCard(busqueda).then(setResultados), 300);
    return () => clearTimeout(t);
  }, [busqueda]);

  useEffect(() => {
    if (!pagoId) return;
    const intervalo = setInterval(async () => {
      const estado = await consultarEstadoCompraGiftCard(pagoId);
      if (estado.pago === "APROBADO" && !yaRedirigido.current) {
        yaRedirigido.current = true;
        setEsperando(false);
        setComprada(true);
      } else if (estado.pago === "RECHAZADO") {
        setEsperando(false);
        toast.error("El pago fue rechazado. Podés intentar de nuevo con otro medio.");
      }
    }, INTERVALO_POLLING_MS);
    return () => clearInterval(intervalo);
  }, [pagoId]);

  const montoFinal = montoCustom ? Number(montoCustom) : monto;

  async function comprar() {
    if (!negocio) return toast.error("Elegí para qué Negocio es la Gift Card.");
    if (!montoFinal || montoFinal <= 0) return toast.error("Elegí un monto válido.");
    if (pin.length < 4) return toast.error("El PIN debe tener al menos 4 dígitos.");
    if (paraOtro && !destinatarioNombre.trim()) return toast.error("Escribí el nombre del destinatario.");

    setIniciando(true);
    const r = await iniciarCompraGiftCard({
      negocioId: negocio.id,
      monto: montoFinal,
      pin,
      destinatarioNombre: paraOtro ? destinatarioNombre : undefined,
      destinatarioEmail: paraOtro ? destinatarioEmail || undefined : undefined,
      mensaje: mensaje || undefined,
    });
    setIniciando(false);
    if (!r.ok) return toast.error(r.mensaje);
    setPagoId(r.pagoId);
    setEsperando(true);
    window.location.href = r.url;
  }

  if (comprada) {
    return (
      <main className="mx-auto w-full max-w-md flex-1 px-5 py-6 text-center sm:px-0">
        <Card>
          <p className="text-[16px] font-bold text-text">¡Gift Card comprada!</p>
          <p className="mt-2 text-[12.5px] text-text-muted">
            Compartí el código con {paraOtro ? destinatarioNombre || "el destinatario" : "quien la va a usar"} junto con el PIN que elegiste — se canjea presentándola en el local.
          </p>
        </Card>
        <Link href="/gift-cards/mis" className="mt-5 block">
          <Button className="w-full">Ver mis Gift Cards</Button>
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-md flex-1 px-5 py-6 pb-32 sm:px-0">
      <section className="mb-5">
        <label className="mb-1.5 block text-[12px] font-semibold text-text-muted">¿Para qué Negocio?</label>
        {negocio ? (
          <div className="flex items-center justify-between rounded-xl border border-accent/40 bg-accent-soft px-3.5 py-2.5">
            <span className="text-[13px] font-semibold text-accent-ink">{negocio.nombre}</span>
            <button type="button" onClick={() => setNegocio(null)} className="text-[11px] font-bold uppercase text-accent">Cambiar</button>
          </div>
        ) : (
          <>
            <input
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscá una Barbería..."
              className="h-10 w-full rounded-lg border border-border bg-bg px-3 text-[13px] text-text"
            />
            {resultados.length > 0 ? (
              <ul className="mt-1.5 overflow-hidden rounded-xl border border-border-subtle">
                {resultados.map((n) => (
                  <li key={n.id}>
                    <button type="button" onClick={() => { setNegocio(n); setBusqueda(""); setResultados([]); }} className="block w-full px-3.5 py-2.5 text-left text-[13px] text-text hover:bg-surface-2">
                      {n.nombre}
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </>
        )}
      </section>

      <section className="mb-5">
        <label className="mb-1.5 block text-[12px] font-semibold text-text-muted">Monto</label>
        <div className="grid grid-cols-4 gap-2">
          {MONTOS_RAPIDOS.map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => { setMonto(m); setMontoCustom(""); }}
              className={`rounded-lg border px-2 py-2 text-[11.5px] font-bold ${monto === m && !montoCustom ? "border-accent bg-accent-soft text-accent" : "border-border text-text-muted"}`}
            >
              {formatCOP(m)}
            </button>
          ))}
        </div>
        <input
          type="number"
          min={1000}
          value={montoCustom}
          onChange={(e) => setMontoCustom(e.target.value)}
          placeholder="Otro monto"
          className="mt-2 h-10 w-full rounded-lg border border-border bg-bg px-3 text-[13px] text-text"
        />
      </section>

      <section className="mb-5">
        <div className="mb-2 flex gap-2">
          <button type="button" onClick={() => setParaOtro(false)} className={`flex-1 rounded-lg border px-3 py-2 text-[12.5px] font-semibold ${!paraOtro ? "border-accent bg-accent-soft text-accent" : "border-border text-text-muted"}`}>
            Para mí
          </button>
          <button type="button" onClick={() => setParaOtro(true)} className={`flex-1 rounded-lg border px-3 py-2 text-[12.5px] font-semibold ${paraOtro ? "border-accent bg-accent-soft text-accent" : "border-border text-text-muted"}`}>
            Para otra persona
          </button>
        </div>
        {paraOtro ? (
          <div className="flex flex-col gap-2">
            <input value={destinatarioNombre} onChange={(e) => setDestinatarioNombre(e.target.value)} placeholder="Nombre del destinatario" className="h-10 w-full rounded-lg border border-border bg-bg px-3 text-[13px] text-text" />
            <input value={destinatarioEmail} onChange={(e) => setDestinatarioEmail(e.target.value)} placeholder="Email del destinatario (opcional)" className="h-10 w-full rounded-lg border border-border bg-bg px-3 text-[13px] text-text" />
            <textarea value={mensaje} onChange={(e) => setMensaje(e.target.value)} placeholder="Mensaje (opcional)" rows={2} className="w-full rounded-lg border border-border bg-bg p-3 text-[13px] text-text" />
          </div>
        ) : null}
      </section>

      <section className="mb-6">
        <label className="mb-1.5 block text-[12px] font-semibold text-text-muted">Elegí un PIN de 4 dígitos</label>
        <input
          value={pin}
          onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
          inputMode="numeric"
          placeholder="••••"
          className="h-10 w-full rounded-lg border border-border bg-bg px-3 text-[13px] text-text"
        />
        <p className="mt-1 text-[11px] text-text-faint">Vas a necesitar compartir el código y este PIN con quien la use — no se envía automáticamente.</p>
      </section>

      {esperando ? (
        <div className="mb-5 rounded-2xl border border-border bg-surface p-4 text-center">
          <span className="mx-auto mb-3 block size-6 animate-spin rounded-full border-2 border-accent border-t-transparent" />
          <p className="text-[13px] font-semibold text-text">Esperando la confirmación…</p>
        </div>
      ) : null}

      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-border-subtle bg-bg/95 px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur">
        <div className="mx-auto w-full max-w-md">
          <Button size="lg" className="w-full" loading={iniciando || esperando} disabled={iniciando || esperando} onClick={comprar}>
            {montoFinal ? `Pagar ${formatCOP(montoFinal)}` : "Pagar"}
          </Button>
        </div>
      </div>
    </main>
  );
}

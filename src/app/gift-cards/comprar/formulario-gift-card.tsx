"use client";

import { Pie } from "@/app/lealtad/ui-cliente";
import { Chip, ChipGroup, Segmented } from "@/components/brutal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  const [esperaLarga, setEsperaLarga] = useState(false);
  const yaRedirigido = useRef(false);

  useEffect(() => {
    const t = setTimeout(() => buscarNegociosParaGiftCard(busqueda).then(setResultados), 300);
    return () => clearTimeout(t);
  }, [busqueda]);

  useEffect(() => {
    if (!pagoId) return;
    const inicio = Date.now();
    const intervalo = setInterval(async () => {
      // Pasados 90 s sin respuesta se avisa al usuario (el pago puede estar aprobado y la tarjeta ya activa).
      if (Date.now() - inicio > 90_000) setEsperaLarga(true);
      let estado: Awaited<ReturnType<typeof consultarEstadoCompraGiftCard>>;
      try {
        estado = await consultarEstadoCompraGiftCard(pagoId);
      } catch {
        return; // un fallo de red puntual no detiene el sondeo; se reintenta en el siguiente ciclo
      }
      if (estado.pago === "APROBADO" && !yaRedirigido.current) {
        yaRedirigido.current = true;
        setEsperando(false);
        setComprada(true);
      } else if (estado.pago === "RECHAZADO") {
        setEsperando(false);
        toast.error("El pago fue rechazado. Puedes intentar de nuevo con otro medio.");
      }
    }, INTERVALO_POLLING_MS);
    return () => clearInterval(intervalo);
  }, [pagoId]);

  const montoFinal = montoCustom ? Number(montoCustom) : monto;

  async function comprar() {
    if (!negocio) return toast.error("Elige para qué negocio es la Gift Card.");
    if (!montoFinal || montoFinal <= 0) return toast.error("Elige un monto válido.");
    if (pin.length < 4) return toast.error("El PIN debe tener al menos 4 dígitos.");
    if (paraOtro && !destinatarioNombre.trim()) return toast.error("Escribe el nombre del destinatario.");

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
      <main className="flex flex-1 flex-col">
        <div className="sn-block-signal !bg-signal !text-ink border-b-2 border-ink px-4 pt-5 pb-6">
          <span className="sn-num !text-ink">00 / Listo</span>
          <h2 className="poster-2 mt-2.5 break-words">
            Gift card
            <br />
            comprada.
          </h2>
        </div>
        <p className="body-sm break-words p-4">
          Comparte el código con {paraOtro ? destinatarioNombre || "el destinatario" : "quien la va a usar"} junto con el PIN que
          elegiste. Se canjea presentándola en el local.
        </p>
        <div className="flex-1" />
        <Pie>
          <Button asChild size="lg" className="w-full">
            <Link href="/gift-cards/mis">Ver mis gift cards</Link>
          </Button>
        </Pie>
      </main>
    );
  }

  return (
    <main className="flex flex-1 flex-col">
      <div className="flex flex-col gap-6 p-4">
        <section className="flex flex-col gap-2">
          <span className="sn-num">01 / ¿Para qué negocio?</span>
          {negocio ? (
            <div className="flex flex-wrap items-center justify-between gap-3 border-2 border-border p-3">
              <span className="section break-words">{negocio.nombre}</span>
              <Button variant="secondary" size="sm" onClick={() => setNegocio(null)}>
                Cambiar
              </Button>
            </div>
          ) : (
            <>
              <Input
                aria-label="Buscar barbería"
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                placeholder="Busca una barbería..."
              />
              {resultados.length > 0 ? (
                <ul className="border-2 border-border">
                  {resultados.map((n) => (
                    <li key={n.id} className="border-b border-border-subtle last:border-b-0">
                      <button
                        type="button"
                        onClick={() => {
                          setNegocio(n);
                          setBusqueda("");
                          setResultados([]);
                        }}
                        className="block min-h-12 w-full px-3 text-left text-[15px] font-bold text-text active:bg-text active:text-bg"
                      >
                        {n.nombre}
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
            </>
          )}
        </section>

        <section className="flex flex-col gap-2">
          <span className="sn-num">02 / Monto</span>
          <ChipGroup>
            {MONTOS_RAPIDOS.map((m) => (
              <Chip
                key={m}
                selected={monto === m && !montoCustom}
                onClick={() => {
                  setMonto(m);
                  setMontoCustom("");
                }}
              >
                {formatCOP(m)}
              </Chip>
            ))}
          </ChipGroup>
          <Input
            aria-label="Otro monto"
            type="number"
            min={1000}
            value={montoCustom}
            onChange={(e) => setMontoCustom(e.target.value)}
            placeholder="Otro monto"
          />
        </section>

        <section className="flex flex-col gap-3">
          <span className="sn-num">03 / ¿Para quién?</span>
          <Segmented<"yo" | "otro">
            aria-label="Destinatario"
            className="flex [&>button]:min-w-0 [&>button]:flex-1"
            value={paraOtro ? "otro" : "yo"}
            onChange={(v) => setParaOtro(v === "otro")}
            options={[
              { value: "yo", label: "Para mí" },
              { value: "otro", label: "Para otra persona" },
            ]}
          />
          {paraOtro ? (
            <div className="flex flex-col gap-3">
              <Input
                label="Nombre del destinatario"
                value={destinatarioNombre}
                onChange={(e) => setDestinatarioNombre(e.target.value)}
              />
              <Input
                label="Email del destinatario (opcional)"
                type="email"
                value={destinatarioEmail}
                onChange={(e) => setDestinatarioEmail(e.target.value)}
              />
              <div className="flex flex-col gap-2">
                <label htmlFor="gc-mensaje" className="font-mono text-xs leading-4 font-bold tracking-[0.72px] uppercase">
                  Mensaje (opcional)
                </label>
                <textarea
                  id="gc-mensaje"
                  value={mensaje}
                  onChange={(e) => setMensaje(e.target.value)}
                  rows={2}
                  className="w-full border-2 border-border bg-bg p-3 text-[15px] leading-[22px] text-text outline-none focus:shadow-hard"
                />
              </div>
            </div>
          ) : null}
        </section>

        <section className="flex flex-col gap-2">
          <span className="sn-num">04 / PIN</span>
          <Input
            label="Elige un PIN de 4 a 6 dígitos"
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
            inputMode="numeric"
            placeholder="••••"
          />
          <p className="sn-help">Debes compartir el código y este PIN con quien la use. No se envía automáticamente.</p>
        </section>

        {esperando ? (
          <div role="status" className="flex items-center gap-3 border-2 border-border p-4">
            <span aria-hidden className="size-5 animate-spin rounded-full border-2 border-current border-t-transparent" />
            <span className="section">Esperando la confirmación…</span>
          </div>
        ) : null}
        {esperando && esperaLarga ? (
          <p className="sn-help" role="status">
            Está tardando más de lo normal. Si ya pagaste, tu gift card se activa sola: revísala en{" "}
            <a className="underline" href="/gift-cards/mis">
              Mis gift cards
            </a>
            .
          </p>
        ) : null}
      </div>

      <div className="flex-1" />
      <Pie>
        <Button size="lg" className="w-full" loading={iniciando || esperando} disabled={iniciando || esperando} onClick={comprar}>
          {montoFinal ? `Pagar ${formatCOP(montoFinal)}` : "Pagar"}
        </Button>
      </Pie>
    </main>
  );
}
